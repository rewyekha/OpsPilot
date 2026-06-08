"""Phase 3 — reasoning escalation tests.

Covers the o4-mini routing, the DeepReasoningAgent mock output, the combined-confidence
helper, and the orchestrator escalation decision (below vs above threshold) with
mock compatibility (default threshold leaves the high-confidence flow un-escalated).
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.agents.orchestrator import InvestigationOrchestrator, _combined_confidence
from app.agents.reasoning.agent import DeepReasoningAgent, RefinedRootCause
from app.agents.state import OpsPilotState, Severity
from app.config import get_settings
from app.providers.factory import get_provider, reset_provider_cache
from app.providers.models import ModelRole
from app.services.event_stream import get_event_stream


@pytest.fixture(autouse=True)
def _reset_caches(monkeypatch):
    monkeypatch.delenv("EXECUTION_MODE", raising=False)  # default mock
    get_settings.cache_clear()
    reset_provider_cache()
    yield
    get_settings.cache_clear()
    reset_provider_cache()


def _state() -> OpsPilotState:
    return OpsPilotState(
        incident_id="T-REASON",
        incident_description="checkout failing",
        severity=Severity.P1,
        affected_services=["checkout-service"],
        timeline=[],
        recommendations=[],
        agent_status={},
        messages=[],
        created_at=datetime.now(timezone.utc),
    )


# ── Routing & schema ──────────────────────────────────────────────────────────

def test_reasoning_agent_routes_to_o4_mini():
    assert DeepReasoningAgent.model_role is ModelRole.REASONING
    assert get_provider().model_for(ModelRole.REASONING) == "o4-mini"


@pytest.mark.asyncio
async def test_reasoning_mock_produces_refined_root_cause():
    agent = DeepReasoningAgent(get_provider(), get_event_stream())
    finding = await agent.run(_state())
    assert finding.role == "reasoning"
    assert finding.metadata["refined"] is True
    assert finding.metadata["reasoning_trace"]
    assert 0.0 <= finding.confidence <= 100.0


@pytest.mark.asyncio
async def test_reasoning_structured_generate_mock_is_valid():
    inst = await get_provider().structured_generate(ModelRole.REASONING, "x", RefinedRootCause)
    assert isinstance(inst, RefinedRootCause)


# ── Combined-confidence helper ──────────────────────────────────────────────────

def test_combined_confidence_mean():
    assert _combined_confidence([91, 89, 96, 92, 94]) == 92.4
    assert _combined_confidence([]) == 0.0


# ── Orchestrator escalation decision ────────────────────────────────────────────

async def _run_and_collect(incident_id: str) -> list[dict]:
    await InvestigationOrchestrator().run(incident_id, "checkout failing", ["checkout-service"])
    events: list[dict] = []
    async for ev in get_event_stream().subscribe(incident_id, timeout=2.0):
        events.append(ev)
    return events


@pytest.mark.asyncio
async def test_no_escalation_at_default_threshold(monkeypatch):
    # Default threshold (70) — mock combined confidence ~92.4 stays above it.
    monkeypatch.delenv("REASONING_ESCALATION_THRESHOLD", raising=False)
    get_settings.cache_clear()
    events = await _run_and_collect("INC-NOESC")
    types = [e["event_type"] for e in events]
    assert "reasoning.escalated" not in types
    rc = next(e for e in events if e["event_type"] == "root_cause.updated")
    assert rc["payload"]["escalated"] is False
    assert rc["agent_name"] == "root_cause"
    # No reasoning agent activity emitted.
    assert not any(e.get("agent_name") == "reasoning" for e in events)


@pytest.mark.asyncio
async def test_escalation_when_below_threshold(monkeypatch):
    # Force escalation by raising the threshold above the mock combined confidence.
    monkeypatch.setenv("REASONING_ESCALATION_THRESHOLD", "99")
    get_settings.cache_clear()
    events = await _run_and_collect("INC-ESC")
    types = [e["event_type"] for e in events]
    assert "reasoning.escalated" in types
    # The reasoning (o4-mini) agent ran.
    assert any(e["event_type"] == "agent.started" and e["agent_name"] == "reasoning" for e in events)
    # Final root_cause.updated reflects the refined verdict.
    rc = next(e for e in events if e["event_type"] == "root_cause.updated")
    assert rc["payload"]["escalated"] is True
    assert rc["agent_name"] == "reasoning"
    # Confidence is evidence-calibrated (Task 1); assert a sane range, not the raw mock value.
    assert rc["payload"]["confidence"] >= 60.0
    # Investigation still completes.
    assert "investigation.complete" in types
