"""Mock incident service — returns deterministic data matching the frontend fixtures."""
from __future__ import annotations

from datetime import datetime, timezone

from app.models.incident import IncidentRecord, IncidentSeverity, IncidentStatus

# ── Canonical mock incident ────────────────────────────────────────────────────

_STARTED_AT = datetime(2026, 6, 3, 12, 23, 0, tzinfo=timezone.utc)
_UPDATED_AT = datetime(2026, 6, 3, 14, 41, 0, tzinfo=timezone.utc)

MOCK_INCIDENTS: list[IncidentRecord] = [
    IncidentRecord(
        id="INC-2024-0847",
        description=(
            "Checkout service experiencing 73% error rate spike starting at 14:23 UTC. "
            "ORM connection pool exhaustion detected in deployment v2.4.1. "
            "Payment processing and cart operations severely impacted."
        ),
        status=IncidentStatus.INVESTIGATING,
        severity=IncidentSeverity.P1,
        affected_services=["checkout-service", "payment-gateway", "cart-service"],
        reporter="azure-monitor-alerts",
        created_at=_STARTED_AT,
        updated_at=_UPDATED_AT,
        resolved_at=None,
        langgraph_run_id="lgrun-checkout-847-abc123",
        error_rate_pct=73.0,
    ),
]

_INDEX: dict[str, IncidentRecord] = {inc.id: inc for inc in MOCK_INCIDENTS}


async def get_active_incidents() -> list[IncidentRecord]:
    return [
        inc
        for inc in MOCK_INCIDENTS
        if inc.status in (IncidentStatus.OPEN, IncidentStatus.INVESTIGATING)
    ]


async def get_incident_by_id(incident_id: str) -> IncidentRecord | None:
    return _INDEX.get(incident_id)
