"""Phase 4 — LangGraph orchestration tests.

Verifies the compiled graph structure, mock-mode event parity (same agents/order
as the imperative flow), escalation routing through the reasoning node, and that
the graph builds correctly in Foundry mode (without making live calls).
"""
from __future__ import annotations

import pytest

from app.agents.graph import _combined_confidence, build_investigation_graph
from app.agents.orchestrator import InvestigationOrchestrator
from app.config import get_settings
from app.providers.factory import reset_provider_cache
from app.services.event_stream import get_event_stream

EXPECTED_NODES = {
    "metrics_agent",
    "logs_agent",
    "deployment_agent",
    "time_machine_agent",
    "root_cause_agent",
    "confidence_decision",
    "deep_reasoning",
    "recommendation",
}


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    monkeypatch.delenv("EXECUTION_MODE", raising=False)
    monkeypatch.delenv("REASONING_ESCALATION_THRESHOLD", raising=False)
    get_settings.cache_clear()
    reset_provider_cache()
    yield
    get_settings.cache_clear()
    reset_provider_cache()


def test_graph_compiles_with_expected_nodes():
    orch = InvestigationOrchestrator()
    nodes = set(orch._graph.get_graph().nodes.keys())
    assert EXPECTED_NODES.issubset(nodes)


def test_combined_confidence_helper():
    assert _combined_confidence([91, 89, 96, 92, 94]) == 92.4
    assert _combined_confidence([None, 80.0]) == 80.0
    assert _combined_confidence([]) == 0.0


async def _run(incident_id: str) -> list[dict]:
    await InvestigationOrchestrator().run(incident_id, "checkout failing", ["checkout-service"])
    events: list[dict] = []
    async for ev in get_event_stream().subscribe(incident_id, timeout=2.0):
        events.append(ev)
    return events


@pytest.mark.asyncio
async def test_mock_run_event_parity(monkeypatch):
    """Mock mode: same agent sequence + bookend events as the imperative flow."""
    events = await _run("GRAPH-MOCK")
    completed = [e["agent_name"] for e in events if e["event_type"] == "agent.completed"]
    assert completed == [
        "commander",
        "metrics",
        "logs",
        "deployment",
        "time_machine",
        "root_cause",
        "recommendation",
    ]
    types = [e["event_type"] for e in events]
    assert types[0] == "investigation.started"
    assert types[-1] == "investigation.complete"
    assert "root_cause.updated" in types
    assert "reasoning.escalated" not in types  # high confidence → no escalation
    rc = next(e for e in events if e["event_type"] == "root_cause.updated")["payload"]
    assert rc["escalated"] is False and rc["confidence"] == 94.0


@pytest.mark.asyncio
async def test_graph_routes_through_reasoning_when_escalated(monkeypatch):
    monkeypatch.setenv("REASONING_ESCALATION_THRESHOLD", "99")
    get_settings.cache_clear()
    events = await _run("GRAPH-ESC")
    completed = [e["agent_name"] for e in events if e["event_type"] == "agent.completed"]
    assert "reasoning" in completed
    # reasoning runs between root_cause and recommendation
    assert completed.index("root_cause") < completed.index("reasoning") < completed.index("recommendation")
    rc = next(e for e in events if e["event_type"] == "root_cause.updated")["payload"]
    assert rc["escalated"] is True and rc["confidence"] == 88.0


@pytest.mark.asyncio
async def test_confidence_is_not_artificially_manipulated(monkeypatch):
    """Escalation is driven by REAL combined confidence vs the threshold only —
    there is no demo flag that fabricates/lowers confidence (removed for the
    reality pass). At the default threshold the high-confidence path does NOT
    escalate."""
    monkeypatch.delenv("REASONING_ESCALATION_THRESHOLD", raising=False)  # default 70
    get_settings.cache_clear()
    events = await _run("GRAPH-REAL")
    types = [e["event_type"] for e in events]
    rc = next(e for e in events if e["event_type"] == "root_cause.updated")["payload"]
    # Real combined confidence (94.0) is above the default 70 threshold → no escalation,
    # and the value is the genuine one (never scaled down by a demo flag).
    assert "reasoning.escalated" not in types
    assert rc["escalated"] is False
    assert rc["combined_confidence"] >= get_settings().reasoning_escalation_threshold


def test_graph_builds_in_foundry_mode(monkeypatch):
    """Foundry mode wires the live provider into the graph (no live call made)."""
    monkeypatch.setenv("EXECUTION_MODE", "foundry")
    monkeypatch.setenv("FOUNDRY_ENDPOINT", "https://demo.openai.azure.com/")
    monkeypatch.setenv("FOUNDRY_API_KEY", "fake")
    get_settings.cache_clear()
    reset_provider_cache()
    orch = InvestigationOrchestrator()
    assert type(orch.metrics._provider).__name__ == "FoundryProvider"
    assert orch.metrics._provider.is_live is True
    # Graph still compiles with the same topology.
    assert EXPECTED_NODES.issubset(set(orch._graph.get_graph().nodes.keys()))
    # build_investigation_graph is the single construction path.
    assert build_investigation_graph(orch) is not None
