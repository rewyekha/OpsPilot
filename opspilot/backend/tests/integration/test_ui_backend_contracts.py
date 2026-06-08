"""
UI ↔ backend contract + integration regression suite.

Boots the REAL FastAPI app in deterministic mock mode (no Azure / no Foundry) and
asserts that every endpoint the frontend's `src/api/*.ts` modules consume returns
exactly the shape the UI expects — field names, types, and value domains — plus a
full mock investigation flow end-to-end (confidence > 0, recommendations >= 1).

This is the automated proof that "the UI works with the backend as expected":
each test mirrors one frontend API call and its TypeScript interface.
"""
from __future__ import annotations

import asyncio
import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def app_ctx():
    """Force mock mode + demo enabled regardless of any local .env, seed ONE mock
    investigation, and yield (client, record). Restores the data file + env after."""
    saved_env = {
        k: os.environ.get(k)
        for k in ("EXECUTION_MODE", "TELEMETRY_MODE", "DEMO_MODE_ENABLED", "AUTO_DETECTION_ENABLED")
    }
    os.environ.update({
        "EXECUTION_MODE": "mock",
        "TELEMETRY_MODE": "synthetic",
        "DEMO_MODE_ENABLED": "true",
        "AUTO_DETECTION_ENABLED": "false",
    })

    from app.config import get_settings
    get_settings.cache_clear()
    from app.providers.factory import reset_provider_cache
    from app.telemetry.factory import reset_telemetry_cache
    reset_provider_cache()
    reset_telemetry_cache()

    # The session conftest isolates the store onto a throwaway SQLite DB; start this
    # module from a clean slate, then seed one mock investigation.
    from app.services import investigation_store as store
    store.clear()

    from app.agents.orchestrator import InvestigationOrchestrator
    asyncio.run(InvestigationOrchestrator().run(
        "INC-test", "checkout-service elevated error rate after the v2.5.1 deploy", ["checkout-service"]))
    record = store.latest("INC-test")

    from app.main import app
    with TestClient(app) as client:
        yield client, record

    for k, v in saved_env.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v
    get_settings.cache_clear()


@pytest.fixture()
def client(app_ctx):
    return app_ctx[0]


@pytest.fixture()
def record(app_ctx):
    return app_ctx[1]


# ── The seeded investigation produced real, renderable data ─────────────────────
def test_mock_investigation_completed(record):
    assert record is not None, "orchestrator produced no record"
    assert record.status == "complete"
    assert record.combined_confidence > 0, "confidence must never be 0 for a completed run"
    assert len(record.recommendations) >= 1, "every completed investigation returns >= 1 recommendation"
    assert len(record.agents) >= 5
    assert record.root_cause and record.root_cause.get("title")


