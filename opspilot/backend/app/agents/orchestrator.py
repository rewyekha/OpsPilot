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
from app.agents.reasoning.agent import DeepReasoningAgent
from app.agents.recommendation.agent import RecommendationAgent
from app.config import get_settings
from app.providers.factory import get_provider
from app.services.event_stream import get_event_stream


def _combined_confidence(values: list[float]) -> float:
    """Combined investigation confidence (mean of available finding confidences)."""
    vals = [v for v in values if v is not None]
    return round(sum(vals) / len(vals), 1) if vals else 0.0


def _root_cause_state(finding) -> dict:
    """Flatten an AgentFinding into the dict the RecommendationAgent consumes."""
    return {
        **finding.metadata,
        "summary": finding.summary,
        "confidence": finding.confidence,
        "evidence": finding.evidence,
    }


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
        self.reasoning = DeepReasoningAgent(provider, stream)
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
        state = state.model_copy(update={"root_cause_findings": _root_cause_state(root_cause_finding)})

        # ── Phase 3b: Reasoning escalation (o3) when confidence is low ────────
        combined = _combined_confidence([
            metrics_finding.confidence,
            logs_finding.confidence,
            deployment_finding.confidence,
            correlation_finding.confidence,
            root_cause_finding.confidence,
        ])
        threshold = get_settings().reasoning_escalation_threshold
        escalated = combined < threshold
        final_root_cause = root_cause_finding

        if escalated:
            await self._emit(incident_id, {
                "event_type": "reasoning.escalated",
                "agent_name": "reasoning",
                "incident_id": incident_id,
                "timestamp": _now(),
                "payload": {
                    "combined_confidence": combined,
                    "threshold": threshold,
                    "reason": "combined investigation confidence below escalation threshold",
                },
            })
            # Route full context to the REASONING (o3) role for a refined root cause.
            final_root_cause = await self.reasoning.run(state)
            state = state.model_copy(
                update={"root_cause_findings": _root_cause_state(final_root_cause)}
            )

        await self._emit(incident_id, {
            "event_type": "root_cause.updated",
            "agent_name": final_root_cause.role,
            "incident_id": incident_id,
            "timestamp": _now(),
            "payload": {
                "confidence": final_root_cause.confidence,
                "title": final_root_cause.metadata.get("title", "Root cause identified"),
                "blast_radius": final_root_cause.metadata.get("blast_radius", 0),
                "affected_users": final_root_cause.metadata.get("affected_users", 0),
                "hourly_impact_usd": final_root_cause.metadata.get("hourly_impact_usd", 0.0),
                "combined_confidence": combined,
                "escalated": escalated,
            },
        })

        # ── Phase 4: Recommendations (consume refined root cause via state) ───
        await self.recommendation.run(state)

        # ── Done ─────────────────────────────────────────────────────────────
        await self._emit(incident_id, {
            "event_type": "investigation.complete",
            "agent_name": "orchestrator",
            "incident_id": incident_id,
            "timestamp": _now(),
            "payload": {
                "incident_id": incident_id,
                "root_cause_confidence": final_root_cause.confidence,
                "combined_confidence": combined,
                "escalated": escalated,
            },
        })

        await self._stream.close(incident_id)

    async def _emit(self, incident_id: str, event: dict) -> None:
        try:
            await self._stream.emit(incident_id, event)
        except Exception:
            pass
