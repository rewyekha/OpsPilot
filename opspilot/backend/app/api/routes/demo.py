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

import asyncio
import shutil
import time
from pathlib import Path

import structlog
from fastapi import APIRouter, HTTPException, status

from app.config import Settings, get_settings

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/demo", tags=["demo"])

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
        "expected": "P1 deployment / service-down incident",
    },
    "service-outage": {
        "name": "Service Outage",
        "description": "Scales the app to zero replicas — service becomes unreachable.",
        "expected": "P1 service-down incident",
    },
    "restart-storm": {
        "name": "Restart Storm",
        "description": "Forces a container crash loop (repeated restarts).",
        "expected": "P1 container-instability incident",
    },
}

# id -> {proc, action, started_at, output, returncode}
_RUNS: dict[str, dict] = {}


def _scenarios_dir() -> Path:
    # backend/app/api/routes/demo.py -> opspilot/infra/scripts/scenarios
    return Path(__file__).resolve().parents[3].parent / "infra" / "scripts" / "scenarios"


def _pwsh() -> str | None:
    return shutil.which("pwsh") or shutil.which("powershell")


def _is_running(scenario_id: str) -> bool:
    st = _RUNS.get(scenario_id)
    return bool(st and st["proc"].returncode is None)


def _require_demo() -> Settings:
    cfg = get_settings()
    if not cfg.demo_mode_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo mode disabled. Set DEMO_MODE_ENABLED=true (and DEMO_RESOURCE_GROUP / DEMO_APP_NAME) to enable scenario control.",
        )
    return cfg


async def _launch(scenario_id: str, rollback: bool) -> dict:
    cfg = _require_demo()
    if scenario_id not in SCENARIOS:
        raise HTTPException(404, f"Unknown scenario '{scenario_id}'.")
    script = _scenarios_dir() / f"{scenario_id}.ps1"
    if not script.exists():
        raise HTTPException(500, f"Scenario script not found: {script}")
    shell = _pwsh()
    if not shell:
        raise HTTPException(500, "PowerShell (pwsh) not found on the backend host.")
    if _is_running(scenario_id):
        raise HTTPException(409, f"Scenario '{scenario_id}' is already running.")

    args = [
        shell, "-NoProfile", "-File", str(script),
        "-ResourceGroup", cfg.demo_resource_group,
        "-AppName", cfg.demo_app_name,
    ]
    if rollback:
        args.append("-Rollback")

    proc = await asyncio.create_subprocess_exec(
        *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
    )
    state = {
        "proc": proc, "action": "rollback" if rollback else "execute",
        "started_at": time.time(), "output": "", "returncode": None,
    }
    _RUNS[scenario_id] = state

    async def _drain() -> None:
        assert proc.stdout is not None
        out = await proc.stdout.read()
        await proc.wait()
        state["output"] = out.decode(errors="replace")[-4000:]
        state["returncode"] = proc.returncode
        log.info("demo.scenario.finished", scenario=scenario_id,
                 action=state["action"], returncode=proc.returncode)

    asyncio.create_task(_drain())
    log.info("demo.scenario.launched", scenario=scenario_id, action=state["action"])
    return {"scenario": scenario_id, "action": state["action"], "status": "started"}


@router.get("/scenarios", summary="List demo scenarios + demo-mode status")
async def list_scenarios() -> dict:
    cfg = get_settings()
    return {
        "demo_mode_enabled": cfg.demo_mode_enabled,
        "resource_group": cfg.demo_resource_group,
        "app_name": cfg.demo_app_name,
        "pwsh_available": _pwsh() is not None,
        "scenarios": [
            {"id": k, **v, "running": _is_running(k)} for k, v in SCENARIOS.items()
        ],
    }


@router.post("/scenarios/{scenario_id}/run", summary="Execute a demo scenario")
async def run_scenario(scenario_id: str) -> dict:
    return await _launch(scenario_id, rollback=False)


@router.post("/scenarios/{scenario_id}/rollback", summary="Roll back a demo scenario")
async def rollback_scenario(scenario_id: str) -> dict:
    return await _launch(scenario_id, rollback=True)


@router.get("/scenarios/{scenario_id}/status", summary="Demo scenario run status")
async def scenario_status(scenario_id: str) -> dict:
    if scenario_id not in SCENARIOS:
        raise HTTPException(404, f"Unknown scenario '{scenario_id}'.")
    st = _RUNS.get(scenario_id)
    if not st:
        return {"scenario": scenario_id, "state": "idle"}
    running = st["proc"].returncode is None and st["returncode"] is None
    return {
        "scenario": scenario_id,
        "action": st["action"],
        "state": "running" if running else "finished",
        "returncode": st["returncode"],
        "elapsed_seconds": round(time.time() - st["started_at"], 1),
        "output_tail": (st["output"] or "")[-2000:],
    }
