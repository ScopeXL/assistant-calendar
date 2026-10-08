"""Synced calendars and events (PLAN §7.5, §8.2): what the calendar_sync plugin reaches through
``ctx.calendar``.

Pulling: each remote series is merged by ``(calendar_id, uid, recurrence_id)``. An unknown one
is added; one whose etag matches is left alone; one with a local change waiting to be pushed
that is newer than the server's keeps the local version (and remembers the server's etag, so the
push lands on top of it); anything else takes the server's version, with a revision first so it
shows in Recently removed or can be put back. Ties go to the server. A series the server
removed is removed here too.

Pushing: ``pending`` lists series a person changed, in the shape the plugin pulls, and
``mark_pushed`` / ``mark_removed`` record what the server now holds. Nothing here reads a clock
or talks to a server.
"""

from __future__ import annotations

import json
from collections import defaultdict
from collections.abc import Iterable, Sequence
from datetime import datetime

from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from sunroom.calendar import revisions
from sunroom.calendar.models import (
    Calendar,
    CalendarKind,
    Event,
    EventMember,
    EventReminder,
    EventRevision,
    EventSource,
    EventStatus,
    RevisionAction,
)
from sunroom.calendar.service import bump, refresh_window
from sunroom.calendar.synced import (
    MergeResult,
    PendingSeries,
    SyncedEvent,
    SyncedOverride,
    SyncedSeries,
)
from sunroom.calendar.timing import json_list, set_timing, timing_of
from sunroom.db.engine import WriteTx
from sunroom.domain.recurrence import RecurrenceError, validate_rrule

CHUNK = 200  # series per write transaction, so the write lock stays short on a Pi
SYNC_DEVICE = "sync"  # what a revision written by a sync says did it
TITLE_MAX, LOCATION_MAX, DESCRIPTION_MAX = 200, 300, 5000


# ---- calendars ---------------------------------------------------------------------------------


async def create_calendar(
    tx: WriteTx,
    *,
    name: str,
    color: str,
    owner_member_id: str | None,
    read_only: bool,
    visible_on_display: bool,
    source_label: str,
    now: datetime,
) -> Calendar:
    """A calendar an account fills (``kind`` sync; the local calendar routes refuse it)."""
    calendar = Calendar(
        name=name[:80],
        color=color,
        kind=CalendarKind.SYNC,
        owner_member_id=owner_member_id,
        read_only=read_only,
        visible_on_display=visible_on_display,
        remote_ref=source_label[:500],
        sort=1000,
        created_at=now,
        updated_at=now,
    )
    tx.session.add(calendar)
    await tx.session.flush()
    tx.publish("calendars.changed", {"calendar_id": calendar.id})
    return calendar


async def update_calendar(
    tx: WriteTx,
    calendar_id: str,
    *,
    now: datetime,
    name: str | None = None,
    color: str | None = None,
    owner_member_id: str | None = None,
    clear_owner: bool = False,
    read_only: bool | None = None,
    visible_on_display: bool | None = None,
    source_label: str | None = None,
) -> Calendar:
    """Change a synced calendar. Its person and color decide how its events show, so the
    occurrence cache moves on (the version goes up)."""
    calendar = await _synced_calendar(tx.session, calendar_id, include_deleted=True)
    if name is not None:
        calendar.name = name[:80]
    if color is not None:
        calendar.color = color
    if clear_owner:
        calendar.owner_member_id = None
    elif owner_member_id is not None:
        calendar.owner_member_id = owner_member_id
    if read_only is not None:
        calendar.read_only = read_only
    if visible_on_display is not None:
        calendar.visible_on_display = visible_on_display
    if source_label is not None:
        calendar.remote_ref = source_label[:500]
    calendar.updated_at = now
    calendar.version += 1
    await tx.session.flush()
    tx.publish("calendars.changed", {"calendar_id": calendar.id})
    return calendar


async def remove_calendar(tx: WriteTx, calendar_id: str, now: datetime) -> None:
    """Unmapped: it leaves the board; its events stay restorable for 30 days (PLAN §8.1)."""
    calendar = await _synced_calendar(tx.session, calendar_id, include_deleted=True)
    if calendar.deleted_at is None:
        calendar.deleted_at = now
        calendar.version += 1
        tx.publish("calendars.changed", {"calendar_id": calendar.id})


