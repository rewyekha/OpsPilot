"""
Investigation runner — the single place that launches `orchestrator.run()`.

Enforces *exactly one* agent execution set per incident:
  • An investigation runs only when triggered explicitly (POST .../investigate).
  • Subscribing to / reconnecting to the SSE stream NEVER starts a run.
  • While an incident is RUNNING, repeat triggers are ignored (no duplicates).
  • Once an incident is COMPLETE, it is not re-run unless `force=True` (an explicit
    user-initiated re-investigation, which also clears the retained event log).

State is in-memory (single replica) — sufficient for the demo runtime.
"""
from __future__ import annotations

import asyncio

import structlog

from app.services.event_stream import get_event_stream

log = structlog.get_logger(__name__)

# incident_id -> "running" | "complete"
_STATUS: dict[str, str] = {}
_TASKS: dict[str, asyncio.Task] = {}


def get_status(incident_id: str) -> str:
    """Return 'idle' | 'running' | 'complete' for an incident."""
    return _STATUS.get(incident_id, "idle")


async def start_investigation(
    incident_id: str,
    description: str,
    affected_services: list[str],
    *,
    force: bool = False,
) -> str:
    """
    Start an investigation if allowed. Returns the resulting action:
      'started' | 'already_running' | 'already_complete'
    """
    current = _STATUS.get(incident_id)
    if current == "running":
        log.info("investigation.skipped", incident_id=incident_id, reason="already_running")
        return "already_running"
    if current == "complete" and not force:
        log.info("investigation.skipped", incident_id=incident_id, reason="already_complete")
        return "already_complete"

    if force:
        get_event_stream().reset(incident_id)

    # Import here to avoid a heavy import at module load.
    from app.agents.orchestrator import InvestigationOrchestrator

    _STATUS[incident_id] = "running"
    orchestrator = InvestigationOrchestrator()
    _TASKS[incident_id] = asyncio.create_task(
        _run(orchestrator, incident_id, description, affected_services)
    )
    # Cost instrumentation: one INVESTIGATION_STARTED per launched run.
    log.info("INVESTIGATION_STARTED", incident_id=incident_id, force=force)
    return "started"


async def _run(orchestrator, incident_id: str, description: str, services: list[str]) -> None:
    try:
        await orchestrator.run(incident_id, description, services)
    finally:
        _STATUS[incident_id] = "complete"
        _TASKS.pop(incident_id, None)
        # Cost instrumentation: one INVESTIGATION_COMPLETED per finished run.
        log.info("INVESTIGATION_COMPLETED", incident_id=incident_id)
