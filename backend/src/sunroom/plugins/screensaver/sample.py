"""The Sample Family's photos (test mode only: ``just seed``, screenshots, end-to-end runs).

Eight calm, made-up scenes painted with Pillow as the seed runs: a sunrise, sea and sky, green
hills, a lake at dusk, a night sky, autumn colors, snow and pines, and a tall one of misty peaks.
No picture files live in the repo and nothing is random, so the bytes come out the same every
time and a second seed adds nothing (the photo store knows each picture by its SHA-256). They go
into the library as if a phone had uploaded them; the sunrise goes in last, so it's the newest.
"""

from __future__ import annotations

import asyncio
import hashlib
import io
import itertools
import math
from collections.abc import Callable, Iterator, Sequence

from PIL import Image, ImageDraw, ImageFilter
from sqlalchemy import select

from sunroom.photos.models import Photo, PhotoKind
from sunroom.plugins.context import PluginContext

Color = tuple[int, int, int]
Stops = Sequence[tuple[float, Color]]  # (where, 0 to 1; the color there)
Wave = tuple[float, float, float]  # (height as a share of the picture's, cycles across, phase)
Size = tuple[int, int]
Outline = list[tuple[float, float]]
WIDE: Size = (1600, 1067)
TALL: Size = (1067, 1600)
QUALITY = 88


# ---- brushes -----------------------------------------------------------------------------------


def _mix(a: Color, b: Color, t: float) -> Color:
    return (
        round(a[0] + (b[0] - a[0]) * t),
        round(a[1] + (b[1] - a[1]) * t),
        round(a[2] + (b[2] - a[2]) * t),
    )


def _at(stops: Stops, t: float) -> Color:
    """The color ``t`` of the way through the stops."""
    if t <= stops[0][0]:
        return stops[0][1]
    for (t0, c0), (t1, c1) in itertools.pairwise(stops):
        if t <= t1:
            return _mix(c0, c1, (t - t0) / (t1 - t0) if t1 > t0 else 1.0)
    return stops[-1][1]


def _bands(draw: ImageDraw.ImageDraw, width: int, top: int, bottom: int, stops: Stops) -> None:
    """Rows from ``top`` down to ``bottom`` shaded through the stops: a sky, the sea."""
    span = max(bottom - top - 1, 1)
    for y in range(top, bottom):
        draw.line([(0, y), (width, y)], fill=_at(stops, (y - top) / span))


def _ridge(size: Size, base: float, waves: Sequence[Wave], floor: float = 1.0) -> Outline:
    """A skyline across the picture, closed along ``floor``: ``base`` and ``floor`` are shares
    of the height, and each wave adds a gentle swell."""
    width, height = size
    points: Outline = [(0.0, floor * height)]
    for x in range(0, width + 8, 8):
        swell = sum(
            amplitude * math.sin(2 * math.pi * cycles * x / width + phase)
            for amplitude, cycles, phase in waves
        )
        points.append((float(x), (base + swell) * height))
    points.append((float(width), floor * height))
    return points


def _spread(count: int) -> Iterator[tuple[float, float]]:
    """Evenly scattered points in the unit square, the same every time (the R2 sequence)."""
    for n in range(1, count + 1):
        yield (0.5 + n * 0.7548776662466927) % 1.0, (0.5 + n * 0.5698402909980532) % 1.0


def _along(count: int, start: float) -> Iterator[float]:
    """Evenly scattered points along a line, the same every time (golden-ratio steps)."""
    for n in range(count):
        yield (start + n * 0.6180339887498949) % 1.0


def _glow(image: Image.Image, center: tuple[float, float], radius: float, color: Color) -> None:
    """A soft halo of ``color`` around ``center`` (a low sun, a moon)."""
    mask = Image.new("L", image.size, 0)
    x, y = center
    ImageDraw.Draw(mask).ellipse([x - radius, y - radius, x + radius, y + radius], fill=150)
    mask = mask.filter(ImageFilter.GaussianBlur(radius * 0.6))
    image.paste(Image.new("RGB", image.size, color), (0, 0), mask)


# ---- the scenes --------------------------------------------------------------------------------


