"""Incident service — TELEMETRY-DRIVEN. No seeded, mock, or demo incidents.

An incident exists only if one of these is true:
  1. Live Azure telemetry reports an anomaly  (TelemetryProvider.detect_incidents)
  2. A user explicitly created one             (POST /api/incidents)
  3. A persisted investigation record exists    (resolves a past / in-flight incident)

When telemetry is healthy and no user incident exists, get_active_incidents()
returns [] → the UI shows "No active incidents detected" rather than inventing one.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.models.incident import IncidentRecord, IncidentSeverity, IncidentStatus
from app.services import investigation_store
from app.telemetry.factory import get_telemetry_provider

# Explicitly user-created incidents (POST /api/incidents). In-memory; NEVER seeded.
_USER_INCIDENTS: dict[str, IncidentRecord] = {}

_SEVERITY = {
    "P0": IncidentSeverity.P0,
    "P1": IncidentSeverity.P1,
    "P2": IncidentSeverity.P2,
    "P3": IncidentSeverity.P3,
}


def _detected_id(service: str) -> str:
    """Stable incident id for a telemetry-detected anomaly on a service."""
    return f"INC-{service}"


def _from_detected(d) -> IncidentRecord:
    now = datetime.now(timezone.utc)
    return IncidentRecord(
        id=_detected_id(d.service),
        description=d.summary or d.title,
        status=IncidentStatus.INVESTIGATING,
        severity=_SEVERITY.get(getattr(d, "severity", "P2"), IncidentSeverity.P2),
        affected_services=[d.service],
        reporter="azure-telemetry",
        created_at=now,
        updated_at=now,
        resolved_at=None,
        langgraph_run_id=None,
        error_rate_pct=None,
    )


def register_user_incident(incident: IncidentRecord) -> None:
    """Record an explicitly user-created incident (POST /api/incidents)."""
    _USER_INCIDENTS[incident.id] = incident


def _detected_incidents() -> list[IncidentRecord]:
    """Telemetry-detected incidents. Empty (never fabricated) if telemetry is
    healthy or unavailable."""
    try:
        provider = get_telemetry_provider()
        return [_from_detected(d) for d in provider.detect_incidents()]
    except Exception:
        return []


async def get_active_incidents() -> list[IncidentRecord]:
    detected = _detected_incidents()
    seen = {i.id for i in detected}
    user_open = [
        i
        for i in _USER_INCIDENTS.values()
        if i.id not in seen and i.status in (IncidentStatus.OPEN, IncidentStatus.INVESTIGATING)
    ]
    return detected + user_open


async def get_incident_by_id(incident_id: str) -> IncidentRecord | None:
    # 1. Live telemetry-detected anomaly
    for inc in _detected_incidents():
        if inc.id == incident_id:
            return inc
    # 2. Explicitly user-created
    if incident_id in _USER_INCIDENTS:
        return _USER_INCIDENTS[incident_id]
    # 3. A persisted investigation record (so a past / in-flight incident still resolves)
    rec = investigation_store.latest(incident_id)
    if rec is not None:
        now = datetime.now(timezone.utc)
        return IncidentRecord(
            id=incident_id,
            description=rec.description,
            status=IncidentStatus.INVESTIGATING,
            severity=_SEVERITY.get(getattr(rec, "severity", "") or "", IncidentSeverity.P2),
            affected_services=[],
            reporter="investigation-store",
            created_at=now,
            updated_at=now,
            resolved_at=None,
            langgraph_run_id=rec.id,
            error_rate_pct=None,
        )
    return None
