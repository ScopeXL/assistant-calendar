"""The real CalDAV client against a real server (PLAN §8.3): `just smoke-caldav` starts a
throwaway Radicale container and runs this.

It makes a calendar, PUTs every ICS fixture as one resource per UID (a resource holds one
series), then discovers, syncs (in full, then a delta after one change and one removal),
multigets everything back and checks the UIDs and event counts match what was sent. Then it reads
each fixture's resources back through the sync plugin's reader and the recurrence engine and
checks every 2026 occurrence against the fixture's golden. It prints a summary and exits 1 on the
first thing that's wrong.

Settings come from the environment, never the command line:
  CALDAV_SMOKE_URL       the server, e.g. http://127.0.0.1:15232/
  CALDAV_SMOKE_USER      the user name
  CALDAV_SMOKE_PASSWORD  that user's password (the recipe makes a random one)

The server is on this machine, so this script, and only this script, lets the guard reach a
private address (PLAN §12.6).
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import sys
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from icalendar import Calendar, Event

from sunroom.core.http import GuardedHttp
from sunroom.core.netguard import NetGuard
from sunroom.domain.recurrence import Occurrence, Override, Series, Window, expand
from sunroom.domain.timeparts import from_local
from sunroom.plugins.calendar_sync.ical import parse_calendar
from sunroom.plugins.calendar_sync.providers.base import ErrorKind, SyncError
from sunroom.plugins.calendar_sync.providers.caldav import CaldavClient
from sunroom.plugins.context import PluginHttp

FIXTURES = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "ics"
CALENDAR = "sunroom-smoke"
# Plus one event whose UID can't be a file name as it is (":" and "+"): the client names it by a
# hash that keeps the "@", which Radicale spells "%40" in its replies, and the sync must still
# hand back the very href the client made.
ODD_UID = "sample:check-in+1@example.org"
ODD_EVENT = (
    "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Sunroom//Smoke test//EN\r\nBEGIN:VEVENT\r\n"
    f"UID:{ODD_UID}\r\nDTSTAMP:20260101T000000Z\r\nSUMMARY:Sample check-in\r\n"
    "DTSTART:20261010T150000Z\r\nDTEND:20261010T153000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"
)
MKCALENDAR = (
    b'<?xml version="1.0" encoding="utf-8"?>\n'
    b'<c:mkcalendar xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:set><d:prop>'
    b"<d:displayname>Sunroom smoke test</d:displayname>"
    b'<c:supported-calendar-component-set><c:comp name="VEVENT"/>'
    b"</c:supported-calendar-component-set></d:prop></d:set></c:mkcalendar>"
)


class SmokeError(Exception):
    pass


def check(condition: bool, message: str) -> None:
    if not condition:
        raise SmokeError(message)


def fixtures() -> dict[str, tuple[str, int]]:
    """Every fixture split into one VCALENDAR per UID: uid -> (the text, how many VEVENTs).
    Each keeps its file's calendar properties and time zones."""
    split: dict[str, tuple[str, int]] = {}
    for path in sorted(FIXTURES.glob("*.ics")):
        text = path.read_text()
        for uid in dict.fromkeys(str(event.uid) for event in Calendar.from_ical(text).events):
            calendar = Calendar.from_ical(text)  # a fresh copy, then only this UID's events
            calendar.subcomponents = [
                component
                for component in calendar.subcomponents
                if not isinstance(component, Event) or component.uid == uid
            ]
            check(uid not in split, f"two fixtures share the UID {uid}")
            split[uid] = (calendar.to_ical().decode(), len(calendar.events))
    return split


def uids_and_counts(ical: str) -> tuple[set[str], int]:
    events = Calendar.from_ical(ical).events
    return {str(event.uid) for event in events}, len(events)


async def make_calendar(http: PluginHttp, url: str, user: str, password: str) -> None:
    """MKCALENDAR (Radicale makes the user's own collection on first sign-in)."""
    pair = base64.b64encode(f"{user}:{password}".encode()).decode()
    headers = {"Authorization": f"Basic {pair}", "Content-Type": "application/xml"}
    target = f"{url.rstrip('/')}/{user}/{CALENDAR}/"
    result = await http.request("MKCALENDAR", target, headers=headers, content=MKCALENDAR)
    check(result.status in (201, 405, 409), f"MKCALENDAR answered {result.status}")


