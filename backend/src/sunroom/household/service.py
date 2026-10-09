from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sunroom.core.config import Settings
from sunroom.core.errors import AppError
from sunroom.household.models import (
    PERSON_COLOR_WORDS,
    PERSON_COLORS,
    Household,
    KioskPanel,
    Member,
)
from sunroom.household.schemas import KioskPanelOut, MemberOut, SettingsOut


def avatar_url(photo_id: str | None) -> str | None:
    # An avatar's file never changes for its id (a new picture is a new id): cacheable forever.
    return f"/photos/avatars/{photo_id}.webp" if photo_id else None


def member_out(member: Member) -> MemberOut:
    return MemberOut.model_validate(
        {
            "id": member.id,
            "name": member.name,
            "role": member.role,
            "color": member.color,
            "color_word": PERSON_COLOR_WORDS.get(member.color, member.color),
            "birthday": member.birthday,
            "avatar_url": avatar_url(member.avatar_photo_id),
            "archived": member.archived_at is not None,
        }
    )


async def household(session: AsyncSession) -> Household:
    row = await session.get(Household, 1)
    if row is None:  # the baseline migration always creates it
        raise AppError(500, "server_error", "Household settings are missing.")
    return row


def valid_zone(name: str | None) -> ZoneInfo | None:
    if not name:
        return None
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError, ValueError:
        return None


def effective_zone(home: Household, settings: Settings) -> ZoneInfo:
    """The household's own zone, else the TZ override, else UTC (PLAN §14.2)."""
    return valid_zone(home.timezone) or settings.env_zone or ZoneInfo("UTC")


def settings_out(home: Household, settings: Settings) -> SettingsOut:
    return SettingsOut.model_validate(
        {
            "household_name": home.name,
            "timezone": effective_zone(home, settings).key,
            "timezone_chosen": valid_zone(home.timezone) is not None,
            "week_starts_on": home.week_starts_on,
            "time_format": home.time_format,
            "theme": home.theme,
            "daylight_tint": home.daylight_tint,
            "text_size": home.text_size,
            "display_home_view": home.display_home_view,
            "display_return_minutes": home.display_return_minutes,
            "display_rail_side": home.display_rail_side,
            "display_controls_bottom": home.display_controls_bottom,
            "display_show_today_panel": home.display_show_today_panel,
            "display_orientation": home.display_orientation,
            "display_sounds": home.display_sounds,
            "display_dim_past": home.display_dim_past,
            "display_reduce_motion": home.display_reduce_motion,
            "display_week_layout": home.display_week_layout,
            "show_tips": home.show_tips,
            "sleep_from": home.sleep_from,
            "sleep_to": home.sleep_to,
            "sleep_mode": home.sleep_mode,
            "dim_from": home.dim_from,
            "dim_level": home.dim_level,
            "update_check": home.update_check and not settings.update_check_forced_off,
            "update_check_locked": settings.update_check_forced_off,
            "kid_safe_editing": home.kid_safe_editing,
            "has_pin": home.parent_pin_hash is not None,
            "pin_length": home.pin_length if home.parent_pin_hash else None,
            "location_label": home.location_label,
            "latitude": home.latitude,
            "longitude": home.longitude,
            "setup_complete": home.onboarded_at is not None,
        }
    )


async def active_members(session: AsyncSession) -> list[Member]:
    result = await session.scalars(
        select(Member).where(Member.archived_at.is_(None)).order_by(Member.sort, Member.created_at)
    )
    return list(result)


async def get_member(session: AsyncSession, member_id: str) -> Member:
    member = await session.get(Member, member_id)
    if member is None:
        raise AppError(404, "not_found", "That person isn't in this household.")
    return member


def next_color(used: list[str]) -> str:
    for color in PERSON_COLORS:
        if color not in used:
            return color
    return PERSON_COLORS[len(used) % len(PERSON_COLORS)]


async def create_member(
    session: AsyncSession,
    *,
    name: str,
    role: str,
    color: str | None,
    birthday: date | None,
    now: datetime,
) -> Member:
    members = await active_members(session)
    if any(member.name.casefold() == name.casefold() for member in members):
        raise AppError(409, "name_taken", "That name is already in use. Pick another.")
    member = Member(
        name=name,
        role=role,
        color=color or next_color([m.color for m in members]),
        birthday=birthday,
        sort=max((m.sort for m in members), default=-1) + 1,
        created_at=now,
    )
    session.add(member)
    await session.flush()
    return member


async def archive_member(session: AsyncSession, member_id: str, now: datetime) -> Member:
    member = await get_member(session, member_id)
    member.archived_at = now
    return member


async def restore_member(session: AsyncSession, member_id: str) -> Member:
    member = await get_member(session, member_id)
    member.archived_at = None
    return member


async def kiosk_panels(session: AsyncSession) -> list[KioskPanelOut]:
    rows = await session.scalars(select(KioskPanel).order_by(KioskPanel.position))
    return [
        KioskPanelOut.model_validate(
            {
                "key": row.panel_key,
                "position": row.position,
                "visible": row.visible,
                "size": row.size,
            }
        )
        for row in rows
    ]
