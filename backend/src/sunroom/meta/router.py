"""Health, version, diagnostics, backups and export (PLAN §11.1)."""

from __future__ import annotations

import asyncio
import ipaddress
import shutil
from typing import Any

from fastapi import APIRouter, Request, Response
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import text
from starlette.types import Receive, Scope, Send

from sunroom.auth.deps import ParentDep
from sunroom.core.errors import AppError
from sunroom.core.logging import get_logger
from sunroom.core.version import build_info
from sunroom.db import full_backup, migrate
from sunroom.db.backup import NIGHTLY_RE, NoRoomError
from sunroom.db.export import export_data
from sunroom.state import StateDep
from sunroom.web.hosts import host_name, is_ip_literal

router = APIRouter(prefix="/api", tags=["meta"])
log = get_logger(__name__)


def _phone_can_use(host: str) -> bool:
    """Loopback names reach the server only from the server itself, never from a phone."""
    name = host_name(host)
    if name == "localhost" or name.endswith(".localhost"):
        return False
    return not (is_ip_literal(name) and ipaddress.ip_address(name).is_loopback)


class VersionOut(BaseModel):
    version: str
    revision: str
    created: str | None


class HealthOut(BaseModel):
    status: str


class LiveUpdatesInfo(BaseModel):
    connections: int
    epoch: str


class ClientInfo(BaseModel):
    resolved_ip: str | None
    scheme: str
    host: str
    x_forwarded_for: str | None
    x_forwarded_proto: str | None
    trusted_proxies_configured: bool


class BackupFileOut(BaseModel):
    name: str
    bytes: int


class BackupStatusOut(BaseModel):
    directory: str
    schedule: str
    retention: str
    last_success_at: str | None
    last_error: str | None
    stale: bool
    files: list[BackupFileOut]


class BackupRunOut(BaseModel):
    file: str
    bytes: int
    seconds: float


class PluginInfo(BaseModel):
    id: str
    status: str
    error: str | None


class StorageInfo(BaseModel):
    free_bytes: int
    total_bytes: int


class DiagnosticsOut(BaseModel):
    version: str
    revision: str
    schema_revision: str | None
    install_kind: str
    timezone: str
    live_updates: LiveUpdatesInfo
    client: ClientInfo
    recent_addresses: list[str]
    backups: BackupStatusOut
    plugins: list[PluginInfo]
    storage: StorageInfo


@router.get("/health", responses={503: {"model": HealthOut}})
async def health(state: StateDep, response: Response) -> HealthOut:
    if not state.started:
        response.status_code = 503
        return HealthOut(status="starting")
    try:
        async with state.db.read() as db:
            await db.execute(text("SELECT 1"))
    except Exception:
        response.status_code = 503
        return HealthOut(status="database unavailable")
    return HealthOut(status="ok")


@router.get("/version")
async def version() -> VersionOut:
    info = build_info()
    return VersionOut(version=info.version, revision=info.revision, created=info.created)


@router.get("/admin/diagnostics")
async def diagnostics(request: Request, state: StateDep, actor: ParentDep) -> DiagnosticsOut:
    info = build_info()
    headers = request.headers
    usage = shutil.disk_usage(state.settings.data_dir)
    return DiagnosticsOut(
        version=info.version,
        revision=info.revision,
        schema_revision=migrate.current_revision(state.settings.db_path),
        install_kind=state.settings.sunroom_install_kind.value,
        timezone=state.zone().key,
        live_updates=LiveUpdatesInfo(connections=state.hub.connection_count, epoch=state.hub.epoch),
        client=ClientInfo(
            resolved_ip=request.client.host if request.client else None,
            scheme=request.url.scheme,
            host=headers.get("host", ""),
            x_forwarded_for=headers.get("x-forwarded-for"),
            x_forwarded_proto=headers.get("x-forwarded-proto"),
            trusted_proxies_configured=bool(state.settings.trusted_proxies),
        ),
        recent_addresses=[host for host in reversed(state.recent_hosts) if _phone_can_use(host)],
        backups=BackupStatusOut.model_validate(state.backups.status()),
        plugins=[
            PluginInfo(
                id=plugin_id,
                status=state.plugins.status(plugin_id).value,
                error=state.plugins.error(plugin_id),
            )
            for plugin_id in state.plugins.registry
        ],
        storage=StorageInfo(free_bytes=usage.free, total_bytes=usage.total),
    )


@router.get("/admin/backups")
async def backups(state: StateDep, actor: ParentDep) -> BackupStatusOut:
    return BackupStatusOut.model_validate(state.backups.status())


@router.post("/admin/backups/run")
async def run_backup(state: StateDep, actor: ParentDep) -> BackupRunOut:
    try:
        result = await state.backups.run_now()
    except Exception as exc:
        raise AppError(500, "backup_failed", f"The backup didn't complete: {exc}") from exc
    return BackupRunOut(file=result.path.name, bytes=result.bytes, seconds=result.seconds)


class FullBackupResponse(StreamingResponse):
    """The zip as the worker writes it. However the response ends (done, failed, or the phone
    gone away), the worker stops and the database copy goes."""

    media_type = "application/zip"

    def __init__(self, download: full_backup.FullBackupStream, filename: str) -> None:
        super().__init__(
            download.chunks(),
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Cache-Control": "no-store",
            },
        )
        self.download = download

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        try:
            await super().__call__(scope, receive, send)
        finally:
            self.download.close()


# Before /admin/backups/{name}, which would otherwise take "full.zip" as a name.
@router.get(
    "/admin/backups/full.zip",
    status_code=200,  # FastAPI would look for it in the response class's __init__
    response_class=FullBackupResponse,
    responses={507: {"description": "Not enough free space for the database copy"}},
)
async def download_everything(state: StateDep, actor: ParentDep) -> FullBackupResponse:
    """Download everything (PLAN §13.7): the database, the photos and a manifest in one zip,
    streamed as it is written."""
    now = state.clock.now()
    try:
        copy = await asyncio.to_thread(
            full_backup.make_database_copy, state.settings.db_path, state.settings.backup_dir
        )
    except NoRoomError as exc:
        raise AppError(
            507,
            "storage_full",
            "There isn't enough free space on the server to make the download. Free some space, "
            "then try again.",
        ) from exc
    except Exception as exc:
        log.error("backup.download_failed", reason=f"{type(exc).__name__}: {exc}")
        raise AppError(
            500, "backup_failed", "The download couldn't be made. Try again in a minute."
        ) from exc
    download = full_backup.FullBackupStream(
        db_copy=copy,
        photos_root=state.photos.root,
        app_version=build_info().version,
        created_at=now,
        zone=state.zone(),
    )
    return FullBackupResponse(download, full_backup.zip_name(now.astimezone(state.zone()).date()))


@router.get("/admin/backups/{name}")
async def download_backup(name: str, state: StateDep, actor: ParentDep) -> FileResponse:
    if not NIGHTLY_RE.match(name):
        raise AppError(404, "not_found", "That backup doesn't exist.")
    path = state.settings.backup_dir / name
    if not path.is_file():
        raise AppError(404, "not_found", "That backup doesn't exist.")
    return FileResponse(
        path,
        media_type="application/vnd.sqlite3",
        filename=name,
        headers={"Cache-Control": "no-store"},
    )


@router.get("/export")
async def export(state: StateDep, actor: ParentDep) -> dict[str, Any]:
    async with state.db.read() as db:
        return await export_data(
            db,
            plugins=state.plugins.registry,
            app_version=build_info().version,
            schema_revision=migrate.current_revision(state.settings.db_path),
            exported_at=state.clock.now(),
        )
