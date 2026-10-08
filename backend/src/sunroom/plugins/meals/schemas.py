"""The meals API's shapes (PLAN §11.3, UX §4 "Meals room", §5 "Meals")."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

SlotName = Literal["breakfast", "lunch", "dinner", "snack"]
MealText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Emoji = Annotated[str, StringConstraints(strip_whitespace=True, max_length=16)]
Url = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
Note = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]
Ingredient = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class EntryOut(BaseModel):
    id: str
    day: date
    slot: SlotName
    position: int
    text: str
    emoji: str | None
    recipe_url: str | None
    note: str | None
    member_id: str | None  # who cooks
    saved_meal_id: str | None
    ingredients: list[str]  # its saved meal's, for "Add ingredients to Groceries"
    created_by_member_id: str | None
    updated_at: datetime


class MealWeekOut(BaseModel):
    start: date
    days: int  # how many days from start (7 for a week, 1 for Tonight)
    slots: list[SlotName]  # the slots the household uses, in the day's order (settings)
    entries: list[EntryOut]  # by day, then slot, then position


class EntryIn(BaseModel):
    """PUT meals/entries: with an id, that entry changes (its day and slot too); without one, it
    goes into the spot (day, slot, position) and replaces what's there, if anything. A new text
    is kept as a saved meal (or counts one more use of the saved meal with that name)."""

    id: str | None = None
    day: date
    slot: SlotName = "dinner"
    position: int = Field(default=0, ge=0, le=9)
    text: MealText
    emoji: Emoji | None = None
    recipe_url: Url | None = None
    note: Note | None = None
    member_id: str | None = None
    saved_meal_id: str | None = None  # picked from Saved meals: its emoji and link come along


class EntrySaved(BaseModel):
    """What PUT meals/entries did: the entry now, and what it replaced in that spot (for Undo:
    put the replaced one back)."""

    entry: EntryOut
    replaced: EntryOut | None


class MealMoveIn(BaseModel):
    """Move an entry to another day (and slot); one already there takes this one's place
    ("Swap days")."""

    day: date
    slot: SlotName | None = None  # None: the same slot


class MealMoveOut(BaseModel):
    moved: EntryOut
    swapped: EntryOut | None  # the one that was there, now in the moved one's old spot


class CopyWeekIn(BaseModel):
    """Copy a week's meals into another week (both the first day of a week). Spots already
    filled in the target week are kept."""

    from_start: date
    to_start: date


class CopyWeekOut(BaseModel):
    ids: list[str]  # the entries made, for Undo (DELETE each)
    skipped: int  # spots already filled


class SavedMealOut(BaseModel):
    id: str
    text: str
    emoji: str | None
    recipe_url: str | None
    ingredients: list[str]
    use_count: int  # "made 6 times"
    last_used_at: datetime | None


class SavedMealIn(BaseModel):
    text: MealText
    emoji: Emoji | None = None
    recipe_url: Url | None = None
    ingredients: list[Ingredient] = Field(default_factory=list[str], max_length=50)


class SavedMealPatch(BaseModel):
    """Only what's sent changes; an empty emoji or link clears it."""

    text: MealText | None = None
    emoji: Emoji | None = None
    recipe_url: Url | None = None
    ingredients: list[Ingredient] | None = Field(default=None, max_length=50)


class RemovedEntryOut(BaseModel):
    id: str
    day: date
    slot: SlotName
    text: str
    deleted_at: datetime


class RemovedSavedOut(BaseModel):
    id: str
    text: str
    deleted_at: datetime


class MealsRemovedOut(BaseModel):
    """Recently removed (7 days): entries taken off a day, and saved meals archived."""

    entries: list[RemovedEntryOut]
    saved: list[RemovedSavedOut]


SLOT_ORDER: tuple[SlotName, ...] = ("breakfast", "lunch", "dinner", "snack")