async def restore_calendar(tx: WriteTx, calendar_id: str, now: datetime) -> Calendar:
    calendar = await _synced_calendar(tx.session, calendar_id, include_deleted=True)
    if calendar.deleted_at is not None:
        calendar.deleted_at = None
        calendar.updated_at = now
        calendar.version += 1
        tx.publish("calendars.changed", {"calendar_id": calendar.id})
    return calendar


async def _synced_calendar(
    session: AsyncSession, calendar_id: str, *, include_deleted: bool = False
) -> Calendar:
    calendar = await session.get(Calendar, calendar_id)
    if calendar is None or calendar.kind != CalendarKind.SYNC:
        raise LookupError(f"no synced calendar {calendar_id}")
    if calendar.deleted_at is not None and not include_deleted:
        raise LookupError(f"synced calendar {calendar_id} was removed")
    return calendar


# ---- pulling -----------------------------------------------------------------------------------


async def known(session: AsyncSession, calendar_id: str) -> dict[str, str | None]:
    """The remote ids stored for a calendar and their etags (for servers that can only be
    diffed)."""
    rows = await session.execute(
        select(Event.remote_id, Event.etag).where(
            Event.calendar_id == calendar_id,
            Event.parent_event_id.is_(None),
            Event.remote_id.is_not(None),
            Event.deleted_at.is_(None),
        )
    )
    return {str(remote_id): etag for remote_id, etag in rows.all()}


async def merge_chunk(
    tx: WriteTx, calendar_id: str, chunk: Sequence[SyncedSeries], now: datetime
) -> MergeResult:
    """Merge up to CHUNK series in one transaction."""
    session = tx.session
    calendar = await _synced_calendar(session, calendar_id, include_deleted=True)
    uids = [item.uid for item in chunk]
    masters: dict[str, Event] = {}
    for row in (
        await session.scalars(
            select(Event).where(
                Event.calendar_id == calendar_id,
                Event.parent_event_id.is_(None),
                Event.remote_uid.in_(uids),
            )
        )
    ).all():
        if row.remote_uid is not None:
            masters[row.remote_uid] = row
    children: dict[str, list[Event]] = defaultdict(list)
    if masters:
        for row in (
            await session.scalars(
                select(Event).where(Event.parent_event_id.in_([m.id for m in masters.values()]))
            )
        ).all():
            if row.parent_event_id is not None:
                children[row.parent_event_id].append(row)

    counts: dict[str, int] = defaultdict(int)
    touched: list[str] = []
    for item in chunk:
        if not _storable(item):
            counts["refused"] += 1
            continue
        existing = masters.get(item.uid)
        outcome, row = await _merge_one(
            tx, calendar, existing, children.get(existing.id, []) if existing else [], item, now
        )
        counts[outcome] += 1
        if row is not None and outcome in {"created", "updated"}:
            touched.append(row.id)
    if touched:
        await bump(tx, {calendar.id}, touched[:50])
    return MergeResult(
        created=counts["created"],
        updated=counts["updated"],
        kept_local=counts["kept_local"],
        unchanged=counts["unchanged"],
        refused=counts["refused"],
    )


def _storable(item: SyncedSeries) -> bool:
    """Whether the calendar can hold this series, checked before any row is touched."""
    events = [o.event for o in item.overrides if not o.event.cancelled]
    if item.master is not None:
        events.append(item.master)
        if not item.master.timing.all_day and not item.master.tzid:
            return False
        if item.rrule:
            try:
                validate_rrule(item.rrule, item.master.timing, item.master.tzid or "UTC")
            except RecurrenceError:
                return False
    for event in events:
        timing = event.timing
        if timing.all_day and (timing.start_date is None or timing.end_date is None):
            return False
        if not timing.all_day and (timing.start_utc is None or timing.end_utc is None):
            return False
    return True


