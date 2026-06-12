"""Service availability registry — authoritative, real-time outage ground truth.

This is NOT fabricated telemetry. It records services that the OpsPilot control
plane has *itself* taken offline (the Demo Scenarios "Service Outage" runs
`az containerapp ingress disable`, a real, immediate outage). Because the platform
performed the action, it knows the service is unreachable RIGHT NOW — with no
Application Insights ingestion lag (which is why pure request-volume detection
took 5–8 minutes: a disabled ingress emits *silence*, not a failure signal, and
the prior traffic only ages out of the 5-minute window minutes later).

Two consumers read this registry so an outage surfaces deterministically within
one monitor scan (≤ detection_interval_seconds):
  • /api/system/services — a down service renders UNHEALTHY immediately.
  • IncidentMonitor       — raises a P1 service-down incident immediately.

It works in BOTH telemetry modes (synthetic and azure), so the outage demo is
reliable even without live Azure ingestion.

In-process and intentionally simple (one backend process). Guarded by a lock so
the demo runner thread and the async request/monitor paths don't race.
"""
from __future__ import annotations

import threading
from datetime import datetime, timezone

_LOCK = threading.Lock()
# service name -> {"reason": str, "since": iso8601}
_DOWN: dict[str, dict[str, str]] = {}
# service name -> iso8601 of the explicit restore (rollback). Authoritative "this
# service is UP" set by the control plane. Cleared if the service is marked down
# again. Used to suppress the stale telemetry "service down" false positive that
# lingers after rollback (a re-enabled-but-idle service still reads total5==0 &&
# total15>0 until its pre-outage traffic ages out of the 15m window — up to ~15m).
_RESTORED: dict[str, str] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def mark_down(service: str, reason: str = "forced outage") -> None:
    """Record *service* as unavailable (e.g. ingress disabled by a demo scenario)."""
    if not service:
        return
    with _LOCK:
        # Preserve the original onset time if it's already down (re-execute is a no-op).
        existing = _DOWN.get(service)
        _DOWN[service] = {
            "reason": reason,
            "since": existing["since"] if existing else _now_iso(),
        }
        _RESTORED.pop(service, None)   # down again → no longer "restored"


def mark_up(service: str) -> None:
    """Clear *service*'s forced-outage state (e.g. ingress re-enabled by rollback)
    and record it as authoritatively restored/UP."""
    if not service:
        return
    with _LOCK:
        _DOWN.pop(service, None)
        _RESTORED[service] = _now_iso()


def is_down(service: str) -> bool:
    with _LOCK:
        return service in _DOWN


def is_restored(service: str) -> bool:
    """True when the control plane explicitly restored *service* (rollback) and it
    has NOT since been marked down — i.e. authoritatively UP. Consumers use this to
    drop a stale telemetry 'service down' detection so the dashboard clears on
    rollback instead of lagging ~15m behind."""
    with _LOCK:
        return service in _RESTORED and service not in _DOWN


def down_services() -> list[str]:
    """Names of all services currently in a forced-outage state."""
    with _LOCK:
        return sorted(_DOWN.keys())


def restored_services() -> list[str]:
    """Names of services explicitly restored (UP) and not since marked down."""
    with _LOCK:
        return sorted(s for s in _RESTORED if s not in _DOWN)


def since(service: str) -> str | None:
    """ISO onset timestamp for a down service, or None if it isn't down."""
    with _LOCK:
        entry = _DOWN.get(service)
        return entry["since"] if entry else None


def snapshot() -> dict[str, dict[str, str]]:
    """A copy of the full registry (for monitor status / debugging)."""
    with _LOCK:
        return {k: dict(v) for k, v in _DOWN.items()}


def clear() -> None:
    """Drop all forced-outage AND restored state (clean demo slate / tests)."""
    with _LOCK:
        _DOWN.clear()
        _RESTORED.clear()
