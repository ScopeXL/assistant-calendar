"""PluginContext: the whole world a plugin sees (PLAN §6.2).

Time and zone, its own settings, read and write sessions (the write transaction's ``publish``
sends live-update events after commit), read-only facades for core data (members, photos, the
calendar, which also takes overlays), the SSRF-guarded HTTP client, encryption under the
``plugin-secrets-v1`` key, and job registration. Never the engine, never app state.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Coroutine, Mapping
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from datetime import date, datetime
from typing import TYPE_CHECKING, Any, Protocol
from zoneinfo import ZoneInfo

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sunroom.core.clock import Clock
from sunroom.core.http import FetchResult, GuardedHttp
from sunroom.db.engine import WriteTx
from sunroom.household.models import Member

if TYPE_CHECKING:
    from sunroom.calendar.occurrences import CalendarRuntime, OverlayProvider
    from sunroom.calendar.schemas import OccurrenceOut
    from sunroom.photos.store import PhotoStore

Job = Callable[[], Awaitable[None]]


class PluginDecryptError(Exception):
    """A secret encrypted under another key (the secret key changed): reconnect the account."""


@dataclass(frozen=True, slots=True)
class MemberView:
    id: str
    name: str
    role: str
    color: str
    birthday: date | None


class Sessions(Protocol):
    def read(self) -> AbstractAsyncContextManager[AsyncSession]: ...
    def write(self) -> AbstractAsyncContextManager[WriteTx]: ...


class Runner(Protocol):
    def every(self, name: str, interval_s: float, job: Job) -> None: ...
    def spawn(self, name: str, coro: Coroutine[Any, Any, None]) -> None: ...


class MembersFacade:
    def __init__(self, sessions: Sessions) -> None:
        self._sessions = sessions

    async def active(self) -> list[MemberView]:
        async with self._sessions.read() as session:
            rows = await session.scalars(
                select(Member)
                .where(Member.archived_at.is_(None))
                .order_by(Member.sort, Member.created_at)
            )
            return [_member_view(member) for member in rows]

    async def get(self, member_id: str) -> MemberView | None:
        async with self._sessions.read() as session:
            member = await session.get(Member, member_id)
            return _member_view(member) if member else None


@dataclass(frozen=True, slots=True)
class CalendarView:
    id: str
    name: str
    color: str
    kind: str
    read_only: bool


class CalendarFacade:
    """Read the calendar, and add computed, read-only occurrences to it (PLAN §7.6)."""

    def __init__(
        self,
        plugin_id: str,
        sessions: Sessions,
        runtime: CalendarRuntime | None,
        zone_of: Callable[[], ZoneInfo],
    ) -> None:
        self._plugin_id = plugin_id
        self._sessions = sessions
        self._runtime = runtime
        self._zone_of = zone_of

    async def calendars(self) -> list[CalendarView]:
        from sunroom.calendar.service import list_calendars

        async with self._sessions.read() as session:
            return [
                CalendarView(c.id, c.name, c.color, c.kind, c.read_only)
                for c in await list_calendars(session)
            ]

    async def occurrences(self, start: date, end: date) -> list[OccurrenceOut]:
        from sunroom.calendar.occurrences import CalendarRuntime, occurrences
        from sunroom.calendar.service import list_calendars

        async with self._sessions.read() as session:
            return await occurrences(
                session,
                self._runtime or CalendarRuntime(),
                await list_calendars(session),
                start,
                end,
                self._zone_of(),
            )

    def register_overlay(self, provider: OverlayProvider, key: str | None = None) -> None:
        """Add this plugin's occurrences when a client asks for ``overlays=<key>`` (the plugin's
        id by default)."""
        if self._runtime is not None:
            self._runtime.overlays[key or self._plugin_id] = provider


def _member_view(member: Member) -> MemberView:
    return MemberView(member.id, member.name, member.role, member.color, member.birthday)


class PluginHttp:
    """GuardedHttp with this plugin's ``allow_private`` choice baked in."""

    def __init__(self, http: GuardedHttp, *, allow_private: bool) -> None:
        self._http = http
        self._allow_private = allow_private

    async def get(
        self, url: str, *, headers: Mapping[str, str] | None = None, max_bytes: int | None = None
    ) -> FetchResult:
        if max_bytes is None:
            return await self._http.get(url, allow_private=self._allow_private, headers=headers)
        return await self._http.get(
            url, allow_private=self._allow_private, headers=headers, max_bytes=max_bytes
        )

    async def request(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str] | None = None,
        content: bytes | None = None,
    ) -> FetchResult:
        return await self._http.request(
            method, url, allow_private=self._allow_private, headers=headers, content=content
        )


class PluginContext:
    def __init__(
        self,
        *,
        plugin_id: str,
        clock: Clock,
        zone_of: Callable[[], ZoneInfo],
        settings_of: Callable[[], dict[str, Any]],
        sessions: Sessions,
        publish: Callable[[str, dict[str, Any]], None],
        http: GuardedHttp,
        cipher: Fernet,
        runner: Runner,
        enabled_of: Callable[[str], bool],
        photos: PhotoStore | None = None,
        calendar: CalendarRuntime | None = None,
    ) -> None:
        self.plugin_id = plugin_id
        self._clock = clock
        self._zone_of = zone_of
        self._settings_of = settings_of
        self._sessions = sessions
        self._publish = publish
        self._http = http
        self._cipher = cipher
        self._runner = runner
        self._enabled_of = enabled_of
        self.members = MembersFacade(sessions)
        self.photos = photos
        self.calendar = CalendarFacade(plugin_id, sessions, calendar, zone_of)

    def now(self) -> datetime:
        return self._clock.now()

    def zone(self) -> ZoneInfo:
        return self._zone_of()

    def settings(self) -> dict[str, Any]:
        """This plugin's settings, coerced against its spec (secrets in the clear)."""
        return dict(self._settings_of())

    def read(self) -> AbstractAsyncContextManager[AsyncSession]:
        return self._sessions.read()

    def write(self) -> AbstractAsyncContextManager[WriteTx]:
        return self._sessions.write()

    def publish(self, event_type: str, payload: dict[str, Any] | None = None) -> None:
        """A live-update event outside a transaction (inside one, use ``tx.publish``)."""
        self._publish(event_type, payload or {})

    def http(self, *, allow_private: bool = False) -> PluginHttp:
        return PluginHttp(self._http, allow_private=allow_private)

    def encrypt(self, plaintext: str) -> str:
        return self._cipher.encrypt(plaintext.encode()).decode()

    def decrypt(self, token: str) -> str:
        try:
            return self._cipher.decrypt(token.encode()).decode()
        except InvalidToken:
            raise PluginDecryptError("stored credentials can't be read") from None

    def every(self, name: str, interval_s: float, job: Job) -> None:
        """Run ``job`` now and then every ``interval_s`` seconds, in the plugin's own task."""
        self._runner.every(name, interval_s, job)

    def spawn(self, name: str, coro: Coroutine[Any, Any, None]) -> None:
        """Background work that may run alongside the plugin's callbacks (a sync worker)."""
        self._runner.spawn(name, coro)

    def enabled(self, other_id: str) -> bool:
        return self._enabled_of(other_id)
