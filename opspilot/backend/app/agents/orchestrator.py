"""
InvestigationOrchestrator — coordinates all agents in the correct order.

Execution plan:
  1. Emit investigation.started
  2. Fan-out: MetricsAgent, LogsAgent, DeploymentAgent (concurrent)
  3. Fan-in: populate state findings
  4. CorrelationAgent (requires all three findings)
  5. RootCauseAgent (requires correlation)
  6. RecommendationAgent (requires root cause)
  7. Emit root_cause.updated + investigation.complete
  8. Close event stream
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from app.agents.state import OpsPilotState
from app.agents.metrics.agent import MetricsAgent
from app.agents.logs.agent import LogsAgent
from app.agents.deployment.agent import DeploymentAgent
from app.agents.commander.agent import CommanderAgent
from app.agents.time_machine.agent import CorrelationAgent
from app.agents.root_cause.agent import RootCauseAgent
from app.agents.recommendation.agent import RecommendationAgent
from app.providers.factory import get_provider
from app.services.event_stream import get_event_stream


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class InvestigationOrchestrator:
    def __init__(self) -> None:
        provider = get_provider()
        stream = get_event_stream()
        self.commander = CommanderAgent(provider, stream)
        self.metrics = MetricsAgent(provider, stream)
        self.logs = LogsAgent(provider, stream)
        self.deployment = DeploymentAgent(provider, stream)
        self.correlation = CorrelationAgent(provider, stream)
        self.root_cause = RootCauseAgent(provider, stream)
        self.recommendation = RecommendationAgent(provider, stream)
        self._stream = stream

    async def run(
        self,
        incident_id: str,
        incident_description: str,
        affected_services: list[str] | None = None,
    ) -> None:
        """Run the full investigation pipeline, emitting events to the stream."""
        self._stream.open(incident_id)

        state = OpsPilotState(
            incident_id=incident_id,
            incident_description=incident_description,
            affected_services=affected_services or [],
            timeline=[],
            recommendations=[],
            agent_status={},
            messages=[],
            created_at=datetime.now(timezone.utc),
        )

        await self._emit(incident_id, {
            "event_type": "investigation.started",
            "agent_name": "orchestrator",
            "incident_id": incident_id,
            "timestamp": _now(),
            "payload": {
                "incident_id": incident_id,
                "description": incident_description[:200],
            },
        })

        # ── Phase 0: Commander intake (classify severity + affected services) ─
        commander_finding = await self.commander.run(state)
        if not state.affected_services:
            inferred = commander_finding.metadata.get("affected_services", [])
            state = state.model_copy(update={"affected_services": inferred})

        # ── Phase 1: Parallel specialist agents ─────────────────────────────
        metrics_finding, logs_finding, deployment_finding = await asyncio.gather(
            self.metrics.run(state),
            self.logs.run(state),
            self.deployment.run(state),
        )

        state = state.model_copy(update={
            "metrics_findings": metrics_finding.metadata,
            "logs_findings": logs_finding.metadata,
            "deployment_findings": deployment_finding.metadata,
        })

        # ── Phase 2: Correlation ─────────────────────────────────────────────
        correlation_finding = await self.correlation.run(state)
        # Write timeline back so RootCauseAgent has full context
        state = state.model_copy(update={
            "timeline": correlation_finding.metadata.get("timeline", []),
        })

        # ── Phase 3: Root cause ──────────────────────────────────────────────
        root_cause_finding = await self.root_cause.run(state)

        await self._emit(incident_id, {
            "event_type": "root_cause.updated",
            "agent_name": "root_cause",
            "incident_id": incident_id,
            "timestamp": _now(),
            "payload": {
                "confidence": root_cause_finding.confidence,
                "title": root_cause_finding.metadata.get("title", "Root cause identified"),
                "blast_radius": root_cause_finding.metadata.get("blast_radius", 0),
                "affected_users": root_cause_finding.metadata.get("affected_users", 0),
                "hourly_impact_usd": root_cause_finding.metadata.get("hourly_impact_usd", 0.0),
            },
        })

        # ── Phase 4: Recommendations ─────────────────────────────────────────
        await self.recommendation.run(state)

        # ── Done ─────────────────────────────────────────────────────────────
        await self._emit(incident_id, {
            "event_type": "investigation.complete",
            "agent_name": "orchestrator",
            "incident_id": incident_id,
            "timestamp": _now(),
            "payload": {
                "incident_id": incident_id,
                "root_cause_confidence": root_cause_finding.confidence,
            },
        })

        await self._stream.close(incident_id)

    async def _emit(self, incident_id: str, event: dict) -> None:
        try:
            await self._stream.emit(incident_id, event)
        except Exception:
            pass
