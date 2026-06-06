"""
LangGraph investigation workflow (Phase 4).

Replaces the imperative agent sequencing with a compiled StateGraph:

  START
    -> metrics_agent
    -> logs_agent
    -> deployment_agent
    -> time_machine_agent
    -> root_cause_agent
    -> confidence_decision
          if combined_confidence < threshold
              -> deep_reasoning_agent -> recommendation_agent
          else
              -> recommendation_agent
    -> END

Design notes
------------
- Agents are UNCHANGED. Each node simply calls `agent.run(state)` (which emits
  the same agent.started/finding/completed SSE events) and writes the finding
  back into the graph state.
- The provider architecture is unchanged: agents already hold their AIProvider.
- Escalation behavior is identical to the Phase 3 imperative flow — same
  combined-confidence formula, same threshold, same reasoning.escalated /
  root_cause.updated payloads.
- Commander intake and the investigation.started/complete bookend events are
  handled by the orchestrator around graph invocation (lifecycle/setup), so the
  graph itself implements exactly the spec topology above.

The state schema is OpsPilotState (see app.agents.state) — the same object the
agents already consume.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from langgraph.graph import END, START, StateGraph

from app.agents.state import OpsPilotState
from app.config import get_settings

if TYPE_CHECKING:
    from app.agents.orchestrator import InvestigationOrchestrator


def _combined_confidence(values: list[float | None]) -> float:
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


def _merge_confidence(state: OpsPilotState, role: str, value: float) -> dict[str, float]:
    """Return finding_confidences merged with {role: value} (sequential-safe)."""
    return {**(state.finding_confidences or {}), role: value}


# Routes out of the confidence decision (used by the conditional edge).
ROUTE_REASONING = "deep_reasoning"
ROUTE_RECOMMEND = "recommendation"


def build_investigation_graph(orch: "InvestigationOrchestrator"):
    """Compile the investigation StateGraph, binding nodes to *orch*'s agents.

    `orch` supplies the agent instances and the `_emit(incident_id, event)`
    coroutine used for the orchestration-level SSE events.
    """
    sg = StateGraph(OpsPilotState)

    # ── Specialist nodes ─────────────────────────────────────────────────────
    async def metrics_node(state: OpsPilotState) -> dict:
        f = await orch.metrics.run(state)
        orch._collect("metrics", "Metrics", f)
        return {
            "metrics_findings": f.metadata,
            "finding_confidences": _merge_confidence(state, "metrics", f.confidence),
        }

    async def logs_node(state: OpsPilotState) -> dict:
        f = await orch.logs.run(state)
        orch._collect("logs", "Logs", f)
        return {
            "logs_findings": f.metadata,
            "finding_confidences": _merge_confidence(state, "logs", f.confidence),
        }

    async def deployment_node(state: OpsPilotState) -> dict:
        f = await orch.deployment.run(state)
        orch._collect("deployment", "Deployment", f)
        return {
            "deployment_findings": f.metadata,
            "finding_confidences": _merge_confidence(state, "deployment", f.confidence),
        }

    async def time_machine_node(state: OpsPilotState) -> dict:
        f = await orch.correlation.run(state)
        orch._collect("time_machine", "Time Machine", f)
        return {
            "timeline": f.metadata.get("timeline", []),
            "finding_confidences": _merge_confidence(state, "time_machine", f.confidence),
        }

    async def root_cause_node(state: OpsPilotState) -> dict:
        f = await orch.root_cause.run(state)
        orch._collect("root_cause", "Root Cause", f)
        return {
            "root_cause_findings": _root_cause_state(f),
            "root_cause_source": "root_cause",
            "finding_confidences": _merge_confidence(state, "root_cause", f.confidence),
        }

    # ── Confidence decision (records the escalation verdict) ─────────────────
    async def confidence_decision_node(state: OpsPilotState) -> dict:
        fc = state.finding_confidences or {}
        combined = _combined_confidence(
            [
                fc.get("metrics"),
                fc.get("logs"),
                fc.get("deployment"),
                fc.get("time_machine"),
                fc.get("root_cause"),
            ]
        )
        settings = get_settings()
        threshold = settings.reasoning_escalation_threshold
        if settings.low_confidence_demo:
            # Demo mode: intentionally drop combined confidence below the
            # threshold so the o4-mini reasoning escalation always fires. Isolated to
            # demo mode; production behavior is unchanged.
            combined = round(min(combined, threshold * 0.6), 1)
        escalated = combined < threshold
        if escalated:
            await orch._emit(
                state.incident_id,
                {
                    "event_type": "reasoning.escalated",
                    "agent_name": "reasoning",
                    "incident_id": state.incident_id,
                    "timestamp": orch._now(),
                    "payload": {
                        "combined_confidence": combined,
                        "threshold": threshold,
                        "reason": "combined investigation confidence below escalation threshold",
                    },
                },
            )
        return {"combined_confidence": combined, "escalated": escalated}

    def route_after_decision(state: OpsPilotState) -> str:
        return ROUTE_REASONING if state.escalated else ROUTE_RECOMMEND

    # ── Deep reasoning (o4-mini) — refines the root cause on escalation ──────
    async def deep_reasoning_node(state: OpsPilotState) -> dict:
        f = await orch.reasoning.run(state)
        orch._collect("reasoning", "Deep Reasoning", f)
        return {
            "root_cause_findings": _root_cause_state(f),
            "root_cause_source": "reasoning",
        }

    # ── Recommendation (joins both branches) ─────────────────────────────────
    async def recommendation_node(state: OpsPilotState) -> dict:
        rc = state.root_cause_findings or {}
        # root_cause.updated — final (possibly refined) root cause, identical
        # payload shape to the imperative orchestrator.
        await orch._emit(
            state.incident_id,
            {
                "event_type": "root_cause.updated",
                "agent_name": state.root_cause_source,
                "incident_id": state.incident_id,
                "timestamp": orch._now(),
                "payload": {
                    "confidence": rc.get("confidence", 0.0),
                    "title": rc.get("title", "Root cause identified"),
                    "blast_radius": rc.get("blast_radius", 0),
                    "affected_users": rc.get("affected_users", 0),
                    "hourly_impact_usd": rc.get("hourly_impact_usd", 0.0),
                    "combined_confidence": state.combined_confidence,
                    "escalated": state.escalated,
                },
            },
        )
        rec_finding = await orch.recommendation.run(state)
        orch._collect("recommendation", "Recommendation", rec_finding)
        # Capture the generated remediation actions for persistence (Task 6).
        orch._recommendations = list((rec_finding.metadata or {}).get("actions", []) or [])
        return {}

    sg.add_node("metrics_agent", metrics_node)
    sg.add_node("logs_agent", logs_node)
    sg.add_node("deployment_agent", deployment_node)
    sg.add_node("time_machine_agent", time_machine_node)
    sg.add_node("root_cause_agent", root_cause_node)
    sg.add_node("confidence_decision", confidence_decision_node)
    sg.add_node(ROUTE_REASONING, deep_reasoning_node)
    sg.add_node(ROUTE_RECOMMEND, recommendation_node)

    sg.add_edge(START, "metrics_agent")
    sg.add_edge("metrics_agent", "logs_agent")
    sg.add_edge("logs_agent", "deployment_agent")
    sg.add_edge("deployment_agent", "time_machine_agent")
    sg.add_edge("time_machine_agent", "root_cause_agent")
    sg.add_edge("root_cause_agent", "confidence_decision")
    sg.add_conditional_edges(
        "confidence_decision",
        route_after_decision,
        {ROUTE_REASONING: ROUTE_REASONING, ROUTE_RECOMMEND: ROUTE_RECOMMEND},
    )
    sg.add_edge(ROUTE_REASONING, ROUTE_RECOMMEND)
    sg.add_edge(ROUTE_RECOMMEND, END)

    return sg.compile()
