"""
InvestigationOrchestrator — drives the LangGraph investigation workflow.

Phase 4: the agent sequencing + reasoning-escalation decision now live in a
compiled LangGraph (see app.agents.graph). This class is a thin driver that:

  1. opens the SSE stream and emits investigation.started
  2. runs Commander intake (classifies severity + infers affected services)
  3. invokes the compiled graph (metrics → logs → deployment → time_machine →
     root_cause → confidence_decision → [deep_reasoning] → recommendation)
  4. emits investigation.complete and closes the stream

Agents and the provider architecture are unchanged. The helpers
`_combined_confidence` / `_root_cause_state` are re-exported from app.agents.graph
for backward compatibility.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.agents.state import OpsPilotState
from app.agents.metrics.agent import MetricsAgent
from app.agents.logs.agent import LogsAgent
from app.agents.deployment.agent import DeploymentAgent
from app.agents.commander.agent import CommanderAgent
from app.agents.time_machine.agent import CorrelationAgent
from app.agents.root_cause.agent import RootCauseAgent
from app.agents.reasoning.agent import DeepReasoningAgent
from app.agents.recommendation.agent import RecommendationAgent
from app.agents.graph import (  # noqa: F401  (re-exported for tests/back-compat)
    build_investigation_graph,
    _combined_confidence,
    _root_cause_state,
)
from app.providers.factory import get_provider
from app.services.event_stream import get_event_stream


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sget(state: Any, key: str, default: Any = None) -> Any:
    """Read a key from a LangGraph result (dict) or a state object."""
    if isinstance(state, dict):
        return state.get(key, default)
    return getattr(state, key, default)


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
        # Compile the LangGraph once; nodes are bound to this orchestrator.
        self._graph = build_investigation_graph(self)

    # Exposed so graph nodes can timestamp orchestration-level events.
    @staticmethod
    def _now() -> str:
        return _now()

    async def run(
        self,
        incident_id: str,
        incident_description: str,
        affected_services: list[str] | None = None,
    ) -> None:
        """Run the full investigation via the LangGraph, emitting SSE events."""
        self._stream.open(incident_id)

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

        # ── Commander intake (classify severity + infer affected services) ───
        intake_state = OpsPilotState(
            incident_id=incident_id,
            incident_description=incident_description,
            affected_services=affected_services or [],
            timeline=[],
            recommendations=[],
            agent_status={},
            messages=[],
            created_at=datetime.now(timezone.utc),
        )
        commander_finding = await self.commander.run(intake_state)
        services = affected_services or commander_finding.metadata.get("affected_services", []) or []

        # ── Invoke the compiled investigation graph ───────────────────────────
        initial_state = OpsPilotState(
            incident_id=incident_id,
            incident_description=incident_description,
            affected_services=services,
            timeline=[],
            recommendations=[],
            agent_status={},
            messages=[],
            created_at=datetime.now(timezone.utc),
        )
        final_state = await self._graph.ainvoke(initial_state)

        rc = _sget(final_state, "root_cause_findings", {}) or {}
        await self._emit(incident_id, {
            "event_type": "investigation.complete",
            "agent_name": "orchestrator",
            "incident_id": incident_id,
            "timestamp": _now(),
            "payload": {
                "incident_id": incident_id,
                "root_cause_confidence": rc.get("confidence", 0.0),
                "combined_confidence": _sget(final_state, "combined_confidence", 0.0),
                "escalated": _sget(final_state, "escalated", False),
            },
        })

        await self._stream.close(incident_id)

    async def _emit(self, incident_id: str, event: dict) -> None:
        try:
            await self._stream.emit(incident_id, event)
        except Exception:
            pass
