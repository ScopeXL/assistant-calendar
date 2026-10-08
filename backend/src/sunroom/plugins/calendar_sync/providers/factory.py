"""The factory the engine makes providers with: an account and its secrets → its provider."""

from __future__ import annotations

import json
from typing import Any

from sunroom.plugins.calendar_sync.models import Provider, SyncAccount
from sunroom.plugins.calendar_sync.providers.base import CalendarProvider, ErrorKind, SyncError
from sunroom.plugins.calendar_sync.providers.fake import FAKE_REMOTES, FakeProvider, FakeRemote
from sunroom.plugins.calendar_sync.providers.holidays import HolidaysProvider
from sunroom.plugins.calendar_sync.providers.ics import IcsProvider
from sunroom.plugins.context import PluginContext

RECONNECT = "Sunroom needs this account's password again. Connect it again."


def make_factory(ctx: PluginContext, extra: dict[str, Any] | None = None) -> Any:
    """The engine's ProviderFactory: an account and its secrets → its provider."""
    more = extra or {}

    def make(account: SyncAccount, secrets: dict[str, Any]) -> CalendarProvider:
        config: dict[str, Any] = json.loads(account.config_json or "{}")
        http = ctx.http(allow_private=account.allow_private)
        if account.provider == Provider.ICS:
            if "url" not in secrets:
                raise SyncError(ErrorKind.AUTH, "Paste this calendar's address again.")
            return IcsProvider(http, str(secrets["url"]), account.label, ctx.zone)
        if account.provider == Provider.HOLIDAYS:
            return HolidaysProvider(
                str(config.get("country", "")), config.get("subdivision"), ctx.now
            )
        if account.provider == Provider.FAKE and ctx.test_mode:
            return FakeProvider(FAKE_REMOTES.setdefault(account.id, FakeRemote()))
        if account.provider in more:
            return more[account.provider](account, secrets, config, http)
        raise SyncError(ErrorKind.BAD_DATA, "Sunroom can't sync this kind of account.")

    return make
