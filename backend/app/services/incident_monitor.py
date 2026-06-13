"""Autonomous incident monitor — the background loop that makes OpsPilot detect
and investigate incidents WITHOUT human intervention.

Every DETECTION_INTERVAL_SECONDS it scans Azure telemetry via the active
``TelemetryProvider.detect_incidents()`` (threshold-driven, never fabricated).
For each newly-detected incident it auto-dispatches the full agent investigation
(reusing ``trigger_investigation``), with a per-incident cooldown so the same
ongoing incident is not re-investigated every cycle.

Enabled by ``AUTO_DETECTION_ENABLED`` (default on). In synthetic/mock telemetry
mode ``detect_incidents()`` returns ``[]`` so nothing is auto-created — no
telemetry, no incidents. The loop never raises: a scan error is recorded and the
loop continues.

    Telemetry  →  detect_incidents()  →  trigger_investigation()  →  agents run
              →  InvestigationRecord persisted  →  dashboard updates (SSE / poll)
"""
from __future__ import annotations

import asyncio
import logging
import time

from app.agents.orchestrator import investigation_active
from app.config import get_settings
from app.services import availability, investigation_store
from app.services.investigation_runner import trigger_investigation
from app.telemetry.factory import get_telemetry_provider

log = logging.getLogger(__name__)


class IncidentMonitor:
    """Singleton background detector. Start in app lifespan, stop on shutdown."""

    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()
        self._handled: dict[str, float] = {}   # incident_id -> last dispatch (monotonic)
        self._last_scan: float = 0.0
        self._last_error: str | None = None
        self._dispatched_total = 0

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self) -> None:
        cfg = get_settings()
        if not cfg.auto_detection_enabled:
            log.info("incident_monitor.disabled (AUTO_DETECTION_ENABLED=false)")
            return
        if self._task and not self._task.done():
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._loop())
        log.info("incident_monitor.started interval=%ss", cfg.detection_interval_seconds)

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            self._task = None
            log.info("incident_monitor.stopped")

    def status(self) -> dict:
        cfg = get_settings()
        return {
            "enabled": cfg.auto_detection_enabled,
            "running": bool(self._task and not self._task.done()),
            "telemetry_mode": cfg.telemetry_mode,
            "demo_safe_mode": cfg.demo_safe_mode,
            "interval_seconds": cfg.detection_interval_seconds,
            "cooldown_seconds": cfg.detection_cooldown_seconds,
            "forced_outages": availability.down_services(),
            "tracked_incidents": sorted(self._handled.keys()),
            "dispatched_total": self._dispatched_total,
            "last_scan_age_seconds": round(time.monotonic() - self._last_scan, 1) if self._last_scan else None,
            "last_error": self._last_error,
            "thresholds": {
                "error_rate_warn_pct": cfg.detect_error_rate_warn_pct,
                "error_rate_crit_pct": cfg.detect_error_rate_crit_pct,
                "latency_p95_ms": cfg.detect_latency_p95_ms,
                "restart_storm_count": cfg.detect_restart_storm_count,
            },
        }

    # ── Loop ──────────────────────────────────────────────────────────────────

    async def _loop(self) -> None:
        while not self._stop.is_set():
            cfg = get_settings()
            try:
                await self._scan_once(cfg)
                self._last_error = None
            except Exception as exc:  # noqa: BLE001 - the loop must never die
                self._last_error = str(exc)
                log.warning("incident_monitor.scan_failed error=%s", exc)
            try:
                await asyncio.wait_for(
                    self._stop.wait(), timeout=max(5, cfg.detection_interval_seconds)
                )
            except asyncio.TimeoutError:
                pass

    async def _scan_once(self, cfg) -> None:
        self._last_scan = time.monotonic()
        if not cfg.auto_detection_enabled:
            return
        provider = get_telemetry_provider()
        # detect_incidents runs blocking KQL — offload so the loop stays responsive.
        detected = await asyncio.to_thread(provider.detect_incidents)

        # Unify two detection sources into one candidate list (incident_id → desc,
        # services, severity, signal), deduped by incident_id:
        #   1. telemetry-detected anomalies (real KQL thresholds), and
        #   2. forced-outage ground truth (a service the control plane took offline
        #      via the Service Outage scenario). (2) needs no ingestion lag, so the
        #      outage incident is raised on the very next scan — and it works even in
        #      synthetic mode where (1) returns nothing.
        candidates: dict[str, dict] = {}
        for d in detected:
            candidates[f"INC-{d.service}"] = {
                "desc": d.summary or d.title, "services": [d.service],
                "severity": d.severity, "signal": d.signal,
            }
        for svc in availability.down_services():
            candidates.setdefault(f"INC-{svc}", {
                "desc": f"{svc}: service down — endpoint unreachable (outage detected).",
                "services": [svc], "severity": "P1", "signal": "service_down",
            })

        if not candidates:
            return

        now = time.monotonic()
        cooldown = cfg.detection_cooldown_seconds
        # Drop long-expired cooldown entries.
        self._handled = {k: v for k, v in self._handled.items() if now - v < cooldown * 3}

        demo_safe = cfg.demo_safe_mode
        for incident_id, c in candidates.items():
            if investigation_active(incident_id):
                continue
            # DEMO SAFE MODE: once an incident has a persisted investigation, never
            # auto-re-investigate it — one incident → one investigation, no surprise
            # re-runs during a presentation. Durable across restarts (store-backed).
            if demo_safe and investigation_store.latest(incident_id) is not None:
                self._handled[incident_id] = now   # keep it tracked / out of churn
                continue
            last = self._handled.get(incident_id)
            if last is not None and (now - last) < cooldown:
                continue
            status = trigger_investigation(incident_id, c["desc"], c["services"])
            self._handled[incident_id] = now
            self._dispatched_total += 1
            log.info(
                "incident_monitor.dispatched incident_id=%s severity=%s signal=%s status=%s",
                incident_id, c["severity"], c["signal"], status,
            )


_monitor = IncidentMonitor()


def get_incident_monitor() -> IncidentMonitor:
    return _monitor
