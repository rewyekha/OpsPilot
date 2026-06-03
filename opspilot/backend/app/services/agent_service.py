"""Mock agent activity service — returns deterministic data matching the frontend fixtures."""
from __future__ import annotations

from datetime import datetime, timezone

from app.models.findings import (
    AgentActivityResponse,
    AgentRole,
    AgentStatus,
    AgentTask,
)

_BASE = datetime(2026, 6, 3, 12, 23, 0, tzinfo=timezone.utc)


def _dt(offset_minutes: int) -> datetime:
    from datetime import timedelta

    return _BASE + timedelta(minutes=offset_minutes)


_TASKS_BY_INCIDENT: dict[str, list[AgentTask]] = {
    "INC-2024-0847": [
        AgentTask(
            id="task-847-commander",
            incident_id="INC-2024-0847",
            role=AgentRole.COMMANDER,
            role_label="Commander",
            status=AgentStatus.COMPLETED,
            confidence=94.0,
            finding="Root cause identified: ORM connection pool regression in v2.4.1. "
            "Rollback to v2.4.0 recommended as immediate mitigation.",
            evidence=[
                "ORM pool_size reduced from 20 → 5 in v2.4.1 config diff",
                "Error rate 73% began within 4 minutes of v2.4.1 deploy",
                "Pattern matches INC-2023-0412 with 96% similarity",
            ],
            tools_called=["synthesize_findings", "score_hypotheses", "rank_recommendations"],
            started_at=_dt(0),
            completed_at=_dt(18),
            duration_seconds=1080.0,
        ),
        AgentTask(
            id="task-847-metrics",
            incident_id="INC-2024-0847",
            role=AgentRole.METRICS,
            role_label="Metrics",
            status=AgentStatus.COMPLETED,
            confidence=91.0,
            finding="Detected 73% error rate spike and 450ms average response time degradation "
            "across checkout-service beginning at 14:23 UTC.",
            evidence=[
                "checkout-service p99 latency: 23ms → 1,847ms",
                "Error rate: 0.8% → 73.4% at 14:23 UTC",
                "payment-gateway timeout rate: 0% → 41% at 14:25 UTC",
            ],
            tools_called=["query_azure_monitor", "query_prometheus", "detect_anomalies"],
            started_at=_dt(1),
            completed_at=_dt(8),
            duration_seconds=420.0,
        ),
        AgentTask(
            id="task-847-logs",
            incident_id="INC-2024-0847",
            role=AgentRole.LOGS,
            role_label="Logs",
            status=AgentStatus.COMPLETED,
            confidence=89.0,
            finding="Found 2,847 connection pool timeout errors in checkout-service logs "
            "starting at 14:23:14 UTC, all originating from ORM layer.",
            evidence=[
                "2,847 occurrences: 'connection pool timeout after 30000ms'",
                "Stack trace points to SqlAlchemy pool_size misconfiguration",
                "No errors in payment-gateway logs prior to 14:25 (downstream cascade)",
            ],
            tools_called=["query_log_analytics", "extract_stack_traces", "correlate_errors"],
            started_at=_dt(1),
            completed_at=_dt(9),
            duration_seconds=480.0,
        ),
        AgentTask(
            id="task-847-deployment",
            incident_id="INC-2024-0847",
            role=AgentRole.DEPLOYMENT,
            role_label="Deployment",
            status=AgentStatus.COMPLETED,
            confidence=96.0,
            finding="Pinpointed ORM config regression in v2.4.1 — pool_size reduced from "
            "20 to 5 in alembic migration file added 3 days ago.",
            evidence=[
                "v2.4.1 deployed at 14:19 UTC (4 min before incident)",
                "config diff: SQLALCHEMY_POOL_SIZE = 5 (was 20 in v2.4.0)",
                "Commit a3f9c12 by dev-bot-renovate on 2026-05-31",
            ],
            tools_called=["get_deployment_history", "diff_config", "query_git_log"],
            started_at=_dt(1),
            completed_at=_dt(7),
            duration_seconds=360.0,
        ),
        AgentTask(
            id="task-847-time-machine",
            incident_id="INC-2024-0847",
            role=AgentRole.TIME_MACHINE,
            role_label="Time Machine",
            status=AgentStatus.RUNNING,
            confidence=72.0,
            finding="Correlating with 3 previous incidents matching ORM pool exhaustion "
            "pattern. INC-2023-0412 is strongest match (96% signal similarity).",
            evidence=[
                "INC-2023-0412: identical ORM pool_size misconfiguration, resolved by rollback",
                "INC-2022-0891: similar error signature, different root cause (excluded)",
            ],
            tools_called=["search_incident_history", "compute_similarity", "extract_resolution"],
            started_at=_dt(2),
            completed_at=None,
            duration_seconds=None,
        ),
    ]
}


async def get_agent_activity(incident_id: str) -> AgentActivityResponse | None:
    tasks = _TASKS_BY_INCIDENT.get(incident_id)
    if tasks is None:
        return None

    completed = sum(1 for t in tasks if t.status == AgentStatus.COMPLETED)
    running = sum(1 for t in tasks if t.status == AgentStatus.RUNNING)
    waiting = sum(1 for t in tasks if t.status in (AgentStatus.PENDING, AgentStatus.WAITING))

    return AgentActivityResponse(
        incident_id=incident_id,
        total_dispatched=len(tasks),
        completed=completed,
        running=running,
        waiting=waiting,
        agents=tasks,
    )
