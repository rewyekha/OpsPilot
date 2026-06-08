# OpsPilot — Autonomous Incident Detection & Investigation

Final hackathon pass. OpsPilot now **detects operational problems from Azure
telemetry and investigates them with zero human intervention**. Manual incident
creation remains available as a secondary feature. Nothing is fabricated — if
telemetry is unavailable, the system returns empty/UNKNOWN and creates nothing.

---

## 1. Architecture Summary — detection flow

```
                    ┌─────────────────────────────────────────────────────────┐
                    │  Azure Monitor · Application Insights · Log Analytics     │
                    │     AppRequests · AppExceptions · ContainerAppSystemLogs   │
                    └───────────────────────────▲──────────────┬───────────────┘
                                       KQL (5m / 15m windows)   │ real telemetry
                                                │               ▼
   ┌────────────────────────────────────────────┴───────────────────────────────┐
   │ IncidentMonitor (background loop, every DETECTION_INTERVAL_SECONDS)          │
   │   AzureMonitorTelemetryProvider.detect_incidents()  ── threshold rules ──▶   │
   │     restart storm (≥N/15m)→P1 · service down (active→0 req)→P1 ·             │
   │     error rate >20%→P1 · >5%→P2 · p95 latency >2000ms→P2   (else: nothing)   │
   │   per-incident COOLDOWN so an ongoing incident isn't re-investigated         │
   └───────────────────────────────────┬─────────────────────────────────────────┘
                                        │ trigger_investigation(incident_id, …)
                                        ▼
   ┌──────────────────────────────────────────────────────────────────────────────┐
   │ InvestigationOrchestrator (LangGraph) — REAL agents over REAL telemetry        │
   │   Commander → Metrics → Logs → Deployment → Time Machine → Root Cause          │
   │            → [Deep Reasoning if confidence < threshold] → Recommendation        │
   │   each agent emits SSE (agent.started/finding/completed) + telemetry evidence   │
   └───────────────────────────────────┬──────────────────────────────────────────┘
                                        │ InvestigationRecord persisted (single source of truth)
                                        ▼
   ┌──────────────────────────────────────────────────────────────────────────────┐
   │ Dashboard / Active Incidents / History / Analytics / Agents                    │
   │   • per-incident SSE  → live agent queue + activity                            │
   │   • silent 5s poll (opspilot:poll) → latest, active, history, analytics, agents │
   │   • "Autonomous detection active" badge ← GET /api/system/monitor              │
   └──────────────────────────────────────────────────────────────────────────────┘
```

**End-to-end flow (no manual step):** deploy album-api → OpsPilot discovers it →
run a scenario → telemetry breaches a threshold → monitor auto-creates `INC-album-api`
→ agents auto-investigate → root cause + recommendations → dashboard shows the
complete investigation in real time.

## 2. Files changed

**Backend — new**
- `app/services/incident_monitor.py` — autonomous background monitor (loop, thresholds via config, per-incident cooldown, dispatch, status).
- `app/api/routes/demo.py` — demo-gated scenario runner (`/api/demo/scenarios` list/run/rollback/status).

**Backend — modified**
- `app/telemetry/azure_monitor.py` — `detect_incidents()` rewritten with the six threshold rules + severities + `_detect_for_service` + `_restart_count` (telemetry-only).
- `app/config.py` — added detection + demo settings; **removed** `low_confidence_demo` (live-path confidence fabrication) and dead Cosmos/Search/Foundry-project keys.
- `app/main.py` — lifespan starts/stops the monitor.
- `app/api/routes/services.py` — `GET /api/system/monitor` status endpoint.
- `app/api/routes/__init__.py` — register the demo router.
- `app/agents/graph.py` — removed the `low_confidence_demo` confidence-drop branch.
- `tests/unit/test_graph.py` — replaced the demo-flag test with one asserting confidence is never manipulated.

**Backend — deleted (dead code):** `app/services/ai_search.py`, `app/services/cosmos_db.py`, `app/services/foundry.py`.

**Frontend — new**
- `src/components/demo/DemoScenariosPanel.tsx` — "Demo Scenarios" control page.
- `src/components/shared/MonitorBadge.tsx` — autonomous-detection indicator.
- `src/hooks/useActiveIncidents.ts` — polled active incidents.
- `src/api/demo.ts`, additions to `src/api/system.ts` (monitor), `src/api/incidents.ts` (`active()`).

**Frontend — modified**
- `src/components/layout/AppShell.tsx` — silent 5s `opspilot:poll`; Demo page route + label.
- `src/components/layout/SideNav.tsx` — Demo Scenarios nav item; **removed hardcoded `badge: 1`** on Active Incidents.
- `src/components/recommendations/RecommendationPanel.tsx` — watch the active (auto-detected) incident's live stream; MonitorBadge.
- `src/hooks/useInsights.ts`, `src/hooks/useIncident.ts` — also refetch on `opspilot:poll`.

**Frontend — deleted (placeholder stubs, `export {} // sprint 3`):** `components/{timeline/TimelineView, risk/BlastRadiusPanel, investigation/EvidenceExplorer, investigation/RootCausePanel, investigation/InvestigationGraph}.tsx`.

**Infra — new:** `infra/scripts/scenarios/{_scenario-common,high-error-rate,latency-spike,deployment-regression,service-outage,restart-storm}.ps1` + `README.md`.

## 3. New components
- **IncidentMonitor** (autonomous detector) · **detect_incidents thresholds** · **demo runner API** · **MonitorBadge** · **DemoScenariosPanel** · **useActiveIncidents** · **5 scenario scripts** + rollbacks.

