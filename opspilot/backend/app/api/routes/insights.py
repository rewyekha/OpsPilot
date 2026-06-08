"""Insights router — history, analytics and agent stats, ALL computed from the
persisted investigation store (the single source of truth). No static data.

Endpoints:
  GET /api/investigations              — completed investigation records (history)
  GET /api/investigations/latest       — most recent record (dashboard baseline)
  GET /api/analytics                   — aggregates over all records
  GET /api/agents/stats                — per-agent execution stats
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

import structlog
from fastapi import APIRouter, Query

from app.services import investigation_store
from app.services.investigation_store import InvestigationRecord

log = structlog.get_logger(__name__)

router = APIRouter(tags=["insights"])


# ── History ───────────────────────────────────────────────────────────────────


@router.get("/investigations", summary="Completed investigation history")
async def list_investigations(
    incident_id: str | None = Query(None),
) -> list[InvestigationRecord]:
    records = investigation_store.list_all(incident_id)
    log.info("insights.investigations.listed", count=len(records), incident_id=incident_id)
    return records


@router.get("/history", summary="History (alias for /api/investigations)")
async def history(incident_id: str | None = Query(None)) -> list[InvestigationRecord]:
    """Alias so GET /api/history works (the canonical route is /api/investigations,
    which is what the frontend History page calls)."""
    return investigation_store.list_all(incident_id)


@router.get("/investigations/latest", summary="Most recent investigation record")
async def latest_investigation(
    incident_id: str | None = Query(None),
) -> InvestigationRecord | None:
    return investigation_store.latest(incident_id)


# ── Analytics ─────────────────────────────────────────────────────────────────


def _avg(values: list[float]) -> float:
    return round(sum(values) / len(values), 2) if values else 0.0


def _root_cause_category(title: str, description: str = "") -> str:
    """Map a root cause to one of the standard categories (Task 6). Matches on the
    title + description so real (LLM-authored) root causes land in a meaningful
    bucket instead of "Other". Most-specific categories are checked first."""
    t = f"{title or ''} {description or ''}".lower()
    rules = [
        ("Deployment", ("deploy", "rollout", "revision", "release", "regression", "rollback", "version", "canary", "migration", "ship")),
        ("Configuration", ("config", "misconfig", "setting", "env var", "environment variable", "parameter", "threshold", "alert logic", "feature flag", "pool size", "connection string")),
        ("Scaling", ("scale", "replica", "capacity", "throttl", "autoscal", "saturation", "overload", "quota", "resource limit", "concurrency")),
        ("Network", ("network", "dns", "connectivity", "ingress", "unreachable", "timeout", "latency", "packet", "firewall", "routing", "tls", "certificate")),
        ("Dependency", ("dependency", "downstream", "upstream", "redis", "database", " db ", "datastore", "gateway", "external", "third-party", "queue", "broker")),
        ("Infrastructure", ("infrastructure", "container", "node", "host", "pod", "oom", "memory", "cpu", "disk", "restart", "crash", "instance", "runtime", "platform", "kernel")),
        ("Application", ("application", "code", "bug", "exception", "error rate", "null", "logic", "handler", "endpoint", "request", "5xx", "stack trace", "regex", "validation")),
    ]
    for label, keys in rules:
        if any(k in t for k in keys):
            return label
    return "Application"


@router.get("/analytics", summary="Analytics computed from stored investigations")
async def analytics() -> dict:
    records = investigation_store.list_all()
    total = len(records)
    if total == 0:
        return {"total_investigations": 0, "has_data": False}

    durations = [r.duration_seconds for r in records if r.duration_seconds > 0]
    escalated = sum(1 for r in records if r.escalated)

    # Confidence distribution (root-cause confidence buckets).
    buckets = {"<50": 0, "50–74": 0, "75–89": 0, "90+": 0}
    for r in records:
        c = r.combined_confidence or (r.root_cause.get("confidence", 0.0) if r.root_cause else 0.0)
        if c >= 90:
            buckets["90+"] += 1
        elif c >= 75:
            buckets["75–89"] += 1
        elif c >= 50:
            buckets["50–74"] += 1
        else:
            buckets["<50"] += 1

    # Root cause categories.
    categories: dict[str, int] = defaultdict(int)
    for r in records:
        rc = r.root_cause or {}
        categories[_root_cause_category(rc.get("title", ""), rc.get("description", ""))] += 1

    # Volume per day (last 7 days).
    today = datetime.now(timezone.utc).date()
    volume = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        key = day.isoformat()
        count = sum(1 for r in records if (r.completed_at or r.started_at)[:10] == key)
        volume.append({"date": key, "label": day.strftime("%a"), "count": count})

    # Per-agent success rate across all records.
    agent_total: dict[str, int] = defaultdict(int)
    agent_ok: dict[str, int] = defaultdict(int)
    for r in records:
        for a in r.agents:
            agent_total[a.role] += 1
            if a.status == "complete":
                agent_ok[a.role] += 1
    success_rate = {
        role: round(agent_ok[role] / agent_total[role] * 100, 1) for role in agent_total
    }
    overall_success = (
        round(sum(agent_ok.values()) / sum(agent_total.values()) * 100, 1)
        if agent_total else 0.0
    )

    return {
        "has_data": True,
        "total_investigations": total,
        "mttr_seconds": _avg(durations),               # mean time to resolution
        "mean_duration_seconds": _avg(durations),
        "confidence_distribution": buckets,
        "root_cause_categories": dict(categories),
        "investigation_volume": volume,
        "agent_success_rate": success_rate,
        "overall_agent_success_rate": overall_success,
        "reasoning_escalation_rate": round(escalated / total * 100, 1),
    }


# ── Agent stats ───────────────────────────────────────────────────────────────


@router.get("/agents/stats", summary="Per-agent execution stats from stored investigations")
async def agent_stats() -> list[dict]:
    records = investigation_store.list_all()
    by_role: dict[str, list] = defaultdict(list)
    labels: dict[str, str] = {}
    last_seen: dict[str, str] = {}
    for r in records:
        for a in r.agents:
            by_role[a.role].append(a)
            labels[a.role] = a.role_label
            ts = a.completed_at or r.completed_at
            if ts and ts > last_seen.get(a.role, ""):
                last_seen[a.role] = ts

    out: list[dict] = []
    for role, execs in by_role.items():
        confs = [e.confidence for e in execs if e.confidence > 0]
        durs = [e.duration_seconds for e in execs if e.duration_seconds > 0]
        ok = sum(1 for e in execs if e.status == "complete")
        out.append({
            "role": role,
            "role_label": labels.get(role, role.title()),
            "execution_count": len(execs),
            "avg_duration_seconds": _avg(durs),
            "avg_confidence": _avg(confs),
            "last_execution": last_seen.get(role) or None,
            "success_rate": round(ok / len(execs) * 100, 1) if execs else 0.0,
        })
    out.sort(key=lambda x: x["role_label"])
    return out
