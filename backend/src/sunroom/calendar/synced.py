"""Synced events in the core's terms (PLAN §7.5): what the calendar_sync plugin hands the
calendar when it pulls, and what the calendar hands back when a change waits to be pushed.

One ``SyncedSeries`` is one remote series: a CalDAV resource (one VCALENDAR: the master and its
changed occurrences, one UID), a Google event with its exceptions, or one UID in a calendar
feed. Identity is ``(calendar_id, uid, recurrence_id)``. Times are already in the core's
shape: timed starts as aware UTC instants plus the IANA zone the rule runs in, all-day ones as
dates with an exclusive end, and recurrence ids as wall times in the series' zone
(``domain.timeparts.rid_timed`` / ``rid_date``).

Pure data: the plugin builds these from what a server sends (``plugins/calendar_sync/ical.py``,
the Google mapping); the core merges them (``calendar/sync_merge.py``).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sunroom.domain.recurrence import Timing


@dataclass(frozen=True, slots=True)
class SyncedEvent:
    """One VEVENT's content: a series' master, or one changed occurrence."""

    title: str
    timing: Timing
    tzid: str | None = None  # timed: the IANA zone its times (and a rule) run in; all-day: None
    floating: bool = False  # no zone in the source: read in the household's zone at import
    description: str = ""
    location: str = ""
    cancelled: bool = False  # STATUS:CANCELLED (an override that cancels its occurrence)


@dataclass(frozen=True, slots=True)
class SyncedOverride:
    """A changed (or cancelled) occurrence of a series, by its original start."""

    recurrence_id: str  # the occurrence's original start, as a recurrence id in the series' zone
    event: SyncedEvent  # event.cancelled: the occurrence is gone (it becomes an exdate)
    remote_id: str | None = None  # Google: the exception's own event id; CalDAV: None
    etag: str | None = None  # Google: the exception's own etag; CalDAV: None


@dataclass(frozen=True, slots=True)
class SyncedSeries:
    """A remote series as one unit.

    ``master`` is None only for a partial update (a Google exception that changed on its own):
    then the overrides apply to the series already stored under ``uid``, and nothing else of it
    changes.
    """

    uid: str
    master: SyncedEvent | None
    rrule: str | None = None  # normalized by domain.recurrence.validate_rrule
    rdates: tuple[str, ...] = ()  # extra occurrences, as recurrence ids
    exdates: tuple[str, ...] = ()  # removed occurrences, as recurrence ids
    overrides: tuple[SyncedOverride, ...] = ()
    remote_id: str | None = None  # CalDAV: the resource's href; Google: the event id
    etag: str | None = None  # the resource's (CalDAV) or the master's (Google) etag
    updated_at: datetime | None = None  # LAST-MODIFIED / Google's "updated", aware UTC
    sequence: int | None = None
    raw_ical: str | None = None  # CalDAV: the whole VCALENDAR as fetched, kept for pushes


@dataclass(frozen=True, slots=True)
class MergeResult:
    created: int = 0
    updated: int = 0
    deleted: int = 0
    kept_local: int = 0  # a local change newer than the remote's waits to be pushed
    unchanged: int = 0
    refused: int = 0  # couldn't be stored (a rule or a time the calendar can't hold)


@dataclass(frozen=True, slots=True)
class PendingSeries:
    """A synced series with a local change to push (or a removal to send).

    ``series`` is the local state in the same shape the plugin pulls, with the remote ids and
    the ``raw_ical`` last seen, so a push edits the server's own component. ``version`` is the
    master's version when read: marking it pushed is refused if it changed meanwhile.
    """

    event_id: str  # the master's id
    calendar_id: str
    series: SyncedSeries
    deleted: bool  # True: remove it from the server
    version: int
