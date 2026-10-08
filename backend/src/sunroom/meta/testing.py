"""Test-only endpoints (PLAN §11.1): mounted only with SUNROOM_TEST_MODE=1, which is refused
inside the container, and answering only requests from this machine (end-to-end runs and
``just seed``). Synthetic data only.
"""

from __future__ import annotations

import asyncio
import ipaddress
import shutil
from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import delete, update

from sunroom.auth.models import Device, JoinCode
from sunroom.auth.password import hash_password, hash_pin
from sunroom.auth.sessions import pin_epoch_of
from sunroom.core.clock import ShiftableClock
from sunroom.core.errors import AppError
from sunroom.household import service as household_service
from sunroom.household.models import AppMeta, Household, KioskPanel, Member, NetworkAllowEntry
from sunroom.photos.models import Photo
from sunroom.state import AppState, StateDep

E2E_PASSWORD = "e2e-household-passphrase"  # noqa: S105 - synthetic, also in .gitleaks.toml


def _local_only(request: Request) -> None:
    host = request.client.host if request.client else ""
    try:
        loopback = ipaddress.ip_address(host).is_loopback
    except ValueError:
        loopback = host in {"testclient", "localhost"}
    if not loopback:
        raise AppError(404, "not_found", "That couldn't be found.")


router = APIRouter(
    prefix="/api/_test", include_in_schema=False, dependencies=[Depends(_local_only)]
)


@router.post("/reset", status_code=204)
async def reset(state: StateDep) -> None:
    """Back to a server that has never been set up."""
    async with state.db.write() as tx:
        for model in (JoinCode, Device, NetworkAllowEntry, KioskPanel):
            await tx.session.execute(delete(model))
        await tx.session.execute(update(Member).values(avatar_photo_id=None))
        await tx.session.execute(delete(Member))
        await tx.session.execute(delete(Photo))
        await tx.session.execute(delete(Household))
        tx.session.add(Household(id=1, name="Our home", updated_at=state.clock.now()))
        tx.session.add(KioskPanel(panel_key="calendar.today", position=0, visible=True, size="m"))
        await tx.session.execute(
            update(AppMeta).values(password_hash=None, auth_epoch=AppMeta.auth_epoch + 1)
        )
        meta = await tx.session.get(AppMeta, 1)
        epoch = meta.auth_epoch if meta else state.auth.epoch + 1
    if isinstance(state.clock, ShiftableClock):
        state.clock.reset()
    await asyncio.to_thread(shutil.rmtree, state.photos.root, True)
    state.photos.ensure_folders()
    state.auth.epoch = epoch
    state.auth.devices.clear()
    state.auth.revoked_devices.clear()
    state.auth.last_seen_written.clear()
    state.auth.has_pin = False
    state.auth.pin_epoch = 0
    state.login_limiter.reset()
    state.pin_limiter.reset()
    state.uploads.clear()
    state.household.setup_complete = False
    state.household.password_set = state.settings.app_password is not None
    state.household.members.clear()
    state.household.zone = household_service.effective_zone(
        Household(timezone=None), state.settings
    )
    state.hub.drop_all()


@router.post("/drop-streams", status_code=204)
async def drop_streams(state: StateDep) -> None:
    state.hub.drop_all()


@router.post("/revoke-sessions", status_code=204)
async def revoke_sessions(state: StateDep) -> None:
    async with state.db.write() as tx:
        await tx.session.execute(update(AppMeta).values(auth_epoch=AppMeta.auth_epoch + 1))
        meta = await tx.session.get(AppMeta, 1)
        epoch = meta.auth_epoch if meta else state.auth.epoch + 1
    state.auth.epoch = epoch


class ClockIn(BaseModel):
    set: datetime | None = None  # timezone-aware
    advance_minutes: float | None = None
    reset: bool = False


@router.post("/clock", status_code=204)
async def move_clock(body: ClockIn, state: StateDep) -> None:
    clock = state.clock
    if not isinstance(clock, ShiftableClock):
        raise AppError(409, "clock_fixed", "This server's clock can't be moved.")
    if body.reset:
        clock.reset()
    if body.set is not None:
        clock.set(body.set)
    if body.advance_minutes is not None:
        clock.advance(minutes=body.advance_minutes)


class SeedIn(BaseModel):
    profile: Literal["sample-family"] = "sample-family"
    password: Annotated[str, Field(min_length=12, max_length=256)] = E2E_PASSWORD
    pin: Annotated[str, Field(pattern=r"^\d{4,6}$")] | None = None
    timezone: str = "America/New_York"


SAMPLE_FAMILY: tuple[tuple[str, str, str, date | None], ...] = (
    ("Ana", "parent", "sea", date(1988, 4, 12)),
    ("Sam", "parent", "sky", None),
    ("Mia", "kid", "rose", date(2017, 10, 19)),
    ("Leo", "kid", "moss", date(2020, 2, 3)),
)


@router.post("/seed", status_code=204)
async def seed(body: SeedIn, state: StateDep) -> None:
    """The synthetic "Sample Family" (`just seed`, screenshots, end-to-end runs): set up, four
    people, an optional PIN. Later milestones add calendars, chores, lists and photos."""
    await _seed(state, body)


async def _seed(state: AppState, body: SeedIn) -> None:
    zone = household_service.valid_zone(body.timezone)
    if zone is None:
        raise AppError(422, "invalid", "Unknown time zone.")
    now = state.clock.now()
    password_hash = await asyncio.to_thread(hash_password, body.password)
    pin_hash = await asyncio.to_thread(hash_pin, body.pin) if body.pin else None
    async with state.db.write() as tx:
        home = await household_service.household(tx.session)
        home.name = "Sample Family"
        home.timezone = zone.key
        home.onboarded_at = home.onboarded_at or now
        home.parent_pin_hash = pin_hash
        home.pin_length = len(body.pin) if body.pin else None
        home.pin_updated_at = now if pin_hash else None
        meta = await tx.session.get(AppMeta, 1)
        assert meta is not None
        meta.password_hash = password_hash
        existing = {member.name for member in await household_service.active_members(tx.session)}
        for sort, (name, role, color, birthday) in enumerate(SAMPLE_FAMILY):
            if name not in existing:
                tx.session.add(
                    Member(
                        name=name,
                        role=role,
                        color=color,
                        birthday=birthday,
                        sort=sort,
                        created_at=now,
                    )
                )
        tx.publish("settings.changed", {"area": "seed"})
        tx.publish("members.changed")
    state.household.setup_complete = True
    state.household.password_set = True
    state.household.zone = zone
    state.auth.has_pin = pin_hash is not None
    state.auth.pin_epoch = pin_epoch_of(pin_hash)
    async with state.db.read() as db:
        state.household.members = {m.id for m in await household_service.active_members(db)}