def _sunrise(size: Size) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size)
    draw = ImageDraw.Draw(image)
    sky: Stops = (
        (0.0, (44, 52, 104)),
        (0.5, (176, 112, 140)),
        (0.8, (240, 160, 116)),
        (1.0, (252, 208, 150)),
    )
    _bands(draw, width, 0, round(height * 0.7), sky)
    sun = (width * 0.6, height * 0.69)
    _glow(image, sun, width * 0.16, (255, 214, 160))
    draw = ImageDraw.Draw(image)
    radius = width * 0.055
    draw.ellipse(
        [sun[0] - radius, sun[1] - radius, sun[0] + radius, sun[1] + radius], (255, 236, 196)
    )
    far = _ridge(size, 0.69, ((0.012, 1.3, 0.4), (0.006, 4.0, 1.0)))
    draw.polygon(far, fill=(92, 62, 84))
    near = _ridge(size, 0.78, ((0.03, 0.8, 2.1), (0.008, 3.0, 0.2)))
    draw.polygon(near, fill=(52, 38, 58))
    return image


def _sea(size: Size) -> Image.Image:
    width, height = size
    horizon = round(height * 0.56)
    image = Image.new("RGB", size)
    draw = ImageDraw.Draw(image)
    _bands(draw, width, 0, horizon, ((0.0, (84, 140, 200)), (1.0, (226, 236, 244))))
    _bands(draw, width, horizon, height, ((0.0, (104, 152, 186)), (1.0, (22, 60, 98))))
    for x, y in _spread(110):
        depth = y**1.7  # the glints crowd towards the horizon
        top = horizon + 6 + depth * (height - horizon - 12)
        length = 16 + 90 * depth
        shade = _mix((214, 230, 240), (120, 168, 200), depth)
        draw.line([(x * width, top), (x * width + length, top)], fill=shade, width=2)
    return image


def _hills(size: Size) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size)
    draw = ImageDraw.Draw(image)
    _bands(
        draw,
        width,
        0,
        height,
        ((0.0, (140, 192, 232)), (0.6, (232, 240, 236)), (1.0, (232, 240, 236))),
    )
    _glow(image, (width * 0.22, height * 0.22), width * 0.07, (255, 246, 214))
    draw = ImageDraw.Draw(image)
    for base, waves, color in (
        (0.52, ((0.04, 1.1, 0.5), (0.015, 3.3, 1.7)), (156, 190, 146)),
        (0.64, ((0.05, 0.9, 2.4), (0.012, 2.7, 0.3)), (108, 158, 96)),
        (0.8, ((0.06, 0.7, 4.0), (0.01, 2.2, 1.1)), (64, 116, 64)),
    ):
        draw.polygon(_ridge(size, base, waves), fill=color)
    return image


def _lake(size: Size) -> Image.Image:
    width, height = size
    horizon = round(height * 0.55)
    image = Image.new("RGB", size)
    draw = ImageDraw.Draw(image)
    sky: Stops = ((0.0, (60, 54, 112)), (0.6, (196, 114, 130)), (1.0, (248, 178, 114)))
    water: Stops = tuple((1.0 - t, _mix(color, (24, 22, 46), 0.3)) for t, color in reversed(sky))
    _bands(draw, width, 0, horizon, sky)
    _bands(draw, width, horizon, height, water)
    share = horizon / height
    trees = _ridge(
        size, share - 0.035, ((0.01, 5.0, 0.3), (0.007, 17.0, 1.2), (0.004, 53.0, 0.5)), floor=share
    )
    draw.polygon(trees, fill=(36, 30, 54))
    mirrored = [(x, 2 * horizon - y) for x, y in trees]
    draw.polygon(mirrored, fill=(52, 42, 70))
    return image


def _night(size: Size) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size)
    draw = ImageDraw.Draw(image)
    _bands(draw, width, 0, height, ((0.0, (6, 10, 30)), (0.75, (24, 34, 74)), (1.0, (44, 56, 100))))
    for n, (x, y) in enumerate(_spread(300)):
        radius = 0.9 + (1.1 if n % 9 == 0 else 0.0) + (0.8 if n % 31 == 0 else 0.0)
        shade = 150 + (n * 37) % 106
        cx, cy = x * width, y * height * 0.78
        draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], (shade, shade, 255))
    moon = (width * 0.8, height * 0.2)
    _glow(image, moon, width * 0.06, (150, 160, 200))
    draw = ImageDraw.Draw(image)
    radius = width * 0.03
    draw.ellipse(
        [moon[0] - radius, moon[1] - radius, moon[0] + radius, moon[1] + radius], (242, 238, 222)
    )
    ground = _ridge(size, 0.86, ((0.025, 0.8, 1.4), (0.008, 3.5, 0.6)))
    draw.polygon(ground, fill=(10, 14, 26))
    return image


