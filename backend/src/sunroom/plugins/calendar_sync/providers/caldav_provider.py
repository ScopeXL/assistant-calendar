"""iCloud and other CalDAV servers as a provider (PLAN §8.1, ADR 0005): the client in
caldav.py speaks the protocol; this turns its resources into synced series and back.

Changes come from ``sync-collection`` with the stored token; a server without it is diffed by
ctag and etags. Only resources whose etag changed are fetched (``calendar-multiget``). Pushes
PUT the whole VCALENDAR, editing the server's own text (``raw_ical``) so properties Sunroom
doesn't model survive, with If-Match its etag.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable, Mapping
from datetime import datetime
from zoneinfo import ZoneInfo

from sunroom.calendar.synced import PendingSeries, SyncedSeries
from sunroom.plugins.calendar_sync.ical import ParsedCalendar, build_calendar, parse_calendar
from sunroom.plugins.calendar_sync.providers.base import Changes, Pushed, RemoteCalendar
from sunroom.plugins.calendar_sync.providers.caldav import (
    CaldavClient,
    SyncCollectionUnsupported,
    SyncTokenInvalid,
)


class CaldavProvider:
    def __init__(
        self,
        client: CaldavClient,
        household: Callable[[], ZoneInfo],
        now_of: Callable[[], datetime],
    ) -> None:
        self._client = client
        self._household = household
        self._now_of = now_of
        self.refused = 0

    async def calendars(self) -> list[RemoteCalendar]:
        return await self._client.discover()

    async def changes(
        self, calendar: RemoteCalendar, cursor: str | None, known: Mapping[str, str | None]
    ) -> Changes:
        href = calendar.remote_id
        full = cursor is None
        try:
            try:
                delta = await self._client.sync_collection(href, cursor)
                changed, removed, token = dict(delta.changed), list(delta.removed), delta.token
            except SyncTokenInvalid:
                # The server forgot the token (or it was a ctag): list everything once.
                delta = await self._client.sync_collection(href, None)
                changed, removed, token = dict(delta.changed), [], delta.token
                full = True
        except SyncCollectionUnsupported:
            current = await self._client.ctag(href)
            if cursor is not None and current is not None and current == cursor:
                return Changes()
            changed = await self._client.list_etags(href)
            removed, token, full = [], current, True
        if full:
            # A full listing: what we hold and the server no longer lists is gone. (Not
            # ``complete``: unchanged resources aren't fetched again, so they aren't in it.)
            removed = sorted({*removed, *(h for h in known if h not in changed)})
        wanted = [h for h, etag in changed.items() if etag is None or known.get(h) != etag]
        series: list[SyncedSeries] = []
        self.refused = 0
        resources = await self._client.multiget(href, wanted) if wanted else []
        household = self._household()

        def read_all() -> list[ParsedCalendar]:
            return [
                parse_calendar(
                    resource.ical,
                    household,
                    remote_id=resource.href,
                    etag=resource.etag,
                    keep_raw=True,
                )
                for resource in resources
            ]

        # Off the event loop: reading many resources takes a while on a Pi.
        for parsed in await asyncio.to_thread(read_all):
            series.extend(parsed.series)
            self.refused += len(parsed.refused)
        return Changes(series=series, removed=removed, cursor=token)

    async def push(self, calendar: RemoteCalendar, pending: PendingSeries) -> Pushed:
        series = pending.series
        text = build_calendar(series, base=series.raw_ical, now=self._now_of())
        href = series.remote_id or self._client.new_href(calendar.remote_id, series.uid)
        etag = await self._client.put(href, text, etag=series.etag if series.remote_id else None)
        return Pushed(uid=series.uid, remote_id=href, etag=etag, raw_ical=text)

    async def delete(self, calendar: RemoteCalendar, pending: PendingSeries) -> None:
        if pending.series.remote_id is not None:
            await self._client.delete(pending.series.remote_id, etag=pending.series.etag)
