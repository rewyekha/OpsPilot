"""
Regression tests for the demo-hardening fixes:
  • confidence calibration  (base._calibrate_confidence)        — Task 1
  • recommendation fallback (recommendation._fallback_actions)  — Task 2
  • root-cause categories   (insights._root_cause_category)     — Task 6

Pure-logic tests — no app boot, no Azure, fully deterministic.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.agents.base import AgentFinding, _calibrate_confidence
from app.agents.recommendation.agent import _fallback_actions
from app.api.routes.insights import _root_cause_category


# ── Task 1 — confidence calibration ─────────────────────────────────────────────
def _finding(confidence: float, evidence=None, failed: bool = False) -> AgentFinding:
    return AgentFinding(
        role="metrics", summary="s", evidence=list(evidence or []),
        confidence=confidence, metadata={"failed": True} if failed else {},
    )


def test_rescales_0_1_probability_to_0_100():
    # LLM returned 0.85 on a 0-1 scale → must read as ~85, not 0.85.
    assert _calibrate_confidence(_finding(0.85, evidence=["a"])) == pytest.approx(85.0, abs=1.0)


def test_completed_run_is_floored_by_evidence():
    # Completed finding (even low LLM self-rating) reads >= 60 (Task 1: 60-95).
    assert _calibrate_confidence(_finding(0.1, evidence=[])) >= 60.0


def test_more_evidence_raises_confidence():
    lo = _calibrate_confidence(_finding(0.1, evidence=["a"]))
    hi = _calibrate_confidence(_finding(0.1, evidence=["a", "b", "c", "d"]))
    assert hi > lo


def test_caps_at_95():
    assert _calibrate_confidence(_finding(99.0, evidence=["a", "b", "c", "d", "e"])) <= 95.0


def test_failed_agent_is_never_high():
    assert _calibrate_confidence(_finding(0.0, failed=True)) <= 25.0
    assert _calibrate_confidence(_finding(0.92, failed=True)) <= 25.0


def test_already_0_100_scale_untouched_when_above_floor():
    assert _calibrate_confidence(_finding(88.0, evidence=["a"])) == pytest.approx(88.0, abs=1.0)


# ── Task 2 — recommendation fallback (always >= 1, well-formed) ──────────────────
_ACTION_KEYS = {"id", "type", "type_label", "title", "description", "steps",
                "risk", "risk_label", "impact", "impact_label", "estimated_time", "priority"}


def _state(desc: str, rc: dict | None = None, svcs=None):
    return SimpleNamespace(
        incident_description=desc, root_cause_findings=rc or {}, affected_services=svcs or ["album-api"],
    )


@pytest.mark.parametrize("desc", [
    "album-api service down — scaled to zero, unreachable",
    "p95 latency spike, slow response times",
    "error rate spiked after the v2 deployment / new revision",
    "elevated 5xx error rate on the checkout endpoint",
    "",  # empty description still yields the default error-rate remediation
])
def test_fallback_always_returns_actionable(desc):
    actions = _fallback_actions(_state(desc))
    assert 1 <= len(actions) <= 5
    for a in actions:
        assert _ACTION_KEYS <= a.keys()
        assert a["title"] and isinstance(a["steps"], list) and a["steps"]
        assert a["risk"] in ("safe", "medium", "high")


def test_fallback_uses_service_name():
    actions = _fallback_actions(_state("service down", svcs=["payments-api"]))
    assert any("payments-api" in a["title"] for a in actions)


# ── Task 6 — root-cause categories (7 buckets, never "Other") ────────────────────
@pytest.mark.parametrize("title,desc,expected", [
    ("HPA scaled pods to zero", "bad deployment rollout / new revision", "Deployment"),
    ("Misconfigured alert logic threshold", "", "Configuration"),
    ("Replica saturation under heavy load", "", "Scaling"),
    ("DNS connectivity timeout to ingress", "", "Network"),
    ("Redis dependency downstream failure", "", "Dependency"),
    ("Container OOM crash → restart loop", "", "Infrastructure"),
    ("Unhandled exception in the request handler", "", "Application"),
    ("totally unrelated narrative text", "", "Application"),  # default, never "Other"
])
def test_root_cause_category_mapping(title, desc, expected):
    assert _root_cause_category(title, desc) == expected


def test_no_category_is_other():
    assert _root_cause_category("anything at all", "") != "Other"
