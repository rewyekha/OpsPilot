"""
Investigation store — the SINGLE SOURCE OF TRUTH for completed investigations.

Every orchestrator run persists one InvestigationRecord here. History, Analytics,
the Agents page, and the dashboard's "latest result" all read from this store —
there are no parallel mock copies. Persistence is a SQLite database under
backend/data/opspilot.db, so records survive a frontend refresh AND a backend
restart, with proper indexed queries.

Stdlib `sqlite3` only — no external DB server, runs anywhere the backend runs.
The DB path is overridable via OPSPILOT_DB_PATH (used for isolated tests). A legacy
data/investigations.json is imported once on first start so existing history is
never lost.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sqlite3
import threading
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_FILE = _DATA_DIR / "investigations.json"   # legacy JSON (migrated on first start)
_LOCK = asyncio.Lock()                       # serialises async writers
_DB_LOCK = threading.Lock()                  # guards the sqlite connection
_conn: sqlite3.Connection | None = None


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


# ── SQLite persistence ────────────────────────────────────────────────────────


def _db_path() -> Path:
    return Path(os.environ.get("OPSPILOT_DB_PATH", str(_DATA_DIR / "opspilot.db")))


def _connect() -> sqlite3.Connection:
    """Lazily open the connection + ensure schema. Cheap on subsequent calls."""
    global _conn
    if _conn is None:
        path = _db_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        _conn = sqlite3.connect(str(path), check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.execute(
            """
            CREATE TABLE IF NOT EXISTS investigations (
                id            TEXT PRIMARY KEY,
                incident_id   TEXT,
                started_at    TEXT,
                completed_at  TEXT,
                data          TEXT NOT NULL
            )
            """
        )
        _conn.execute("CREATE INDEX IF NOT EXISTS idx_inv_incident ON investigations(incident_id)")
        _conn.commit()
        _migrate_from_json(_conn)
    return _conn


def reset_connection() -> None:
    """Close the cached connection (re-opened on next use). For tests / path swaps."""
    global _conn
    if _conn is not None:
        try:
            _conn.close()
        except Exception:
            pass
        _conn = None


def _insert(conn: sqlite3.Connection, record: InvestigationRecord) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO investigations (id, incident_id, started_at, completed_at, data) "
        "VALUES (?, ?, ?, ?, ?)",
        (
            record.id,
            record.incident_id,
            record.started_at,
            record.completed_at,
            json.dumps(record.model_dump(), default=str),
        ),
    )


def _migrate_from_json(conn: sqlite3.Connection) -> None:
    """One-time import of a legacy investigations.json so existing history survives."""
    try:
        if conn.execute("SELECT COUNT(*) FROM investigations").fetchone()[0] > 0:
            return
        if not _FILE.exists():
            return
        raw = json.loads(_FILE.read_text(encoding="utf-8"))
        if not raw:
            return
        for r in raw:
            _insert(conn, InvestigationRecord(**r))
        conn.commit()
        _FILE.rename(_FILE.with_suffix(".json.migrated"))
        log.info("investigation_store.migrated_from_json count=%d", len(raw))
    except Exception:
        log.exception("investigation_store.migrate_failed")


def _row_to_record(row: sqlite3.Row) -> InvestigationRecord:
    return InvestigationRecord(**json.loads(row["data"]))


# newest first, insertion order breaking ties (rowid increments per insert)
_ORDER = "ORDER BY COALESCE(NULLIF(completed_at, ''), started_at) DESC, rowid DESC"


async def add(record: InvestigationRecord) -> None:
    """Persist a completed investigation."""
    async with _LOCK:
        with _DB_LOCK:
            conn = _connect()
            _insert(conn, record)
            conn.commit()
    log.info("investigation_store.added id=%s incident=%s", record.id, record.incident_id)


# ── Queries ───────────────────────────────────────────────────────────────────


def list_all(incident_id: str | None = None) -> list[InvestigationRecord]:
    """All records (optionally for one incident), newest first."""
    with _DB_LOCK:
        conn = _connect()
        if incident_id:
            rows = conn.execute(
                f"SELECT data FROM investigations WHERE incident_id = ? {_ORDER}", (incident_id,)
            ).fetchall()
        else:
            rows = conn.execute(f"SELECT data FROM investigations {_ORDER}").fetchall()
    return [_row_to_record(r) for r in rows]


def latest(incident_id: str | None = None) -> InvestigationRecord | None:
    with _DB_LOCK:
        conn = _connect()
        if incident_id:
            row = conn.execute(
                f"SELECT data FROM investigations WHERE incident_id = ? {_ORDER} LIMIT 1", (incident_id,)
            ).fetchone()
        else:
            row = conn.execute(f"SELECT data FROM investigations {_ORDER} LIMIT 1").fetchone()
    return _row_to_record(row) if row else None


def get(run_id: str) -> InvestigationRecord | None:
    with _DB_LOCK:
        conn = _connect()
        row = conn.execute("SELECT data FROM investigations WHERE id = ?", (run_id,)).fetchone()
    return _row_to_record(row) if row else None


def count() -> int:
    with _DB_LOCK:
        conn = _connect()
        return int(conn.execute("SELECT COUNT(*) FROM investigations").fetchone()[0])


def clear() -> int:
    """Delete all stored investigations (clean demo slate). Returns rows removed."""
    with _DB_LOCK:
        conn = _connect()
        n = int(conn.execute("SELECT COUNT(*) FROM investigations").fetchone()[0])
        conn.execute("DELETE FROM investigations")
        conn.commit()
    log.info("investigation_store.cleared count=%d", n)
    return n
