"""Demo Scenarios control panel API.

Executes / rolls back the allow-listed PowerShell scenario scripts in
``infra/scripts/scenarios`` that intentionally break the deployed workload so
OpsPilot's autonomous monitor detects and investigates the resulting telemetry
anomaly end-to-end during judging.

DEMO-ONLY and gated by ``DEMO_MODE_ENABLED`` (default off). Only the five fixed,
allow-listed scenario ids can run — no arbitrary command execution. Nothing is
fabricated: if ``pwsh`` / the script / az is unavailable, the real error is
surfaced.
"""
from __future__ import annotations

import shutil
import subprocess
import threading
import time
from pathlib import Path

import structlog
from fastapi import APIRouter, HTTPException, status

from app.config import Settings, get_settings
from app.services import availability

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/demo", tags=["demo"])

# Scenario that takes a service genuinely offline. The control plane performs the
# real outage, so it records the service as down the moment Execute launches —
# giving the dashboard + monitor a deterministic, ingestion-lag-free signal.
_OUTAGE_SCENARIO = "service-outage"

# id -> metadata. ids MUST match the script filenames in infra/scripts/scenarios.
SCENARIOS: dict[str, dict] = {
    "high-error-rate": {
        "name": "High Error Rate",
        "description": "Floods the app with failing requests to push the 5-minute error rate above threshold.",
        "expected": "P1/P2 error-rate incident",
    },
    "latency-spike": {
        "name": "Latency Spike",
        "description": "Drives p95 response time up via heavy concurrent load.",
        "expected": "P2 latency incident",
    },
    "deployment-regression": {
        "name": "Deployment Regression",
        "description": "Deploys a broken revision (bad image) that fails to serve.",
        "expected": "P1 bad-deploy",
    },
    "service-outage": {
        "name": "Service Outage",
        "description": "Disables ingress — service becomes unreachable.",
        "expected": "P1 service-down incident",
    },
    "restart-storm": {
        "name": "Restart Storm",
        "description": "Forces a container crash loop (repeated restarts).",
        "expected": "P1 container-instability incident",
    },
}

# id -> {proc, action, started_at, output, returncode}
_RUNS: dict[str, dict] = {}   # key: "<scenario_id>|<app>"

# App → a known HEALTHY endpoint for the traffic-based scenarios. Anything not
# listed defaults to "/" (works for most apps, e.g. voting-app's root page).
_HEALTH_PATHS: dict[str, str] = {"album-api": "/albums"}


def _scenarios_dir() -> Path:
    # backend/app/api/routes/demo.py -> <repo-root>/infra/scripts/scenarios
    return Path(__file__).resolve().parents[3].parent / "infra" / "scripts" / "scenarios"


def _pwsh() -> str | None:
    return shutil.which("pwsh") or shutil.which("powershell")


def _run_key(scenario_id: str, app: str) -> str:
    return f"{scenario_id}|{app}"


def _resolve_app(app: str | None, cfg: Settings) -> str:
    return (app or "").strip() or cfg.demo_app_name


def _is_running(scenario_id: str, app: str) -> bool:
    st = _RUNS.get(_run_key(scenario_id, app))
    return bool(st and not st.get("done"))


def _is_running_any(scenario_id: str) -> bool:
    return any(k.startswith(f"{scenario_id}|") and not v.get("done") for k, v in _RUNS.items())


def _require_demo() -> Settings:
    cfg = get_settings()
    if not cfg.demo_mode_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo mode disabled. Set DEMO_MODE_ENABLED=true (and DEMO_RESOURCE_GROUP / DEMO_APP_NAME) to enable scenario control.",
        )
    return cfg


def _run_blocking(scenario_id: str, args: list[str], state: dict) -> None:
    """Run a scenario script to completion in a worker thread. Uses subprocess.Popen
    (NOT asyncio.create_subprocess_exec) so it works on ANY event loop — the Windows
    SelectorEventLoop that uvicorn uses does not support asyncio subprocesses, which
    is what produced the 'NetworkError' on Execute."""
    try:
        proc = subprocess.Popen(
            args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
        )
        state["pid"] = proc.pid
        out, _ = proc.communicate()
        state["output"] = (out or "")[-4000:]
        state["returncode"] = proc.returncode
    except Exception as exc:  # noqa: BLE001 - surface the real runner error
        state["output"] = f"scenario runner error: {exc}"
        state["returncode"] = -1
    finally:
        state["done"] = True
        # Reconcile the availability registry with the ACTUAL outcome (we optimistically
        # marked the service down at Execute launch for an instant demo signal). The
        # service is back UP if execute failed (outage never took) OR rollback
        # succeeded (ingress restored).
        if scenario_id == _OUTAGE_SCENARIO:
            ok = state.get("returncode") == 0
            action = state.get("action")
            if (action == "execute" and not ok) or (action == "rollback" and ok):
                availability.mark_up(state.get("app", ""))
        log.info("demo.scenario.finished", scenario=scenario_id,
                 action=state.get("action"), returncode=state.get("returncode"))


