"""Mock timeline service — returns deterministic data matching the frontend fixtures."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models.timeline import TimelineEvent, TimelineEventType, TimelineResponse

_BASE = datetime(2026, 6, 3, 12, 23, 0, tzinfo=timezone.utc)


def _dt(offset_minutes: int) -> datetime:
    return _BASE + timedelta(minutes=offset_minutes)


_TIMELINES: dict[str, list[TimelineEvent]] = {
    "INC-2024-0847": [
        TimelineEvent(
            id="tl-847-1",
            incident_id="INC-2024-0847",
            type=TimelineEventType.DEPLOYMENT,
            type_label="Deployment",
            title="Deployment v2.4.1 Released to Production",
            description=(
                "Automated deployment pipeline promoted checkout-service v2.4.1 to production "
                "across all availability zones. Deployment completed with zero rollout errors. "
                "ORM connection pool misconfiguration introduced silently."
            ),
            timestamp=_dt(0),
            relative_time="T-20 min",
            confidence=100.0,
            is_key_event=False,
            agent_role="deployment",
            metadata={"version": "v2.4.1", "deployer": "azure-devops", "duration": "4m 12s"},
        ),
        TimelineEvent(
            id="tl-847-2",
            incident_id="INC-2024-0847",
            type=TimelineEventType.INCIDENT,
            type_label="Incident",
            title="P1 Incident INC-2024-0847 Triggered",
            description=(
                "Azure Monitor alert fired on checkout-service error rate threshold breach. "
                "PagerDuty escalated to on-call SRE. OpsPilot investigation automatically "
                "initiated and 5 agents dispatched."
            ),
            timestamp=_dt(4),
            relative_time="T-18 min",
            confidence=100.0,
            is_key_event=False,
            agent_role=None,
            metadata={"alert": "checkout-error-rate-p1", "threshold": "5%", "actual": "73%"},
        ),
        TimelineEvent(
            id="tl-847-3",
            incident_id="INC-2024-0847",
            type=TimelineEventType.DETECTION,
            type_label="Detection",
            title="Metrics Agent Detected Error Rate Spike",
            description=(
                "Metrics agent queried Azure Monitor and Prometheus. Identified 73% error rate "
                "and 450ms average response time degradation across checkout-service. "
                "Anomaly detection confidence: 91%."
            ),
            timestamp=_dt(6),
            relative_time="T-16 min",
            confidence=91.0,
            is_key_event=False,
            agent_role="metrics",
            metadata={"error_rate": "73.4%", "p99_latency": "1847ms", "tool": "query_azure_monitor"},
        ),
        TimelineEvent(
            id="tl-847-4",
            incident_id="INC-2024-0847",
            type=TimelineEventType.DETECTION,
            type_label="Detection",
            title="Logs Agent Confirmed Connection Pool Exhaustion",
            description=(
                "Logs agent scanned Azure Log Analytics and extracted 2,847 ORM connection pool "
                "timeout errors. Stack traces confirm SqlAlchemy pool_size misconfiguration "
                "as proximate cause."
            ),
            timestamp=_dt(8),
            relative_time="T-14 min",
            confidence=89.0,
            is_key_event=False,
            agent_role="logs",
            metadata={"error_count": "2847", "error_type": "ConnectionPoolTimeoutError"},
        ),
        TimelineEvent(
            id="tl-847-5",
            incident_id="INC-2024-0847",
            type=TimelineEventType.CORRELATION,
            type_label="Correlation",
            title="Deployment Agent Correlated v2.4.1 with ORM Regression",
            description=(
                "Deployment agent diffed v2.4.1 against v2.4.0 configuration. Found "
                "SQLALCHEMY_POOL_SIZE reduced from 20 to 5 in commit a3f9c12. "
                "Deployment timeline overlaps incident start with 4-minute lag."
            ),
            timestamp=_dt(10),
            relative_time="T-10 min",
            confidence=96.0,
            is_key_event=False,
            agent_role="deployment",
            metadata={"commit": "a3f9c12", "config_key": "SQLALCHEMY_POOL_SIZE", "old": "20", "new": "5"},
        ),
        TimelineEvent(
            id="tl-847-6",
            incident_id="INC-2024-0847",
            type=TimelineEventType.CORRELATION,
            type_label="Correlation",
            title="Time Machine Agent Matched INC-2023-0412 Pattern",
            description=(
                "Time Machine agent searched 18 months of incident history and found "
                "INC-2023-0412 as the strongest historical match (96% signal similarity). "
                "That incident was resolved by rolling back to previous ORM configuration."
            ),
            timestamp=_dt(12),
            relative_time="T-8 min",
            confidence=87.0,
            is_key_event=False,
            agent_role="time_machine",
            metadata={"matched_incident": "INC-2023-0412", "similarity": "96%", "resolution": "rollback"},
        ),
        TimelineEvent(
            id="tl-847-7",
            incident_id="INC-2024-0847",
            type=TimelineEventType.ROOT_CAUSE,
            type_label="Root Cause",
            title="Root Cause Confirmed: ORM Connection Pool Regression",
            description=(
                "Commander agent synthesised all specialist findings and confirmed root cause "
                "with 94% confidence. ORM connection pool regression in v2.4.1 is the "
                "definitive cause. Rollback and hotfix recommendations generated."
            ),
            timestamp=_dt(15),
            relative_time="T-5 min",
            confidence=94.0,
            is_key_event=True,
            agent_role="commander",
            metadata={"hypothesis_count": "3", "winning_hypothesis": "orm-pool-regression"},
        ),
    ]
}


async def get_timeline(incident_id: str) -> TimelineResponse | None:
    events = _TIMELINES.get(incident_id)
    if events is None:
        return None
    return TimelineResponse(incident_id=incident_id, events=events)
