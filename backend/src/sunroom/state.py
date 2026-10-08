"""Everything the running app holds in memory, plus the FastAPI dependency that hands it out.

All of it is correct only because exactly one process serves the API (PLAN §5.1).
"""

from __future__ import annotations

import asyncio
from collections import OrderedDict, deque
from dataclasses import dataclass, field
from datetime import datetime
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import Depends, Request

from sunroom.auth.ratelimit import FailureLimiter
from sunroom.auth.sessions import AuthState, GrantCodec, SessionCodec
from sunroom.core.clock import Clock
from sunroom.core.config import Settings
from sunroom.core.http import GuardedHttp
from sunroom.core.jobs import Jobs
from sunroom.db.backup import BackupService
from sunroom.db.engine import Database
from sunroom.events.hub import EventHub
from sunroom.photos.store import PhotoStore
from sunroom.plugins.manager import PluginManager

RECENT_HOSTS = 12


@dataclass
class HouseholdCache:
    """The few household values read on almost every request, refreshed when they change."""

    zone: ZoneInfo
    setup_complete: bool = False
    password_set: bool = False
    members: set[str] = field(default_factory=set[str])  # active member ids


@dataclass
class AppState:
    settings: Settings
    clock: Clock
    secret: str
    db: Database
    hub: EventHub
    auth: AuthState
    codec: SessionCodec
    grants: GrantCodec
    login_limiter: FailureLimiter
    pin_limiter: FailureLimiter
    backups: BackupService
    http: GuardedHttp
    photos: PhotoStore
    plugins: PluginManager
    household: HouseholdCache
    jobs: Jobs = field(default_factory=Jobs)
    # The display's pairing long-polls wait on these, keyed by the poll token's hash.
    pairing_waiters: dict[str, asyncio.Event] = field(default_factory=dict[str, asyncio.Event])
    # Photo uploads per device in the last hour (60 at most; photos/router.py).
    uploads: dict[str, deque[datetime]] = field(default_factory=dict[str, deque[datetime]])
    # Addresses this server was recently reached at (Settings → Connection), newest last.
    recent_hosts: OrderedDict[str, datetime] = field(default_factory=OrderedDict[str, datetime])
    started: bool = False

    def zone(self) -> ZoneInfo:
        return self.household.zone

    def note_host(self, host: str) -> None:
        self.recent_hosts.pop(host, None)
        self.recent_hosts[host] = self.clock.now()
        while len(self.recent_hosts) > RECENT_HOSTS:
            self.recent_hosts.popitem(last=False)


def get_state(request: Request) -> AppState:
    state: AppState = request.app.state.sunroom
    return state


StateDep = Annotated[AppState, Depends(get_state)]