async def _launch(scenario_id: str, rollback: bool, app: str | None) -> dict:
    cfg = _require_demo()
    if scenario_id not in SCENARIOS:
        raise HTTPException(404, f"Unknown scenario '{scenario_id}'.")
    app_name = _resolve_app(app, cfg)
    script = _scenarios_dir() / f"{scenario_id}.ps1"
    if not script.exists():
        raise HTTPException(500, f"Scenario script not found: {script}")
    shell = _pwsh()
    if not shell:
        raise HTTPException(500, "PowerShell (pwsh) not found on the backend host.")
    if _is_running(scenario_id, app_name):
        raise HTTPException(409, f"Scenario '{scenario_id}' is already running on '{app_name}'.")

    args = [
        shell, "-NoProfile", "-File", str(script),
        "-ResourceGroup", cfg.demo_resource_group,
        "-AppName", app_name,
        "-HealthPath", _HEALTH_PATHS.get(app_name, "/"),
    ]
    if rollback:
        args.append("-Rollback")

    state: dict = {
        "action": "rollback" if rollback else "execute", "app": app_name,
        "started_at": time.time(), "output": "", "returncode": None, "done": False, "pid": None,
    }
    _RUNS[_run_key(scenario_id, app_name)] = state

    # Outage scenario: record the real outage state up-front so the dashboard +
    # monitor react within one scan (≤30s) instead of waiting 5–8 min for App
    # Insights to reflect the silence. Reconciled in _run_blocking if execute fails.
    if scenario_id == _OUTAGE_SCENARIO and not rollback:
        availability.mark_down(app_name, reason="service-outage scenario (ingress disabled)")

    threading.Thread(target=_run_blocking, args=(scenario_id, args, state), daemon=True).start()
    log.info("demo.scenario.launched", scenario=scenario_id, app=app_name, action=state["action"])
    return {"scenario": scenario_id, "app": app_name, "action": state["action"], "status": "started"}


@router.get("/scenarios", summary="List demo scenarios + demo-mode status")
async def list_scenarios() -> dict:
    cfg = get_settings()
    return {
        "demo_mode_enabled": cfg.demo_mode_enabled,
        "resource_group": cfg.demo_resource_group,
        "app_name": cfg.demo_app_name,
        "pwsh_available": _pwsh() is not None,
        "scenarios": [
            {"id": k, **v, "running": _is_running_any(k)} for k, v in SCENARIOS.items()
        ],
    }


@router.post("/scenarios/{scenario_id}/run", summary="Execute a demo scenario")
async def run_scenario(scenario_id: str, app: str | None = None) -> dict:
    return await _launch(scenario_id, rollback=False, app=app)


@router.post("/scenarios/{scenario_id}/rollback", summary="Roll back a demo scenario")
async def rollback_scenario(scenario_id: str, app: str | None = None) -> dict:
    return await _launch(scenario_id, rollback=True, app=app)


@router.get("/scenarios/{scenario_id}/status", summary="Demo scenario run status")
async def scenario_status(scenario_id: str, app: str | None = None) -> dict:
    if scenario_id not in SCENARIOS:
        raise HTTPException(404, f"Unknown scenario '{scenario_id}'.")
    cfg = get_settings()
    app_name = _resolve_app(app, cfg)
    st = _RUNS.get(_run_key(scenario_id, app_name))
    if not st:
        return {"scenario": scenario_id, "app": app_name, "state": "idle"}
    running = not st.get("done")
    return {
        "scenario": scenario_id, "app": app_name,
        "action": st["action"],
        "state": "running" if running else "finished",
        "returncode": st["returncode"],
        "elapsed_seconds": round(time.time() - st["started_at"], 1),
        "output_tail": (st["output"] or "")[-2000:],
    }
