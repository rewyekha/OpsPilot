"""
Investigation store — the SINGLE SOURCE OF TRUTH for completed investigations.

Every orchestrator run persists one InvestigationRecord here. History, Analytics,
the Agents page, and the dashboard's "latest result" all read from this store —
there are no parallel mock copies. Persistence is a JSON file under backend/data/
so records survive a frontend refresh AND a backend restart.

This is deliberately dependency-free (stdlib json + a file) — no external DB — so
it runs anywhere the backend runs. Writes are serialised with an asyncio.Lock.
"""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_FILE = _DATA_DIR / "investigations.json"
_LOCK = asyncio.Lock()
_cache: list["InvestigationRecord"] | None = None


# ── Record model ──────────────────────────────────────────────────────────────


class AgentExecution(BaseModel):
    role: str
    role_label: str
    status: str = "complete"          # complete | failed
    confidence: float = 0.0
    duration_seconds: float = 0.0
    finding: str = ""
    evidence: list[str] = Field(default_factory=list)
    started_at: str = ""
    completed_at: str = ""


class InvestigationRecord(BaseModel):
    id: str                            # unique per execution
    incident_id: str
    description: str = ""
    started_at: str = ""
    completed_at: str = ""
    duration_seconds: float = 0.0
    status: str = "complete"           # complete | failed
    mode: str = "mock"                 # live | mock
    severity: str = ""                 # P0 | P1 | P2 | P3 (from commander intake)
    combined_confidence: float = 0.0
    escalated: bool = False
    root_cause: dict[str, Any] = Field(default_factory=dict)
    recommendations: list[dict[str, Any]] = Field(default_factory=list)
    agents: list[AgentExecution] = Field(default_factory=list)


# ── Persistence ───────────────────────────────────────────────────────────────


def _load() -> list[InvestigationRecord]:
    global _cache
    if _cache is not None:
        return _cache
    records: list[InvestigationRecord] = []
    try:
        if _FILE.exists():
            raw = json.loads(_FILE.read_text(encoding="utf-8"))
            records = [InvestigationRecord(**r) for r in raw]
    except Exception:
        log.exception("investigation_store.load_failed")
        records = []
    _cache = records
    return records


def _persist(records: list[InvestigationRecord]) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = _FILE.with_suffix(".json.tmp")
    tmp.write_text(
        json.dumps([r.model_dump() for r in records], indent=2, default=str),
        encoding="utf-8",
    )
    tmp.replace(_FILE)  # atomic on the same filesystem


async def add(record: InvestigationRecord) -> None:
    """Append a completed investigation and persist atomically."""
    async with _LOCK:
        records = _load()
        records.append(record)
        _persist(records)
    log.info("investigation_store.added id=%s incident=%s", record.id, record.incident_id)


# ── Queries ───────────────────────────────────────────────────────────────────


def list_all(incident_id: str | None = None) -> list[InvestigationRecord]:
    """All records (optionally for one incident), newest first."""
    records = _load()
    if incident_id:
        records = [r for r in records if r.incident_id == incident_id]
    return sorted(records, key=lambda r: r.completed_at or r.started_at, reverse=True)


def latest(incident_id: str | None = None) -> InvestigationRecord | None:
    records = list_all(incident_id)
    return records[0] if records else None


def get(run_id: str) -> InvestigationRecord | None:
    return next((r for r in _load() if r.id == run_id), None)


def count() -> int:
    return len(_load())