async def _merge_one(
    tx: WriteTx,
    calendar: Calendar,
    existing: Event | None,
    overrides: list[Event],
    item: SyncedSeries,
    now: datetime,
) -> tuple[str, Event | None]:
    session = tx.session
    if existing is None:
        if item.master is None:
            # A change to a series this calendar never saw: nothing to apply it to.
            return "unchanged", None
        master = _new_row(calendar.id, item.uid, item.master, now)
        _remote(master, item)
        _rule(master, item)
        session.add(master)
        await session.flush()
        await _set_overrides(session, master, [], item, now)
        await refresh_window(session, master)
        return "created", master

    if existing.pending_push or existing.pending_delete:
        local_newer = item.updated_at is None or existing.updated_at > item.updated_at
        if local_newer:
            # The person's change wins; the push applies it on top of the server's latest.
            existing.remote_id = item.remote_id or existing.remote_id
            existing.etag = item.etag or existing.etag
            existing.raw_ical = item.raw_ical or existing.raw_ical
            existing.remote_updated_at = item.updated_at
            return "kept_local", existing

    if item.master is not None and item.etag is not None and existing.etag == item.etag:
        if _same_overrides(overrides, item):
            # The server hasn't changed it since we last looked (a local change or removal
            # waiting to be pushed stands). A series the server removed has no etag, so it
            # comes back.
            return "unchanged", existing

    await _revise(tx, existing, RevisionAction.UPDATE, now)
    if item.master is None:
        # Only some occurrences changed: the series itself (and any change to it waiting to be
        # pushed) stays as it is.
        await _apply_partial(session, existing, overrides, item, now)
    else:
        _content(existing, item.master)
        _rule(existing, item)
        await _set_overrides(session, existing, overrides, item, now)
        existing.deleted_at = None
        existing.pending_push = False
        existing.pending_delete = False
    _remote(existing, item)
    existing.version += 1
    existing.updated_at = now
    await session.flush()
    await refresh_window(session, existing)
    return "updated", existing


def _same_overrides(current: list[Event], item: SyncedSeries) -> bool:
    """Whether the server's changed occurrences are the ones stored, by their own etags (Google
    gives each one an etag; a CalDAV resource's etag already covers them)."""
    if all(o.etag is None for o in item.overrides):
        return True
    stored = {row.recurrence_id: row.etag for row in current if row.deleted_at is None}
    incoming = {o.recurrence_id: o.etag for o in item.overrides if not o.event.cancelled}
    return stored == incoming


def _new_row(calendar_id: str, uid: str, event: SyncedEvent, now: datetime) -> Event:
    row = Event(
        calendar_id=calendar_id,
        title="",
        source=EventSource.SYNC,
        remote_uid=uid,
        created_at=now,
        updated_at=now,
        window_start_utc=now,
        window_end_utc=now,
    )
    _content(row, event)
    return row


def _content(row: Event, event: SyncedEvent) -> None:
    row.title = (event.title or "No title")[:TITLE_MAX]
    row.description = event.description[:DESCRIPTION_MAX]
    row.location = event.location[:LOCATION_MAX]
    if not event.timing.all_day and not event.tzid:
        raise ValueError("a timed synced event needs its zone")
    set_timing(row, event.timing, event.tzid)
    row.floating = event.floating
    row.status = EventStatus.CANCELLED if event.cancelled else EventStatus.CONFIRMED


def _rule(master: Event, item: SyncedSeries) -> None:
    timing = timing_of(master)
    tzid = master.tzid or "UTC"
    master.rrule = validate_rrule(item.rrule, timing, tzid) if item.rrule else None
    cancelled = [o.recurrence_id for o in item.overrides if o.event.cancelled]
    master.exdates_json = json.dumps(sorted({*item.exdates, *cancelled}))
    master.rdates_json = json.dumps(sorted(set(item.rdates)))


def _remote(master: Event, item: SyncedSeries) -> None:
    master.remote_id = item.remote_id
    master.etag = item.etag
    master.remote_updated_at = item.updated_at
    master.remote_sequence = item.sequence
    if item.raw_ical is not None:
        master.raw_ical = item.raw_ical


async def _set_overrides(
    session: AsyncSession, master: Event, current: list[Event], item: SyncedSeries, now: datetime
) -> None:
    """Make the stored overrides exactly the series' changed occurrences."""
    wanted = {o.recurrence_id: o for o in item.overrides if not o.event.cancelled}
    for row in current:
        if row.recurrence_id not in wanted:
            await _drop_children(session, [row])
    by_rid = {row.recurrence_id: row for row in current if row.recurrence_id in wanted}
    for rid, override in wanted.items():
        await _upsert_override(session, master, by_rid.get(rid), override, now)


async def _apply_partial(
    session: AsyncSession, master: Event, current: list[Event], item: SyncedSeries, now: datetime
) -> None:
    """A partial update: only these occurrences changed (a Google exception on its own)."""
    exdates = set(json_list(master.exdates_json))
    by_rid = {row.recurrence_id: row for row in current}
    for override in item.overrides:
        row = by_rid.get(override.recurrence_id)
        if override.event.cancelled:
            exdates.add(override.recurrence_id)
            if row is not None:
                await _drop_children(session, [row])
            continue
        exdates.discard(override.recurrence_id)
        await _upsert_override(session, master, row, override, now)
    master.exdates_json = json.dumps(sorted(exdates))