# ── /health  (systemApi.health → ApiServiceHealth) ──────────────────────────────
def test_health_contract(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert {"status", "service", "version"} <= r.json().keys()


# ── /api/system/health  (systemApi.foundryHealth → ApiFoundryHealth) ────────────
def test_foundry_health_contract(client):
    j = client.get("/api/system/health").json()
    assert {"foundryConfigured", "specialistModel", "commanderModel", "reasoningModel",
            "agentsAvailable", "executionMode", "azureOpenAiEndpoint"} <= j.keys()
    assert isinstance(j["agentsAvailable"], list)


# ── /api/system/monitor  (systemApi.monitor → MonitorStatus) ────────────────────
def test_monitor_contract(client):
    j = client.get("/api/system/monitor").json()
    assert {"enabled", "running", "telemetry_mode", "interval_seconds", "cooldown_seconds",
            "tracked_incidents", "dispatched_total", "last_scan_age_seconds", "last_error",
            "thresholds"} <= j.keys()
    assert isinstance(j["thresholds"], dict)
    assert isinstance(j["tracked_incidents"], list)


# ── /api/system/services  (servicesApi.list → ApiMonitoredServicesResponse) ─────
def test_services_contract(client):
    r = client.get("/api/system/services")
    assert r.status_code == 200
    j = r.json()
    assert "telemetryMode" in j and isinstance(j["services"], list)
    for svc in j["services"]:
        assert {"name", "status", "responseTimeMs", "errorRatePct", "lastIncident", "source"} <= svc.keys()
        assert svc["status"] in ("healthy", "degraded", "unhealthy", "unknown")
        assert isinstance(svc["responseTimeMs"], (int, float))
        assert isinstance(svc["errorRatePct"], (int, float))


# ── /api/investigations  (insightsApi.investigations → InvestigationRecord[]) ────
def test_investigations_contract(client):
    arr = client.get("/api/investigations").json()
    assert isinstance(arr, list) and len(arr) >= 1
    _assert_investigation_record(arr[0])


# ── /api/investigations/latest  (insightsApi.latest → InvestigationRecord|null) ─
def test_latest_investigation_contract(client):
    rec = client.get("/api/investigations/latest").json()
    assert rec is not None
    _assert_investigation_record(rec)


# ── /api/history  (alias the UI/manual checks hit) ──────────────────────────────
def test_history_alias_contract(client):
    r = client.get("/api/history")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ── /api/analytics  (insightsApi.analytics → AnalyticsData) ─────────────────────
def test_analytics_contract(client):
    j = client.get("/api/analytics").json()
    assert j["has_data"] is True
    assert j["total_investigations"] >= 1
    assert isinstance(j["root_cause_categories"], dict)
    assert isinstance(j["confidence_distribution"], dict)
    assert "overall_agent_success_rate" in j
    # Categories must be from the defined taxonomy (Task 6) — never "Other".
    allowed = {"Deployment", "Infrastructure", "Application", "Scaling", "Network", "Configuration", "Dependency"}
    assert set(j["root_cause_categories"]).issubset(allowed)


# ── /api/agents/stats  (insightsApi.agentStats → AgentStat[]) ───────────────────
def test_agent_stats_contract(client):
    arr = client.get("/api/agents/stats").json()
    assert isinstance(arr, list) and len(arr) >= 1
    for st in arr:
        assert {"role", "role_label", "execution_count", "avg_duration_seconds",
                "avg_confidence", "last_execution", "success_rate"} <= st.keys()


# ── /api/incidents/active  (incidentsApi.active → ApiIncidentRecord[]) ───────────
def test_active_incidents_contract(client):
    arr = client.get("/api/incidents/active").json()
    assert isinstance(arr, list)
    for inc in arr:
        assert {"id", "description", "status", "severity", "affected_services",
                "reporter", "created_at", "updated_at"} <= inc.keys()
        assert isinstance(inc["affected_services"], list)


# ── /api/recommendations/{id}  (ApiRecommendationResponse) ──────────────────────
def test_recommendations_contract(client):
    j = client.get("/api/recommendations/INC-test").json()
    assert j["incident_id"] == "INC-test"
    assert {"root_cause", "actions"} <= j.keys()
    assert isinstance(j["actions"], list) and len(j["actions"]) >= 1
    for a in j["actions"]:
        assert {"id", "priority", "type", "type_label", "title", "description",
                "steps", "risk", "risk_label", "impact", "impact_label", "estimated_time"} <= a.keys()


# ── /api/demo/scenarios  (demoApi.list → DemoScenarioList) ──────────────────────
def test_demo_list_contract(client):
    j = client.get("/api/demo/scenarios").json()
    assert {"demo_mode_enabled", "resource_group", "app_name", "pwsh_available", "scenarios"} <= j.keys()
    assert j["demo_mode_enabled"] is True
    assert len(j["scenarios"]) == 5
    ids = {sc["id"] for sc in j["scenarios"]}
    assert ids == {"high-error-rate", "latency-spike", "deployment-regression", "service-outage", "restart-storm"}
    for sc in j["scenarios"]:
        assert {"id", "name", "description", "expected", "running"} <= sc.keys()


# ── /api/demo/scenarios/{id}/status  (demoApi.status → DemoRunStatus) ────────────
def test_demo_status_contract(client):
    j = client.get("/api/demo/scenarios/high-error-rate/status").json()
    assert j["scenario"] == "high-error-rate"
    assert j["state"] in ("idle", "running", "finished")


# ── Demo gating: when disabled, run is blocked (403) not crashed ─────────────────
def test_demo_disabled_blocks_run(monkeypatch):
    monkeypatch.setenv("DEMO_MODE_ENABLED", "false")
    from app.config import get_settings
    get_settings.cache_clear()
    from app.main import app
    with TestClient(app) as c:
        assert c.post("/api/demo/scenarios/high-error-rate/run").status_code == 403
    monkeypatch.setenv("DEMO_MODE_ENABLED", "true")
    get_settings.cache_clear()


# ── shared record-shape assertion (InvestigationRecord) ─────────────────────────
def _assert_investigation_record(rec: dict) -> None:
    assert {"id", "incident_id", "description", "started_at", "completed_at",
            "duration_seconds", "status", "mode", "severity", "combined_confidence",
            "escalated", "root_cause", "recommendations", "agents"} <= rec.keys()
    # root_cause shape (InvestigationRootCause)
    rc = rec["root_cause"]
    assert {"title", "description", "confidence", "blast_radius", "affected_users",
            "hourly_impact_usd", "evidence"} <= rc.keys()
    # agents shape (AgentExecution)
    for a in rec["agents"]:
        assert {"role", "role_label", "status", "confidence", "duration_seconds",
                "finding", "evidence", "started_at", "completed_at"} <= a.keys()
    # recommendations shape (StoredAction)
    for r in rec["recommendations"]:
        assert {"id", "type", "type_label", "title", "description", "steps", "risk",
                "risk_label", "impact", "impact_label", "estimated_time", "priority"} <= r.keys()
