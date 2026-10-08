"""Helpers shared by the Download everything and restore tests: the synthetic Sample Family
with an event, a list and photos (flat colors), and the zip fetched the way a phone does."""

from __future__ import annotations

from dataclasses import dataclass, field
from zoneinfo import ZoneInfo

import httpx
from fastapi import FastAPI

from sunroom.photos.models import PhotoKind
from tests.support import CSRF, add_member, picture, state_of

NY = ZoneInfo("America/New_York")
FULL_ZIP = "/api/admin/backups/full.zip"


@dataclass
class Seeded:
    list_id: str = ""
    library: list[str] = field(default_factory=list[str])  # photo ids
    avatars: list[str] = field(default_factory=list[str])

    def photo_names(self) -> list[str]:
        """Every photo file's name in the zip."""
        return sorted(
            [f"photos/library/{photo_id}.webp" for photo_id in self.library]
            + [f"photos/thumbs/{photo_id}.webp" for photo_id in self.library]
            + [f"photos/avatars/{photo_id}.webp" for photo_id in self.avatars]
        )


async def seed_household(app: FastAPI, parent: httpx.AsyncClient, *, photos: int = 3) -> Seeded:
    """Ana and Mia, a Dentist event, Groceries with Milk and Eggs, ``photos`` library photos and
    one avatar."""
    seeded = Seeded()
    await add_member(parent, "Ana")
    await add_member(parent, "Mia", "kid")
    event = await parent.post(
        "/api/calendar/events",
        json={"title": "Dentist", "start": "2026-10-08T16:00", "end": "2026-10-08T17:00"},
        headers=CSRF,
    )
    assert event.status_code == 201, event.text
    made = await parent.post("/api/lists", json={"name": "Groceries"}, headers=CSRF)
    assert made.status_code == 201, made.text
    seeded.list_id = made.json()["id"]
    items = await parent.post(
        f"/api/lists/{seeded.list_id}/items",
        json={"items": [{"text": "Milk"}, {"text": "Eggs"}]},
        headers=CSRF,
    )
    assert items.status_code == 201, items.text
    state = state_of(app)
    async with state.db.write() as tx:
        for n in range(photos):
            photo = await state.photos.ingest(
                tx.session,
                picture((40 + n, 30)),  # a different size each: the same bytes are one photo
                kind=PhotoKind.LIBRARY,
                zone=NY,
                now=state.clock.now(),
            )
            seeded.library.append(photo.id)
        avatar = await state.photos.ingest(
            tx.session, picture((60, 60)), kind=PhotoKind.AVATAR, zone=NY, now=state.clock.now()
        )
        seeded.avatars.append(avatar.id)
    return seeded


async def download_everything(client: httpx.AsyncClient) -> bytes:
    response = await client.get(FULL_ZIP)
    assert response.status_code == 200, response.text
    return response.content