async def _upsert_override(
    session: AsyncSession, master: Event, row: Event | None, override: SyncedOverride, now: datetime
) -> None:
    event = override.event
    if row is None:
        row = Event(
            calendar_id=master.calendar_id,
            parent_event_id=master.id,
            recurrence_id=override.recurrence_id,
            title="",
            source=EventSource.SYNC,
            remote_uid=master.remote_uid,
            created_at=now,
            updated_at=now,
            window_start_utc=now,
            window_end_utc=now,
        )
        session.add(row)
    timed = not event.timing.all_day
    _content(row, event if not timed or event.tzid else _with_zone(event, master.tzid))
    row.remote_id = override.remote_id
    row.etag = override.etag
    row.deleted_at = None
    row.updated_at = now
    await session.flush()


def _with_zone(event: SyncedEvent, tzid: str | None) -> SyncedEvent:
    return SyncedEvent(
        title=event.title,
        timing=event.timing,
        tzid=tzid or "UTC",
        floating=event.floating,
        description=event.description,
        location=event.location,
        cancelled=event.cancelled,
    )


async def _drop_children(session: AsyncSession, rows: Iterable[Event]) -> None:
    ids = [row.id for row in rows]
    if not ids:
        return
    await session.execute(delete(EventMember).where(EventMember.event_id.in_(ids)))
    await session.execute(delete(EventReminder).where(EventReminder.event_id.in_(ids)))
    await session.execute(delete(Event).where(Event.id.in_(ids)))
    await session.flush()


async def _revise(tx: WriteTx, master: Event, action: RevisionAction, now: datetime) -> None:
    """The series as it was, so a server's change shows in Recently removed or can be undone."""
    before = await revisions.snapshot(tx.session, [master.id])
    tx.session.add(
        EventRevision(
            series_id=master.id,
            action=action,
            before_json=before,
            created_ids_json="[]",
            device_id=SYNC_DEVICE,
            member_id=None,
            created_at=now,
        )
    )


async def drop_removed(
    tx: WriteTx, calendar_id: str, remote_ids: Sequence[str], now: datetime
) -> int:
    """The server removed these (by href or event id): remove them here too."""
    if not remote_ids:
        return 0
    rows = (
        await tx.session.scalars(
            select(Event).where(
                Event.calendar_id == calendar_id,
                Event.remote_id.in_(list(remote_ids)),
                Event.deleted_at.is_(None),
            )
        )
    ).all()
    return await _drop(tx, calendar_id, list(rows), now)


async def drop_missing(tx: WriteTx, calendar_id: str, uids: set[str], now: datetime) -> int:
    """A complete listing (a feed, a full resync): synced series it doesn't name are gone,
    except ones made here that haven't reached the server yet."""
    rows = (
        await tx.session.scalars(
            select(Event).where(
                Event.calendar_id == calendar_id,
                Event.parent_event_id.is_(None),
                Event.source == EventSource.SYNC,
                Event.deleted_at.is_(None),
            )
        )
    ).all()
    gone = [
        row
        for row in rows
        if row.remote_uid not in uids and not (row.pending_push and row.remote_id is None)
    ]
    return await _drop(tx, calendar_id, gone, now)


async def _drop(tx: WriteTx, calendar_id: str, rows: list[Event], now: datetime) -> int:
    session = tx.session
    count = 0
    for row in rows:
        if row.parent_event_id is not None:
            # A Google exception removed on its own: the occurrence goes back to the rule.
            await _drop_children(session, [row])
            continue
        await _revise(tx, row, RevisionAction.DELETE, now)
        row.deleted_at = now
        for child in (
            await session.scalars(
                select(Event).where(Event.parent_event_id == row.id, Event.deleted_at.is_(None))
            )
        ).all():
            child.deleted_at = now
        # Gone from the server: putting it back makes a new series there (keep the UID, so the
        # same series coming back from a feed matches it again).
        row.remote_id = None
        row.etag = None
        row.raw_ical = None
        row.pending_push = False
        row.pending_delete = False
        row.version += 1
        count += 1
    if rows:
        await session.flush()
        await bump(tx, {calendar_id}, [row.id for row in rows][:50])
    return count


# ---- pushing -----------------------------------------------------------------------------------


