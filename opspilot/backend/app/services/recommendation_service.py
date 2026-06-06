"""Recommendation service — derives from the persisted investigation store.

Returns the latest completed investigation's REAL root cause + generated
recommendations for an incident (or None if no investigation has run). No static
data — the dashboard / incident page / report all read real execution output.
"""
from __future__ import annotations

from app.models.recommendations import (
    ImpactLevel,
    RecommendationResponse,
    RecommendedAction,
    RiskLevel,
    RootCause,
)
from app.services import investigation_store


def _risk(value: str) -> RiskLevel:
    try:
        return RiskLevel(value)
    except ValueError:
        return RiskLevel.MEDIUM


def _impact(value: str) -> ImpactLevel:
    try:
        return ImpactLevel(value)
    except ValueError:
        return ImpactLevel.MEDIUM


async def get_recommendations(incident_id: str) -> RecommendationResponse | None:
    record = investigation_store.latest(incident_id)
    if record is None or not (record.root_cause or {}).get("title"):
        return None

    rc = record.root_cause
    root = RootCause(
        incident_id=incident_id,
        title=rc.get("title", ""),
        description=rc.get("description", ""),
        confidence=float(rc.get("confidence", 0.0) or 0.0),
        blast_radius=int(rc.get("blast_radius", 0) or 0),
        affected_users=int(rc.get("affected_users", 0) or 0),
        hourly_impact_usd=float(rc.get("hourly_impact_usd", 0.0) or 0.0),
        evidence=list(rc.get("evidence", []) or []),
    )

    actions: list[RecommendedAction] = []
    for a in record.recommendations:
        actions.append(
            RecommendedAction(
                id=str(a.get("id", "")),
                incident_id=incident_id,
                priority=int(a.get("priority", 1) or 1),
                type=str(a.get("type", "")),
                type_label=str(a.get("type_label", "")),
                title=str(a.get("title", "")),
                description=str(a.get("description", "")),
                steps=list(a.get("steps", []) or []),
                risk=_risk(str(a.get("risk", "medium"))),
                risk_label=str(a.get("risk_label", "")),
                impact=_impact(str(a.get("impact", "medium"))),
                impact_label=str(a.get("impact_label", "")),
                estimated_time=str(a.get("estimated_time", "")),
            )
        )

    return RecommendationResponse(incident_id=incident_id, root_cause=root, actions=actions)