## 4. Validation commands

```bash
# Backend unit tests (move live .env aside first — it forces real Azure calls)
cd backend; mv .env .env.bak; python -m pytest -q; mv .env.bak .env        # 24 passed

# Frontend type-check
cd frontend; npx tsc --noEmit                                              # 0 errors

# Scenario scripts parse-check (PowerShell 7+)
pwsh -NoProfile -Command "Get-ChildItem infra/scripts/scenarios/*.ps1 | %{ \$e=\$null; [System.Management.Automation.Language.Parser]::ParseFile(\$_.FullName,[ref]\$null,[ref]\$e); if(\$e){\$_.Name;\$e} }"

# Live: monitor running + detection clean (healthy → []), via the real endpoints
curl http://localhost:8000/api/system/monitor      # {enabled, running:true, telemetry_mode:azure, thresholds…}
curl http://localhost:8000/api/system/services     # real album-api health (or [])
curl http://localhost:8000/api/incidents/active    # [] when healthy; auto-incident when breached
```

## 5. Demo script (for judges)

```powershell
# 0. Backend running with autonomous detection ON, pointing at the live workspace:
#    backend/.env →  EXECUTION_MODE=foundry  TELEMETRY_MODE=azure
#                    AZURE_LOG_ANALYTICS_WORKSPACE_ID=<workspace customerId>
#                    AUTO_DETECTION_ENABLED=true  DEMO_MODE_ENABLED=true
#                    DEMO_RESOURCE_GROUP=rg-opspilot  DEMO_APP_NAME=album-api
#    uvicorn app.main:app   (backend)   +   npm run dev   (frontend)

# 1. Deploy album-api (if not already) and confirm OpsPilot discovered it
./infra/scripts/deploy-album-api.ps1 -ResourceGroup rg-opspilot -Environment dev
#    → Dashboard “Monitored Services” shows album-api healthy; badge: “Autonomous detection active”

# 2. Break it — from the "Demo Scenarios" page (Execute), or directly:
./infra/scripts/scenarios/high-error-rate.ps1 -ResourceGroup rg-opspilot -AppName album-api
#    (or service-outage.ps1 / deployment-regression.ps1 / restart-storm.ps1 / latency-spike.ps1)

# 3. WAIT ~2–5 min for telemetry ingestion. Then WITHOUT touching the UI:
#    • monitor detects the breach → auto-creates INC-album-api (P1/P2)
#    • all 7 agents auto-investigate → root cause + recommendations
#    • Dashboard / Active Incidents / History / Analytics / Agents update live

# 4. Restore the workload
./infra/scripts/scenarios/high-error-rate.ps1 -ResourceGroup rg-opspilot -AppName album-api -Rollback
```

`infra/scripts/scenarios/README.md` lists every scenario, its expected incident +
severity, and execute/rollback commands.

## 6. Known limitations (real)

1. **Detection latency = telemetry ingestion lag.** App Insights/Log Analytics
   ingest on a ~2–5 min delay, and the monitor scans every 30s, so auto-detection
   is not instant — expect ~2–6 min from breach to incident. Not a bug; it is the
   platform's data latency.
2. **`latency-spike` is best-effort.** Without a slow endpoint in album-api, the
   scenario raises p95 only by saturating the app under concurrent load; on a
   fast app it may not cross 2000ms. The error-rate / outage / deploy / restart
   scenarios are reliable.
3. **Deployment-regression & restart-storm surface via their symptoms.** A bad
   revision is detected as the resulting error-rate spike / service-down; restart
   storm needs `ContainerAppSystemLogs_CL` to be present (best-effort, returns 0
   restarts — never fabricated — if the table is absent).
4. **Service-down detection window.** A scaled-to-zero service is flagged only
   while it is still within the 15-min discovery window (it had traffic in the
   prior 15m but none in the last 5m); after telemetry fully ages out it simply
   disappears from "monitored services". There is no telemetry-only way to detect
   deletion faster than observing the absence of telemetry.
5. **Real LLM cost.** In `EXECUTION_MODE=foundry` each auto-investigation makes
   real o4-mini calls. The per-incident cooldown (default 600s) bounds this.
6. **Single-incident-per-service id (`INC-<service>`).** Concurrent distinct
   incidents on the same service collapse into one until the cooldown elapses.
7. **Demo runner shells out to PowerShell.** `/api/demo/*` requires `pwsh` + the
   Azure CLI on the backend host and is gated by `DEMO_MODE_ENABLED` (off by
   default). It runs only the five fixed, allow-listed scripts — no arbitrary
   commands.
8. **Offline modes still exist by design.** `EXECUTION_MODE=mock` and
   `TELEMETRY_MODE=synthetic` keep deterministic fixtures for tests / zero-credential
   dev. They are NOT reachable in the live (foundry + azure) path and never create
   incidents (`synthetic.detect_incidents()` returns `[]`).

## 7. Anti-fabrication guarantees (validated)
- `detect_incidents()` is telemetry-only; healthy workspace ⇒ `[]` (verified live).
- Agent evidence comes from the LLM over **real** telemetry tools
  (`tp.query_error_rate`, `tp.query_error_logs`, …) in the live path.
- Removed the only live-path fabrication (`low_confidence_demo`) and the hardcoded
  `badge: 1`; deleted dead services + placeholder stub components.
- End-to-end chain verified (mock LLM, cost-free): a detected incident auto-dispatched
  → all 7 agents ran → `INC-album-api` (P1) persisted with root cause + 3 recommendations.
- Backend `pytest` 24 passed · frontend `tsc` 0 errors · scenario scripts parse clean.
