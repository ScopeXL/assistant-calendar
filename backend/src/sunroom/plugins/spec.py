"""A plugin's settings, described once (PLAN §6.2): the frontend renders a form from these
fields, and every read and write is coerced against them.

``ParamField`` and ``coerce_params`` follow an earlier project's strategy settings, with more
types. A ``secret`` is write-only: it reads back as ``***``, and writing ``***`` back keeps
the stored value.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from typing import Any, Literal, cast

FieldType = Literal[
    "int",
    "float",
    "bool",
    "string",
    "text",
    "secret",
    "percent",
    "choice",
    "multichoice",
    "time",
    "date",
    "color",
    "member",
    "calendar",
    "latlon",
    "json",
]
MASK = "***"
_TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
COLORS = ("clay", "olive", "moss", "sea", "sky", "iris", "berry", "rose")


@dataclass(frozen=True, slots=True)
class ParamField:
    key: str
    label: str
    type: FieldType
    help: str = ""
    default: Any = None
    required: bool = False
    min: float | None = None
    max: float | None = None
    step: float | None = None
    unit: str | None = None
    group: str = ""
    choices: tuple[str, ...] | None = None
    # Shown as plain words next to each choice (choices are machine values).
    choice_labels: tuple[str, ...] | None = None
    max_length: int | None = None

    def describe(self) -> dict[str, Any]:
        """The JSON the settings form is rendered from. A secret's default never leaves."""
        return {
            "key": self.key,
            "label": self.label,
            "type": self.type,
            "help": self.help,
            "default": None if self.type == "secret" else self.default,
            "required": self.required,
            "min": self.min,
            "max": self.max,
            "step": self.step,
            "unit": self.unit,
            "group": self.group,
            "choices": list(self.choices) if self.choices is not None else None,
            "choice_labels": list(self.choice_labels) if self.choice_labels is not None else None,
            "max_length": self.max_length,
        }


def coerce_params(
    spec: tuple[ParamField, ...], raw: dict[str, Any], *, previous: dict[str, Any] | None = None
) -> tuple[dict[str, Any], list[str]]:
    """Type-coerce submitted settings against the spec.

    Unknown keys are refused (a typo must not silently do nothing); missing keys take the
    spec's default; problems collect into the error list (422 upstream). ``previous`` supplies
    the stored value for a secret sent back masked.
    """
    errors: list[str] = []
    known = {field.key: field for field in spec}
    for key in raw:
        if key not in known:
            errors.append(f"unknown setting {key!r}")
    out: dict[str, Any] = {}
    for field in spec:
        value = raw.get(field.key, field.default)
        if field.type == "secret" and value == MASK:
            value = (previous or {}).get(field.key)
        if value is None or value == "":
            if field.required:
                errors.append(f"{field.label} is required")
            out[field.key] = None
            continue
        try:
            value = _coerce_one(field, value)
        except (TypeError, ValueError) as exc:
            errors.append(f"{field.label}: {exc}")
            continue
        if isinstance(value, int | float) and not isinstance(value, bool):
            if field.min is not None and value < field.min:
                errors.append(f"{field.label} must be at least {field.min:g}")
            if field.max is not None and value > field.max:
                errors.append(f"{field.label} must be at most {field.max:g}")
        if (
            isinstance(value, str)
            and field.max_length is not None
            and len(value) > field.max_length
        ):
            errors.append(f"{field.label} must be {field.max_length} characters or fewer")
        out[field.key] = value
    return out, errors


def masked(spec: tuple[ParamField, ...], values: dict[str, Any]) -> dict[str, Any]:
    """Settings as the API returns them: secrets that are set read as ``***``."""
    secret_keys = {field.key for field in spec if field.type == "secret"}
    return {
        key: (MASK if key in secret_keys and value not in (None, "") else value)
        for key, value in values.items()
    }


def defaults(spec: tuple[ParamField, ...]) -> dict[str, Any]:
    return {field.key: field.default for field in spec}


def _coerce_one(field: ParamField, value: Any) -> Any:
    kind = field.type
    if kind == "int":
        if isinstance(value, bool):
            raise TypeError("expected a whole number")
        number = float(value)
        if not number.is_integer():
            raise ValueError("expected a whole number")
        return int(number)
    if kind in ("float", "percent"):
        if isinstance(value, bool):
            raise TypeError("expected a number")
        return float(value)
    if kind == "bool":
        if isinstance(value, bool):
            return value
        raise TypeError("expected on or off")
    if kind in ("string", "text", "secret", "member", "calendar"):
        if not isinstance(value, str):
            raise TypeError("expected text")
        text = value.strip() if kind != "text" else value
        if kind != "text" and "\n" in text:
            raise ValueError("must be one line")
        return text
    if kind == "choice":
        if not isinstance(value, str) or field.choices is None or value not in field.choices:
            raise ValueError("isn't one of the choices")
        return value
    if kind == "multichoice":
        if not isinstance(value, list):
            raise TypeError("expected a list of choices")
        items = [str(item) for item in cast("list[Any]", value)]
        if field.choices is None or any(item not in field.choices for item in items):
            raise ValueError("has something that isn't one of the choices")
        return list(dict.fromkeys(items))
    if kind == "time":
        if not isinstance(value, str) or not _TIME.match(value):
            raise ValueError("expected a time like 07:30")
        return value
    if kind == "date":
        if not isinstance(value, str):
            raise TypeError("expected a date like 2026-10-07")
        return date.fromisoformat(value).isoformat()
    if kind == "color":
        if value not in COLORS:
            raise ValueError("isn't one of the colors")
        return str(value)
    if kind == "latlon":
        if not isinstance(value, dict):
            raise TypeError("expected a place")
        place = cast("dict[str, Any]", value)
        latitude, longitude = float(place.get("lat", "x")), float(place.get("lon", "x"))
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            raise ValueError("isn't a place on Earth")
        label = str(place.get("label", ""))[:120]
        return {"lat": round(latitude, 4), "lon": round(longitude, 4), "label": label}
    if kind == "json":
        if isinstance(value, dict | list):
            return cast("dict[str, Any] | list[Any]", value)
        raise TypeError("expected a JSON object or list")
    raise TypeError(f"unhandled field type {kind}")
