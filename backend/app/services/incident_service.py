"""Incident service — TELEMETRY-DRIVEN. No seeded, mock, or demo incidents.

An incident exists only if one of these is true:
  1. Live Azure telemetry reports an anomaly  (TelemetryProvider.detect_incidents)
  2. A user explicitly created one             (POST /api/incidents)
  3. A persisted investigation record exists    (resolves a past / in-flight incident)

When telemetry is healthy and no user incident exists, get_active_incidents()
returns [] → the UI shows "No active incidents detected" rather than inventing one.
"""
from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone

from app.models.incident import IncidentRecord, IncidentSeverity, IncidentStatus
from app.services import availability, investigation_store
from app.telemetry.factory import get_telemetry_provider

# Explicitly user-created incidents (POST /api/incidents). In-memory; NEVER seeded.
_USER_INCIDENTS: dict[str, IncidentRecord] = {}

# Short-lived cache of the last telemetry scan. In azure mode detect_incidents()
# runs blocking KQL (≈2 queries PER SERVICE) — the dashboard polls /active every
# 5s and also resolves /incidents/{id}, so without this every poll fired N+1 KQL
# round-trips synchronously on the event loop, serialising all other requests
# behind it (the "everything feels slow" symptom). The cache + thread offload
# keep the API responsive and let the poll and the autonomous monitor share one
# scan. TTL is short so newly-detected incidents still surface within seconds.
_DETECT_TTL_SECONDS = 15.0
_detect_cache: tuple[float, list[IncidentRecord]] | None = None
_detect_lock = asyncio.Lock()

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


async def _detected_incidents_cached() -> list[IncidentRecord]:
    """Telemetry-detected incidents, cached for a few seconds and run OFF the event
    loop. Concurrent callers within the TTL share one scan; the blocking KQL never
    runs on the event loop."""
    global _detect_cache
    now = time.monotonic()
    if _detect_cache is not None and (now - _detect_cache[0]) < _DETECT_TTL_SECONDS:
        return _detect_cache[1]
    async with _detect_lock:
        now = time.monotonic()
        if _detect_cache is not None and (now - _detect_cache[0]) < _DETECT_TTL_SECONDS:
            return _detect_cache[1]
        data = await asyncio.to_thread(_detected_incidents)
        _detect_cache = (time.monotonic(), data)
        return data


def _incident_service_name(inc: IncidentRecord) -> str:
    """Best-effort service name for an incident (affected service, else the
    `INC-<service>` id convention)."""
    if inc.affected_services:
        return inc.affected_services[0]
    return inc.id[4:] if inc.id.startswith("INC-") else inc.id


def _forced_outage_incident(service: str) -> IncidentRecord:
    """Build an ACTIVE incident for a control-plane-forced outage so the Active
    Incidents page surfaces the SAME incident the dashboard already shows. The
    dashboard derives it from the persisted investigation + the service-health
    overlay; without this the two screens read different stores and disagree
    (dashboard shows the incident, Active Incidents shows 0). Severity/description
    are taken from the persisted investigation record so both screens match (e.g.
    the same P0)."""
    now = datetime.now(timezone.utc)
    rec = investigation_store.latest(f"INC-{service}")
    severity = _SEVERITY.get((getattr(rec, "severity", "") or "") if rec else "", IncidentSeverity.P1)
    description = (rec.description if rec else "") or \
        f"{service}: service down — endpoint unreachable (outage detected)."
    return IncidentRecord(
        id=f"INC-{service}",
        description=description,
        status=IncidentStatus.INVESTIGATING,
        severity=severity,
        affected_services=[service],
        reporter="availability-monitor",
        created_at=now,
        updated_at=now,
        resolved_at=None,
        langgraph_run_id=rec.id if rec else None,
        error_rate_pct=None,
    )


async def get_active_incidents() -> list[IncidentRecord]:
    detected = await _detected_incidents_cached()
    # Availability override (authoritative UP): drop a stale telemetry detection
    # for a service the control plane explicitly RESTORED (rollback). The service-
    # down rule (total5==0 && total15>0) keeps firing for a re-enabled-but-idle
    # service until its pre-outage traffic ages out of the 15m window, which left
    # the dashboard's service card stuck CRITICAL for ~15m after a successful
    # rollback while the detail modal already showed HEALTHY. Applied post-cache so
    # it takes effect on the very next request after rollback, not after the TTL.
    detected = [i for i in detected if not availability.is_restored(_incident_service_name(i))]
    seen = {i.id for i in detected}
    user_open = [
        i
        for i in _USER_INCIDENTS.values()
        if i.id not in seen and i.status in (IncidentStatus.OPEN, IncidentStatus.INVESTIGATING)
    ]
    seen.update(i.id for i in user_open)
    # Availability override (authoritative DOWN): surface every control-plane-forced
    # outage as an active incident so the Active Incidents page matches the dashboard
    # immediately on Execute — without waiting ~5m for telemetry's service-down rule
    # to fire. Cleared automatically on rollback (mark_up removes it from down_services).
    forced = [
        _forced_outage_incident(svc)
        for svc in availability.down_services()
        if f"INC-{svc}" not in seen
    ]
    return detected + user_open + forced


async def get_incident_by_id(incident_id: str) -> IncidentRecord | None:
    # 1. Live telemetry-detected anomaly (uses the shared cached scan, never
    #    blocking KQL on the event loop)
    for inc in await _detected_incidents_cached():
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
