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

import logging
import time
import uuid
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
from app.providers.factory import get_provider, provider_is_live
from app.services.event_stream import get_event_stream
from app.services import investigation_store
from app.services.investigation_store import AgentExecution, InvestigationRecord


log = logging.getLogger(__name__)

# Incidents with an investigation currently executing. Guards against duplicate
# concurrent runs (e.g. an SSE reconnect firing while a run is in flight, or a
# user-triggered re-run overlapping the initial run) — one investigation per
# incident at a time. Cleared in run()'s finally.
_ACTIVE_RUNS: set[str] = set()


def investigation_active(incident_id: str) -> bool:
    """True when an investigation is currently executing for *incident_id*."""
    return incident_id in _ACTIVE_RUNS


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
        # Per-run execution capture (single source of truth feed).
        self._collected: list[AgentExecution] = []
        self._recommendations: list[dict[str, Any]] = []
        self._severity: str = ""
        # Compile the LangGraph once; nodes are bound to this orchestrator.
        self._graph = build_investigation_graph(self)

    # Exposed so graph nodes can timestamp orchestration-level events.
    @staticmethod
    def _now() -> str:
        return _now()

    def _collect(self, role: str, role_label: str, finding: Any) -> None:
        """Record one agent's real execution for persistence (called by graph nodes)."""
        meta = getattr(finding, "metadata", {}) or {}
        self._collected.append(
            AgentExecution(
                role=role,
                role_label=role_label,
                status="complete",
                confidence=float(getattr(finding, "confidence", 0.0) or 0.0),
                duration_seconds=round((meta.get("_duration_ms", 0.0) or 0.0) / 1000.0, 2),
                finding=getattr(finding, "summary", "") or "",
                evidence=list(getattr(finding, "evidence", []) or []),
                started_at=str(meta.get("_started_at", "")),
                completed_at=str(meta.get("_completed_at", "")),
            )
        )

    async def run(
        self,
        incident_id: str,
        incident_description: str,
        affected_services: list[str] | None = None,
    ) -> None:
        """Run the full investigation via the LangGraph, emitting SSE events.

        No-op if an investigation is already running for this incident (prevents
        duplicate concurrent runs from SSE reconnects / overlapping re-runs).
        """
        if incident_id in _ACTIVE_RUNS:
            log.info("orchestrator.run.skipped_active incident_id=%s", incident_id)
            return
        _ACTIVE_RUNS.add(incident_id)
        self._collected = []
        self._recommendations = []
        self._severity = ""
        run_id = f"RUN-{uuid.uuid4().hex[:10]}"
        started_at = _now()
        t0 = time.monotonic()
        self._stream.open(incident_id)
        try:
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

            # ── Commander intake (classify severity + infer affected services) ─
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
            self._collect("commander", "Commander", commander_finding)
            self._severity = str(commander_finding.metadata.get("severity", "") or "")
            services = affected_services or commander_finding.metadata.get("affected_services", []) or []

            # ── Invoke the compiled investigation graph ───────────────────────
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

            # ── Persist the real investigation record (single source of truth) ─
            record = InvestigationRecord(
                id=run_id,
                incident_id=incident_id,
                description=incident_description[:300],
                started_at=started_at,
                completed_at=_now(),
                duration_seconds=round(time.monotonic() - t0, 2),
                status="complete",
                mode="live" if provider_is_live() else "mock",
                severity=self._severity,
                combined_confidence=float(_sget(final_state, "combined_confidence", 0.0) or 0.0),
                escalated=bool(_sget(final_state, "escalated", False)),
                root_cause={
                    "title": rc.get("title", "Root cause identified"),
                    "description": rc.get("summary", ""),
                    "confidence": rc.get("confidence", 0.0),
                    "blast_radius": int(rc.get("blast_radius", 0) or 0),
                    "affected_users": int(rc.get("affected_users", 0) or 0),
                    "hourly_impact_usd": float(rc.get("hourly_impact_usd", 0.0) or 0.0),
                    "evidence": list(rc.get("evidence", []) or []),
                    "source": _sget(final_state, "root_cause_source", "root_cause"),
                },
                recommendations=self._recommendations,
                agents=self._collected,
            )
            try:
                await investigation_store.add(record)
            except Exception:
                log.exception("orchestrator.persist.failed incident_id=%s", incident_id)

            await self._emit(incident_id, {
                "event_type": "investigation.complete",
                "agent_name": "orchestrator",
                "incident_id": incident_id,
                "timestamp": _now(),
                "payload": {
                    "incident_id": incident_id,
                    "run_id": run_id,
                    "root_cause_confidence": rc.get("confidence", 0.0),
                    "combined_confidence": _sget(final_state, "combined_confidence", 0.0),
                    "escalated": _sget(final_state, "escalated", False),
                },
            })
        except Exception:
            # Log without exposing secrets (traceback only; no endpoint/key material).
            log.exception("orchestrator.run.failed incident_id=%s", incident_id)
        finally:
            _ACTIVE_RUNS.discard(incident_id)
            await self._stream.close(incident_id)

    async def _emit(self, incident_id: str, event: dict) -> None:
        try:
            await self._stream.emit(incident_id, event)
        except Exception:
            pass
