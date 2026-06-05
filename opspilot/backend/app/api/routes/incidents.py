"""Incidents router.

Endpoints:
  GET  /api/incidents/active       — list all open / investigating incidents
  GET  /api/incidents/{id}         — retrieve a single incident by ID
  POST /api/incidents              — create incident and trigger live investigation
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, HTTPException, status

from app.models.incident import (
    CreateIncidentRequest,
    IncidentRecord,
    IncidentStatus,
)
from app.services import incident_service
from app.services.investigation_runner import start_investigation

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get(
    "/active",
    response_model=list[IncidentRecord],
    summary="List active incidents",
    description="Returns all incidents in OPEN or INVESTIGATING status.",
)
async def get_active_incidents() -> list[IncidentRecord]:
    incidents = await incident_service.get_active_incidents()
    log.info("incidents.active.listed", count=len(incidents))
    return incidents


@router.get(
    "/{incident_id}",
    response_model=IncidentRecord,
    summary="Get incident by ID",
    description="Retrieves a single incident record by its unique identifier.",
    responses={404: {"description": "Incident not found"}},
)
async def get_incident(incident_id: str) -> IncidentRecord:
    incident = await incident_service.get_incident_by_id(incident_id)
    if incident is None:
        log.warning("incidents.not_found", incident_id=incident_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found.",
        )
    log.info("incidents.fetched", incident_id=incident_id)
    return incident


@router.post(
    "/",
    response_model=IncidentRecord,
    status_code=status.HTTP_201_CREATED,
    summary="Create incident and trigger investigation",
    description=(
        "Creates a new incident record and immediately starts a background "
        "investigation via the InvestigationOrchestrator. The incident is "
        "available via GET /api/incidents/{id} and its SSE stream via "
        "GET /api/incidents/{id}/stream as soon as this endpoint returns."
    ),
)
async def create_incident(
    body: CreateIncidentRequest,
) -> IncidentRecord:
    now = datetime.now(timezone.utc)
    incident_id = f"INC-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    incident = IncidentRecord(
        id=incident_id,
        description=body.description,
        status=IncidentStatus.INVESTIGATING,
        severity=body.reported_severity,
        affected_services=body.affected_services,
        reporter=body.reporter,
        created_at=now,
        updated_at=now,
    )

    # Register in the in-memory index so GET /api/incidents/{id} resolves immediately
    incident_service.MOCK_INCIDENTS.append(incident)
    incident_service._INDEX[incident_id] = incident

    # Explicit user action → launch exactly one investigation (deduped by the runner).
    await start_investigation(incident_id, body.description, body.affected_services)

    log.info(
        "incidents.created",
        incident_id=incident_id,
        severity=body.reported_severity,
        affected_services=body.affected_services,
    )
    return incident


@router.post(
    "/{incident_id}/investigate",
    summary="Launch the live investigation for an incident (explicit user action)",
    description=(
        "Starts the multi-agent investigation exactly once. Repeat calls while it is "
        "running, or after it has completed, are ignored unless force=true. "
        "Subscribing to the SSE stream does NOT trigger this."
    ),
    responses={404: {"description": "Incident not found"}},
)
async def investigate_incident(incident_id: str, force: bool = False) -> dict:
    incident = await incident_service.get_incident_by_id(incident_id)
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found.",
        )
    result = await start_investigation(
        incident_id,
        getattr(incident, "description", ""),
        getattr(incident, "affected_services", []),
        force=force,
    )
    log.info("incidents.investigate", incident_id=incident_id, result=result, force=force)
    return {"incident_id": incident_id, "status": result}