async def pending(session: AsyncSession, calendar_ids: Sequence[str]) -> list[PendingSeries]:
    """Synced series with a person's change to push, or a removal to send."""
    if not calendar_ids:
        return []
    masters = (
        await session.scalars(
            select(Event)
            .where(
                Event.calendar_id.in_(list(calendar_ids)),
                Event.parent_event_id.is_(None),
                Event.source == EventSource.SYNC,
                or_(Event.pending_push.is_(True), Event.pending_delete.is_(True)),
            )
            .order_by(Event.updated_at)
        )
    ).all()
    out: list[PendingSeries] = []
    for master in masters:
        overrides = (
            await session.scalars(
                select(Event).where(Event.parent_event_id == master.id, Event.deleted_at.is_(None))
            )
        ).all()
        out.append(
            PendingSeries(
                event_id=master.id,
                calendar_id=master.calendar_id,
                series=_series_of(master, list(overrides)),
                deleted=master.pending_delete,
                version=master.version,
            )
        )
    return out


def _event_of(row: Event, fallback_tzid: str | None = None) -> SyncedEvent:
    return SyncedEvent(
        title=row.title,
        timing=timing_of(row),
        tzid=None if row.all_day else (row.tzid or fallback_tzid),
        floating=row.floating,
        description=row.description,
        location=row.location,
        cancelled=row.status == EventStatus.CANCELLED,
    )


def _series_of(master: Event, overrides: list[Event]) -> SyncedSeries:
    return SyncedSeries(
        uid=master.remote_uid or "",
        master=_event_of(master),
        rrule=master.rrule,
        rdates=tuple(json_list(master.rdates_json)),
        exdates=tuple(json_list(master.exdates_json)),
        overrides=tuple(
            SyncedOverride(
                recurrence_id=row.recurrence_id or "",
                event=_event_of(row, master.tzid),
                remote_id=row.remote_id,
                etag=row.etag,
            )
            for row in sorted(overrides, key=lambda o: o.recurrence_id or "")
        ),
        remote_id=master.remote_id,
        etag=master.etag,
        updated_at=master.updated_at,
        sequence=master.remote_sequence,
        raw_ical=master.raw_ical,
    )


async def mark_pushed(
    tx: WriteTx,
    event_id: str,
    version: int,
    *,
    uid: str,
    remote_id: str,
    etag: str | None,
    raw_ical: str | None,
    overrides: dict[str, tuple[str | None, str | None]] | None = None,
) -> None:
    """The server holds the series now. If a person changed it again meanwhile (the version
    moved on), it stays pending and goes in the next push."""
    master = await tx.session.get(Event, event_id)
    if master is None:
        return
    master.remote_uid = uid
    master.remote_id = remote_id
    master.etag = etag
    if raw_ical is not None:
        master.raw_ical = raw_ical
    if overrides:
        for row in (
            await tx.session.scalars(select(Event).where(Event.parent_event_id == event_id))
        ).all():
            if row.recurrence_id in overrides:
                row.remote_id, row.etag = overrides[row.recurrence_id]
    if master.version == version:
        master.pending_push = False
        await tx.session.flush()
        await bump(tx, {master.calendar_id}, [master.id])


async def mark_removed(tx: WriteTx, event_id: str) -> None:
    """The server no longer has it; the row stays in Recently removed until it expires."""
    master = await tx.session.get(Event, event_id)
    if master is None:
        return
    master.pending_delete = False
    master.remote_id = None
    master.etag = None
    master.raw_ical = None
    await tx.session.flush()
    await bump(tx, {master.calendar_id}, [master.id])


async def prune(session: AsyncSession, cutoff: datetime) -> None:
    """Synced calendars unmapped before ``cutoff`` go for good, with their events."""
    gone = select(Calendar.id).where(
        Calendar.kind == CalendarKind.SYNC, Calendar.deleted_at < cutoff
    )
    events = select(Event.id).where(Event.calendar_id.in_(gone))
    await session.execute(delete(EventMember).where(EventMember.event_id.in_(events)))
    await session.execute(delete(EventReminder).where(EventReminder.event_id.in_(events)))
    # Overrides first, then their series (each one statement, so the foreign keys hold).
    await session.execute(
        delete(Event).where(Event.calendar_id.in_(gone), Event.parent_event_id.is_not(None))
    )
    await session.execute(delete(Event).where(Event.calendar_id.in_(gone)))
    await session.execute(delete(Calendar).where(Calendar.id.in_(gone)))
