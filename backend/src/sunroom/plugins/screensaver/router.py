"""The screensaver plugin's routes, under /api/screensaver (PLAN §11.3). Every route answers 404
plugin_disabled while the plugin is off (the framework gates them).

Any signed-in device reads the manifest (the wall shows it; a phone's More → Photos starts it with
core's ``POST /api/kiosk/command``). Where photos come from is a parent's business: the sources
live behind the PIN in Settings → Screensaver. Static addresses come before ``/{source_id}`` ones.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter

from sunroom.auth.deps import ActorDep, ParentDep
from sunroom.core.errors import AppError
from sunroom.plugins.context import PluginContext
from sunroom.plugins.screensaver import service
from sunroom.plugins.screensaver.schemas import ManifestOut, ScanOut, SourceOut, SourcePatch

if TYPE_CHECKING:
    from sunroom.plugins.screensaver.plugin import Screensaver


def build(router: APIRouter, plugin: Screensaver) -> None:
    def ctx() -> PluginContext:
        if plugin.ctx is None:
            raise AppError(503, "starting", "Photos are still starting. Try again.")
        return plugin.ctx

    @router.get("/manifest")
    async def get_manifest(actor: ActorDep) -> ManifestOut:  # pyright: ignore[reportUnusedFunction]
        return await service.manifest(ctx())

    @router.get("/sources")
    async def get_sources(actor: ParentDep) -> list[SourceOut]:  # pyright: ignore[reportUnusedFunction]
        return await service.sources(ctx())

    @router.patch("/sources/{source_id}")
    async def patch_source(  # pyright: ignore[reportUnusedFunction]
        source_id: str, body: SourcePatch, actor: ParentDep
    ) -> SourceOut:
        return await service.update_source(ctx(), source_id, body)

    @router.post("/sources/{source_id}/scan")
    async def scan_source(source_id: str, actor: ParentDep) -> ScanOut:  # pyright: ignore[reportUnusedFunction]
        return await service.scan_source(ctx(), source_id)