def _autumn(size: Size) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size)
    _bands(ImageDraw.Draw(image), width, 0, height, ((0.0, (252, 222, 160)), (1.0, (190, 104, 58))))
    leaves = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(leaves)
    palette = ((214, 92, 48), (238, 164, 62), (176, 60, 42), (246, 200, 96), (148, 84, 42))
    for n, (x, y) in enumerate(_spread(80)):
        radius = 34 + (n * 53) % 96
        cx, cy = x * width, y * height
        draw.ellipse(
            [cx - radius, cy - radius, cx + radius, cy + radius], (*palette[n % len(palette)], 120)
        )
    leaves = leaves.filter(ImageFilter.GaussianBlur(16))
    return Image.alpha_composite(image.convert("RGBA"), leaves).convert("RGB")


def _snow(size: Size) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size)
    draw = ImageDraw.Draw(image)
    ground = round(height * 0.62)
    _bands(draw, width, 0, ground, ((0.0, (178, 198, 220)), (1.0, (236, 240, 246))))
    drift = _ridge(size, 0.6, ((0.02, 0.9, 1.2), (0.008, 2.8, 0.4)))
    draw.polygon(drift, fill=(226, 232, 242))
    _bands(draw, width, ground + 24, height, ((0.0, (246, 248, 252)), (1.0, (214, 224, 238))))

    def pine(x: float, base: float, tall: float, color: Color) -> None:
        trunk = tall * 0.05
        draw.rectangle([x - trunk, base - tall * 0.12, x + trunk, base], fill=(70, 56, 48))
        for tier in range(3):
            top = base - tall + tier * tall * 0.24
            spread = tall * (0.16 + 0.07 * tier)
            bottom = top + tall * 0.42
            draw.polygon([(x, top), (x - spread, bottom), (x + spread, bottom)], fill=color)

    for n, x in enumerate(_along(16, 0.13)):
        pine(
            x * width, ground + 20 + (n % 4) * 5, height * (0.16 + (n % 3) * 0.02), (110, 138, 130)
        )
    for n, x in enumerate(_along(7, 0.41)):
        tall = height * (0.3 + (n % 3) * 0.05)
        pine(x * width, ground + height * 0.16 + (n % 2) * 18, tall, (38, 72, 60))
    return image


def _peaks(size: Size) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size)
    draw = ImageDraw.Draw(image)
    _bands(
        draw,
        width,
        0,
        height,
        ((0.0, (150, 176, 214)), (0.45, (236, 224, 214)), (1.0, (236, 224, 214))),
    )
    for base, waves, color in (
        (0.42, ((0.05, 1.4, 0.2), (0.02, 4.1, 2.0)), (184, 186, 206)),
        (0.54, ((0.06, 1.1, 1.8), (0.018, 3.6, 0.7)), (146, 154, 182)),
        (0.68, ((0.07, 0.9, 3.1), (0.016, 3.1, 2.6)), (104, 116, 148)),
        (0.84, ((0.06, 0.8, 0.9), (0.014, 2.6, 1.9)), (64, 76, 104)),
    ):
        draw.polygon(_ridge(size, base, waves), fill=color)
    return image


# The newest last: the screensaver's first photo with Shuffle off is the sunrise.
SCENES: tuple[tuple[str, Size, Callable[[Size], Image.Image]], ...] = (
    ("misty-peaks.jpg", TALL, _peaks),
    ("snow-and-pines.jpg", WIDE, _snow),
    ("autumn.jpg", WIDE, _autumn),
    ("night-sky.jpg", WIDE, _night),
    ("lake-at-dusk.jpg", WIDE, _lake),
    ("hills.jpg", WIDE, _hills),
    ("sea.jpg", WIDE, _sea),
    ("sunrise.jpg", WIDE, _sunrise),
)


def picture(paint: Callable[[Size], Image.Image], size: Size) -> bytes:
    """One scene as the JPEG a phone would send."""
    out = io.BytesIO()
    paint(size).save(out, "JPEG", quality=QUALITY)
    return out.getvalue()


async def seed(ctx: PluginContext, people: dict[str, str]) -> None:
    store = ctx.photos
    if store is None:
        return
    async with ctx.read() as session:
        known = set(
            await session.scalars(select(Photo.sha256).where(Photo.kind == PhotoKind.LIBRARY.value))
        )
    for name, size, paint in SCENES:
        data = await asyncio.to_thread(picture, paint, size)
        if hashlib.sha256(data).hexdigest() in known:
            continue
        encoded = await store.encode(data, kind=PhotoKind.LIBRARY, zone=ctx.zone())
        async with ctx.write() as tx:
            photo = await store.ingest(
                tx.session,
                data,
                kind=PhotoKind.LIBRARY,
                zone=ctx.zone(),
                now=ctx.now(),
                source_key="upload",
                original_name=name,
                encoded=encoded,
            )
            tx.publish("photos.changed", {"id": photo.id})
