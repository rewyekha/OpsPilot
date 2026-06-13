"""Monitored services endpoint (Phase 8).

Backs the dashboard's 'Monitored Services' panel. Sources its data from the
active TelemetryProvider (synthetic | azure), selected by TELEMETRY_MODE — so the
same endpoint returns fixture data locally and real Azure Monitor data when the
demo workloads are deployed.

Endpoints:
  GET /api/system/services  — health roster (name, status, last incident, response time)
"""
from __future__ import annotations

import asyncio
import time

import structlog
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services import availability
from app.telemetry.factory import get_telemetry_provider, resolve_telemetry_mode
from app.telemetry.models import HealthStatus, ServiceHealth

log = structlog.get_logger(__name__)

router = APIRouter(tags=["system"])

# ── Stale-while-revalidate cache for the (potentially slow) health roster ──────
# get_all_service_health() runs blocking KQL (list_services + one query PER
# service) — easily several seconds against live Azure. The dashboard polls this
# panel, so a cold/synchronous call froze the "Monitored Services" card for 10+s
# and blocked the event loop. We now: run it OFF the loop, bound it with a hard
# timeout, cache the result briefly, and serve the last-known roster instantly
# while a fresh one is fetched. The availability overlay is applied AFTER the
# cache on every request, so a just-declared outage shows immediately regardless
# of cache age.
_HEALTH_TTL_SECONDS = 10.0
_HEALTH_TIMEOUT_SECONDS = 2.0
_health_cache: tuple[float, list[ServiceHealth]] | None = None
_health_lock = asyncio.Lock()


class MonitoredServicesResponse(BaseModel):
    telemetry_mode: str = Field(
        alias="telemetryMode",
        description="Active telemetry source ('synthetic' | 'azure')",
    )
    services: list[ServiceHealth]

    model_config = {"populate_by_name": True}


async def _service_health_roster() -> list[ServiceHealth]:
    """Cached, off-loop, time-bounded health roster. Never blocks the dashboard:
    on a cache miss it tries a fresh fetch for at most _HEALTH_TIMEOUT_SECONDS and
    falls back to the last-known roster (or []) on timeout/error."""
    global _health_cache
    now = time.monotonic()
    if _health_cache is not None and (now - _health_cache[0]) < _HEALTH_TTL_SECONDS:
        return _health_cache[1]

    async with _health_lock:
        now = time.monotonic()
        if _health_cache is not None and (now - _health_cache[0]) < _HEALTH_TTL_SECONDS:
            return _health_cache[1]
        provider = get_telemetry_provider()
        try:
            data = await asyncio.wait_for(
                asyncio.to_thread(provider.get_all_service_health),
                timeout=_HEALTH_TIMEOUT_SECONDS,
            )
            _health_cache = (time.monotonic(), data)
            return data
        except Exception as exc:  # noqa: BLE001 - incl. asyncio.TimeoutError
            # Serve stale on a slow/failing telemetry backend — never hang the panel.
            log.warning("system.services.refresh_degraded", error=str(exc))
            return _health_cache[1] if _health_cache is not None else []


def _apply_availability_overlay(services: list[ServiceHealth]) -> list[ServiceHealth]:
    """Force any service the control plane took offline to render UNHEALTHY/down,
    and surface a down service even if telemetry no longer reports it (a disabled
    ingress emits silence, so its last sample looks 'healthy'). In-memory and
    instant, so it reflects an outage the moment it is declared."""
    down = set(availability.down_services())
    if not down:
        return services
    by_name = {s.name: s for s in services}
    for name in down:
        by_name[name] = ServiceHealth(
            name=name,
            status=HealthStatus.UNHEALTHY,
            responseTimeMs=0.0,
            errorRatePct=100.0,
            lastIncident=availability.since(name),
            source=f"{by_name[name].source if name in by_name else 'azure'}+outage",
        )
    return list(by_name.values())


@router.get(
    "/system/services",
    response_model=MonitoredServicesResponse,
    summary="Monitored services health roster",
    description=(
        "Returns the health of every service OpsPilot monitors — service name, "
        "health status, last incident timestamp, and representative response "
        "time. Data comes from the active TelemetryProvider: deterministic "
        "fixtures when TELEMETRY_MODE=synthetic, or real Application Insights / "
        "Log Analytics telemetry when TELEMETRY_MODE=azure."
    ),
)
async def list_monitored_services() -> MonitoredServicesResponse:
    mode = resolve_telemetry_mode().value
    # Cached + off-loop + time-bounded (≤2s), then overlay forced-outage state.
    services = _apply_availability_overlay(await _service_health_roster())
    log.debug("system.services.listed", telemetry_mode=mode, count=len(services))
    return MonitoredServicesResponse(telemetryMode=mode, services=services)


@router.get(
    "/system/monitor",
    summary="Autonomous incident-detection monitor status",
    description=(
        "Status of the background monitor that scans Azure telemetry and "
        "auto-creates + auto-investigates incidents. Drives the dashboard's "
        "'Autonomous Detection' indicator."
    ),
)
async def monitor_status() -> dict:
    from app.services.incident_monitor import get_incident_monitor

    return get_incident_monitor().status()
