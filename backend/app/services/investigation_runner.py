"""
Investigation runner — user-triggered REAL investigation execution.

Thin service that reuses the existing agent orchestration to back the dashboard's
"Re-run Investigation" and "Deep Reasoning" actions with real execution (no
simulation):

  • trigger_investigation()  → launches the full InvestigationOrchestrator
    (LangGraph: commander → metrics → logs → deployment → time_machine →
    root_cause → [deep_reasoning] → recommendation) as a background task, emitting
    SSE events. Guarded against duplicate concurrent runs.

  • run_deep_reasoning()     → runs the DeepReasoningAgent (REASONING/o4-mini
    role) over the supplied findings + current root cause, emitting SSE progress
    and returning the refined root cause.

In EXECUTION_MODE=foundry both paths make real Azure OpenAI (o4-mini) calls; in
mock mode they return the deterministic agent output — identical SSE sequence.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from app.agents.orchestrator import InvestigationOrchestrator, investigation_active
from app.agents.reasoning.agent import DeepReasoningAgent
from app.agents.state import OpsPilotState
from app.providers.factory import get_provider
from app.services.event_stream import get_event_stream

log = logging.getLogger(__name__)

# Hold references to background investigation tasks so they are not garbage
# collected (and thus cancelled) before they finish.
_TASKS: set[asyncio.Task] = set()


def trigger_investigation(
    incident_id: str,
    incident_description: str,
    affected_services: list[str] | None = None,
) -> str:
    """Launch a real investigation in the background. Returns a status string.

    'already_running' if one is in flight (the orchestrator guard would no-op),
    otherwise 'started'.
    """
    if investigation_active(incident_id):
        log.info("investigation.trigger.already_running incident_id=%s", incident_id)
        return "already_running"

    orchestrator = InvestigationOrchestrator()
    task = asyncio.create_task(
        orchestrator.run(incident_id, incident_description, affected_services or [])
    )
    _TASKS.add(task)
    task.add_done_callback(_TASKS.discard)
    log.info("investigation.trigger.started incident_id=%s", incident_id)
    return "started"


async def run_deep_reasoning(
    incident_id: str,
    incident_description: str,
    metrics_findings: dict[str, Any] | None,
    logs_findings: dict[str, Any] | None,
    deployment_findings: dict[str, Any] | None,
    root_cause_findings: dict[str, Any] | None,
) -> dict[str, Any]:
    """Run the DeepReasoningAgent over the current findings and return the refined
    root cause. Emits agent.started / agent.finding / agent.completed SSE events
    (so an open stream shows live progress)."""
    provider = get_provider()
    stream = get_event_stream()

    state = OpsPilotState(
        incident_id=incident_id,
        incident_description=incident_description,
        affected_services=[],
        metrics_findings=metrics_findings,
        logs_findings=logs_findings,
        deployment_findings=deployment_findings,
        root_cause_findings=root_cause_findings,
        timeline=[],
        recommendations=[],
        agent_status={},
        messages=[],
        created_at=datetime.now(timezone.utc),
    )

    agent = DeepReasoningAgent(provider, stream)
    # Ensure the stream queue exists so emitted progress events are buffered for
    # any subscriber that attaches.
    stream.open(incident_id)
    finding = await agent.run(state)

    meta = finding.metadata or {}
    return {
        "incident_id": incident_id,
        "title": meta.get("title", "Refined root cause"),
        "description": finding.summary,
        "confidence": finding.confidence,
        "blast_radius": int(meta.get("blast_radius", 0) or 0),
        "affected_users": int(meta.get("affected_users", 0) or 0),
        "hourly_impact_usd": float(meta.get("hourly_impact_usd", 0.0) or 0.0),
        "evidence": finding.evidence,
        "reasoning_trace": meta.get("reasoning_trace", ""),
        "mode": "live" if provider.is_live else "mock",
    }
