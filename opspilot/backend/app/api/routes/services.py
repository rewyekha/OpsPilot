"""Monitored services endpoint (Phase 8).

Backs the dashboard's 'Monitored Services' panel. Sources its data from the
active TelemetryProvider (synthetic | azure), selected by TELEMETRY_MODE — so the
same endpoint returns fixture data locally and real Azure Monitor data when the
demo workloads are deployed.

Endpoints:
  GET /api/system/services  — health roster (name, status, last incident, response time)
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.telemetry.factory import get_telemetry_provider, resolve_telemetry_mode
from app.telemetry.models import ServiceHealth

log = structlog.get_logger(__name__)

router = APIRouter(tags=["system"])


class MonitoredServicesResponse(BaseModel):
    telemetry_mode: str = Field(
        alias="telemetryMode",
        description="Active telemetry source ('synthetic' | 'azure')",
    )
    services: list[ServiceHealth]

    model_config = {"populate_by_name": True}


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
    provider = get_telemetry_provider()
    mode = resolve_telemetry_mode().value
    try:
        services = provider.get_all_service_health()
    except Exception as exc:  # pragma: no cover - azure path resilience
        # Never let a telemetry hiccup take down the dashboard panel.
        log.error("system.services.failed", error=str(exc), telemetry_mode=mode)
        services = []

    log.info("system.services.listed", telemetry_mode=mode, count=len(services))
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