async def smoke(url: str, user: str, password: str) -> dict[str, str]:
    """Run every step; returns uid -> the VCALENDAR text read back (for golden comparisons)."""
    http = PluginHttp(GuardedHttp(NetGuard(allow_private_everywhere=True)), allow_private=True)
    client = CaldavClient(http, url, user, password)
    await make_calendar(http, url, user, password)

    calendars = await client.discover()
    mine = [calendar for calendar in calendars if calendar.remote_id.endswith(f"/{CALENDAR}/")]
    check(len(mine) == 1, f"discovery found {len(calendars)} calendars but not {CALENDAR}")
    calendar = mine[0]
    access = "read-only" if calendar.read_only else "writable"
    print(f"Discovered {len(calendars)} calendar(s), among them {calendar.name!r} ({access})")
    href = calendar.remote_id

    sent = fixtures() | {ODD_UID: (ODD_EVENT, 1)}
    hrefs: dict[str, str] = {}
    for uid, (ical, _count) in sent.items():
        hrefs[uid] = client.new_href(href, uid)
        await client.put(hrefs[uid], ical, etag=None)
    files = len(list(FIXTURES.glob("*.ics")))
    print(f"Put {len(sent)} resources: {len(sent) - 1} from {files} fixtures, 1 with an odd UID")

    first = await client.sync_collection(href, None)
    check(set(first.changed) == set(hrefs.values()), "the full sync's hrefs differ from the PUTs")
    check(first.token is not None, "the full sync brought no token")
    print(f"Full sync: {len(first.changed)} changed, token received")

    fetched = await client.multiget(href, list(first.changed))
    check(len(fetched) == len(sent), f"multiget returned {len(fetched)} of {len(sent)}")
    back: dict[str, str] = {}
    for resource in fetched:
        uids, count = uids_and_counts(resource.ical)
        check(len(uids) == 1, f"{resource.href} holds {len(uids)} UIDs")
        uid = uids.pop()
        check(hrefs.get(uid) == resource.href, f"{uid} came back from another href")
        check(count == sent[uid][1], f"{uid} came back with {count} of {sent[uid][1]} VEVENTs")
        check(resource.etag == first.changed[resource.href], f"{uid}'s etag differs")
        back[uid] = resource.ical
    print(f"Multiget: {len(fetched)} resources, every UID and VEVENT back")

    changed_uid, removed_uid = ODD_UID, sorted(sent)[0]
    etag = first.changed[hrefs[changed_uid]]
    edited = sent[changed_uid][0].replace("SUMMARY:", "SUMMARY:Edited ", 1)  # a new etag
    newer = await client.put(hrefs[changed_uid], edited, etag=etag)
    try:
        await client.put(hrefs[changed_uid], edited, etag=etag)
        raise SmokeError("a PUT with a stale etag was accepted")
    except SyncError as error:
        check(error.kind == ErrorKind.CONFLICT, f"a stale etag gave {error.kind}, not a conflict")
    await client.delete(hrefs[removed_uid], etag=first.changed[hrefs[removed_uid]])
    await client.delete(hrefs[removed_uid], etag=None)  # already gone: still fine
    second = await client.sync_collection(href, first.token)
    check(list(second.changed) == [hrefs[changed_uid]], "the delta's changes are wrong")
    check(newer is None or second.changed[hrefs[changed_uid]] == newer, "the new etag differs")
    check(second.removed == [hrefs[removed_uid]], "the delta's removals are wrong")
    print("Delta: 1 changed, 1 removed; a stale etag was refused")

    etags = await client.list_etags(href)
    check(len(etags) == len(sent) - 1, f"list_etags found {len(etags)}")
    check(await client.ctag(href) is not None, "no ctag or sync-token")
    print(f"Etag listing: {len(etags)} resources; ctag present")
    return back


HOUSEHOLD = ZoneInfo("America/New_York")  # the goldens' household (tests/calendar)
YEAR_START = datetime(2026, 1, 1, tzinfo=HOUSEHOLD)
YEAR_END = datetime(2027, 1, 1, tzinfo=HOUSEHOLD)


def _moment(value: date | datetime) -> str:
    if not isinstance(value, datetime):
        return value.isoformat()
    instant = from_local(value, HOUSEHOLD) if value.tzinfo is None else value.astimezone(UTC)
    return instant.strftime("%Y-%m-%dT%H:%M:%SZ")


def _row(found: Occurrence) -> dict[str, Any]:
    timing = found.timing
    if timing.all_day:
        assert timing.start_date is not None and timing.end_date is not None
        start, end = _moment(timing.start_date), _moment(timing.end_date)
    else:
        assert timing.start_utc is not None and timing.end_utc is not None
        start, end = _moment(timing.start_utc), _moment(timing.end_utc)
    return {"rid": found.recurrence_id, "all_day": timing.all_day, "start": start, "end": end}


def _ordered(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(rows, key=lambda row: (row["start"], row["rid"] or "", row["end"]))


def compare_goldens(back: dict[str, str]) -> int:
    """Each fixture's resources, as read back from the server, against its golden."""
    window = Window(
        YEAR_START.astimezone(UTC), YEAR_END.astimezone(UTC), YEAR_START.date(), YEAR_END.date()
    )
    checked = 0
    for path in sorted(FIXTURES.glob("*.ics")):
        uids = dict.fromkeys(str(e.uid) for e in Calendar.from_ical(path.read_text()).events)
        rows: list[dict[str, Any]] = []
        for uid in uids:
            parsed = parse_calendar(back[uid], HOUSEHOLD)
            check(not parsed.refused, f"{path.stem}: {uid} was refused after the round trip")
            for item in parsed.series:
                master = item.master
                assert master is not None
                series = Series(
                    timing=master.timing,
                    tzid=master.tzid or "UTC",
                    rrule=item.rrule,
                    rdates=item.rdates,
                    exdates=frozenset(item.exdates),
                )
                overrides = [
                    Override(o.recurrence_id, None if o.event.cancelled else o.event.timing)
                    for o in item.overrides
                ]
                rows.extend(_row(found) for found in expand(series, overrides, window))
        golden = json.loads((FIXTURES / f"{path.stem}.golden.json").read_text())
        check(_ordered(rows) == _ordered(golden), f"{path.stem} differs from its golden")
        checked += 1
    return checked


def main() -> int:
    try:
        url = os.environ["CALDAV_SMOKE_URL"]
        user = os.environ["CALDAV_SMOKE_USER"]
        password = os.environ["CALDAV_SMOKE_PASSWORD"]
    except KeyError as missing:
        print(f"Set {missing.args[0]} (see the docstring).", file=sys.stderr)
        return 2
    try:
        back = asyncio.run(smoke(url, user, password))
        print(f"Goldens: {compare_goldens(back)} fixtures match after the round trip")
    except (SmokeError, SyncError) as error:
        print(f"CalDAV smoke test failed: {error}", file=sys.stderr)
        return 1
    print("CalDAV smoke test passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
