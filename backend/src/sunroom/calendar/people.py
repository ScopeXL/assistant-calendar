"""Who an event is for, from its title (ADR 0034).

``Event.people_from_title`` means the title decides: set on import, and on add when nobody was
picked by hand and the title names someone. Rows are written only when a name matched: the
synced calendar's person, then whoever the title names. With no names, any rows go, so the
read-time fallback shows the calendar's person (``occurrences.py``) and a changed owner still
moves the event. A Who set by hand turns the flag off, and nothing re-adds anyone after that.

The matching itself is ``domain/people.py``, the same rules as quick add's.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from sunroom.calendar.models import Calendar, CalendarKind, Event, EventMember
from sunroom.domain.people import people_named
from sunroom.household.service import active_members


@dataclass(frozen=True, slots=True)
class Person:
    """Someone a title can name: the household's active people, in its order."""

    id: str
    name: str


async def household_people(session: AsyncSession) -> list[Person]:
    return [Person(member.id, member.name) for member in await active_members(session)]


def matched_ids(title: str, members: Sequence[Person]) -> list[str]:
    """The ids of the people the title names, in household order."""
    named = set(people_named(title, [member.name for member in members]))
    return [member.id for member in members if member.name in named]


def wanted_ids(title: str, calendar: Calendar, members: Sequence[Person]) -> list[str]:
    """Who the title gives an event: nobody (the fallback decides) or the synced calendar's
    person plus the names."""
    matched = matched_ids(title, members)
    if not matched:
        return []
    owner = calendar.owner_member_id if calendar.kind == CalendarKind.SYNC else None
    return [owner, *(m for m in matched if m != owner)] if owner else matched


async def _current(session: AsyncSession, event_ids: Iterable[str]) -> dict[str, set[str]]:
    ids = list(event_ids)
    found: dict[str, set[str]] = defaultdict(set)
    for start in range(0, len(ids), 500):
        rows = await session.execute(
            select(EventMember.event_id, EventMember.member_id).where(
                EventMember.event_id.in_(ids[start : start + 500])
            )
        )
        for event_id, member_id in rows:
            found[event_id].add(member_id)
    return found


async def _replace(session: AsyncSession, event_id: str, wanted: Sequence[str]) -> None:
    await session.execute(delete(EventMember).where(EventMember.event_id == event_id))
    session.add_all(EventMember(event_id=event_id, member_id=member) for member in wanted)


async def assign(
    session: AsyncSession, row: Event, calendar: Calendar, members: Sequence[Person]
) -> bool:
    """Let the title decide ``row``'s people (and say so on it); True if its rows changed."""
    row.people_from_title = True
    wanted = wanted_ids(row.title, calendar, members)
    current = (await _current(session, [row.id])).get(row.id, set())
    if current == set(wanted):
        return False
    await _replace(session, row.id, wanted)
    return True


async def rematch(
    session: AsyncSession, calendar_ids: Iterable[str] | None = None
) -> dict[str, list[str]]:
    """Match every event the title decides again (a person added, renamed, archived or put
    back, a synced calendar's person changed; once at start for events 0.12.0 flagged).
    Writes only what changed; answers the changed event ids by calendar, for the caller to
    announce."""
    members = await household_people(session)
    query = (
        select(Event, Calendar)
        .join(Calendar, Calendar.id == Event.calendar_id)
        .where(Event.people_from_title.is_(True), Event.deleted_at.is_(None))
    )
    if calendar_ids is not None:
        query = query.where(Event.calendar_id.in_(list(calendar_ids)))
    rows = [(event, calendar) for event, calendar in (await session.execute(query)).all()]
    current = await _current(session, (event.id for event, _ in rows))
    changed: dict[str, list[str]] = defaultdict(list)
    for event, calendar in rows:
        wanted = wanted_ids(event.title, calendar, members)
        if current.get(event.id, set()) != set(wanted):
            await _replace(session, event.id, wanted)
            changed[calendar.id].append(event.id)
    await session.flush()
    return dict(changed)
