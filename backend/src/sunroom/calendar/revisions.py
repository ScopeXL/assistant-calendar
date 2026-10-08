"""Snapshots for Undo (PLAN §7.4): a series as it was, so a change can be reversed whole."""

from __future__ import annotations

import json
from collections.abc import Iterable
from datetime import date, datetime
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from sunroom.calendar.models import Event, EventMember, EventReminder
from sunroom.db.types import IsoDate, UTCDateTime

_COLUMNS = list(Event.__table__.columns)


def _row(event: Event) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for column in _COLUMNS:
        value = getattr(event, column.key)
        out[column.key] = value.isoformat() if isinstance(value, datetime | date) else value
    return out


def _fields(row: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for column in _COLUMNS:
        value = row.get(column.key)
        if value is not None and isinstance(column.type, UTCDateTime):
            value = datetime.fromisoformat(value)
        elif value is not None and isinstance(column.type, IsoDate):
            value = date.fromisoformat(value)
        out[column.key] = value
    return out


async def snapshot(session: AsyncSession, master_ids: Iterable[str]) -> str:
    """Each series with its overrides (removed ones too), people and reminders, as JSON."""
    series: list[dict[str, Any]] = []
    for master_id in master_ids:
        master = await session.get(Event, master_id)
        if master is None:
            continue
        overrides = list(
            (await session.scalars(select(Event).where(Event.parent_event_id == master_id))).all()
        )
        ids = [master_id, *(o.id for o in overrides)]
        members = (
            await session.execute(
                select(EventMember.event_id, EventMember.member_id).where(
                    EventMember.event_id.in_(ids)
                )
            )
        ).all()
        reminders = (
            await session.execute(
                select(EventReminder.event_id, EventReminder.minutes_before).where(
                    EventReminder.event_id.in_(ids)
                )
            )
        ).all()
        series.append(
            {
                "master": _row(master),
                "overrides": [_row(o) for o in overrides],
                "members": [[e, m] for e, m in members],
                "reminders": [[e, r] for e, r in reminders],
            }
        )
    return json.dumps(series, separators=(",", ":"))


async def _clear_children(session: AsyncSession, master_id: str) -> list[Event]:
    """Delete a series' overrides, people and reminders; returns nothing left to flush."""
    overrides = list(
        (await session.scalars(select(Event).where(Event.parent_event_id == master_id))).all()
    )
    ids = [master_id, *(o.id for o in overrides)]
    await session.execute(delete(EventMember).where(EventMember.event_id.in_(ids)))
    await session.execute(delete(EventReminder).where(EventReminder.event_id.in_(ids)))
    for override in overrides:
        await session.delete(override)
    await session.flush()
    return overrides


async def remove_series(session: AsyncSession, master_id: str) -> None:
    """Delete a series outright: its overrides, people and reminders too (Undo of an add)."""
    master = await session.get(Event, master_id)
    await _clear_children(session, master_id)
    if master is not None:
        await session.delete(master)
        await session.flush()


async def restore(session: AsyncSession, raw: str) -> list[str]:
    """Put each series back exactly as snapshotted; returns the calendars it touched."""
    calendars: list[str] = []
    for item in json.loads(raw):
        master_fields = _fields(item["master"])
        master_id = master_fields["id"]
        current = await session.get(Event, master_id)
        if current is not None:
            calendars.append(current.calendar_id)
            await _clear_children(session, master_id)
            for key, value in master_fields.items():
                setattr(current, key, value)
        else:
            session.add(Event(**master_fields))
        await session.flush()
        for row in item["overrides"]:
            session.add(Event(**_fields(row)))
        await session.flush()
        for event_id, member_id in item["members"]:
            session.add(EventMember(event_id=event_id, member_id=member_id))
        for event_id, minutes in item["reminders"]:
            session.add(EventReminder(event_id=event_id, minutes_before=minutes))
        calendars.append(master_fields["calendar_id"])
    await session.flush()
    return calendars
