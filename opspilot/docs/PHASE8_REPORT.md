# Phase 8 — Final Report: Real Azure Workload Integration

**Goal:** Convert OpsPilot from synthetic investigations to investigations against
real Azure applications — without removing the synthetic path.

**Status:** Foundation complete and verified. OpsPilot now has a feature-flagged
`TelemetryProvider` seam (`synthetic` | `azure`), two real demo workloads ready to
deploy, deploy automation, a live "Monitored Services" dashboard panel, and a
de-duplicated status UX. Live investigations require deploying the workloads and
the agent-wiring step documented in the implementation plan.

---

## 1. Files created

### Demo workloads (`demo-workloads/`)
| File | Purpose |
|------|---------|
| `demo-workloads/README.md` | Workload overview, ports, deploy + re-clone instructions |
| `demo-workloads/album-api/**` | Cloned Azure-Samples Node/Express API (nested `.git` removed) |
| `demo-workloads/voting-app/**` | Cloned Azure-Samples Flask + Redis app (nested `.git` removed) |

> eShop was **not** cloned or deployed, per scope.

### Infrastructure (`infra/`)
| File | Purpose |
|------|---------|
| `infra/deploy-album-api.ps1` | Build + deploy album-api to Container Apps; wires Log Analytics + App Insights |
| `infra/deploy-voting-app.ps1` | Deploy voting-app + internal Redis dependency; wires telemetry |
| `infra/ARCHITECTURE.md` | Azure architecture (topology, data flow, RBAC, provisioning order) |

### Backend telemetry abstraction (`backend/app/telemetry/`)
| File | Purpose |
|------|---------|
| `telemetry/__init__.py` | Package exports |
| `telemetry/models.py` | `TelemetryMode`, `HealthStatus`, `ServiceHealth`, `DetectedIncident`, errors |
| `telemetry/base.py` | `TelemetryProvider` ABC (the seam) |
| `telemetry/synthetic.py` | `SyntheticTelemetryProvider` (wraps existing fixtures; default) |
| `telemetry/azure_monitor.py` | `AzureMonitorTelemetryProvider` (real KQL via azure-monitor-query) |
| `telemetry/factory.py` | `get_telemetry_provider()` — TELEMETRY_MODE resolution + caching |
| `backend/app/api/routes/services.py` | `GET /api/system/services` (Monitored Services data) |

### Frontend (`frontend/src/`)
| File | Purpose |
|------|---------|
| `api/services.ts` | Typed client for `/api/system/services` |
| `hooks/useMonitoredServices.ts` | Data hook for the panel |
| `components/services/MonitoredServices.tsx` | Monitored Services dashboard panel |

### Documentation (`docs/`)
| File | Purpose |
|------|---------|
| `docs/PHASE8_IMPLEMENTATION_PLAN.md` | App Insights / Log Analytics queries, incident generation, RCA |
| `docs/PHASE8_REPORT.md` | This report |

## 2. Files modified

| File | Change |
|------|--------|
| `backend/app/config.py` | Added `telemetry_mode`, `azure_log_analytics_workspace_id`, `applicationinsights_connection_string` |
| `backend/app/api/routes/__init__.py` | Registered the new `services` router |
| `backend/.env.example` | Documented `TELEMETRY_MODE` + Azure Monitor settings |
| `frontend/src/theme/tokens.ts` | Added `HEALTH_COLORS` / `HEALTH_LABELS` / `asHealth` scale |
| `frontend/src/components/recommendations/RecommendationPanel.tsx` | Inserted `<MonitoredServices />`; **removed the duplicate INVESTIGATING badge** |

### Dashboard UX fix (duplicate badge)
The dashboard rendered the lifecycle status **twice**: a chip in the Incident
Summary header row *and* the "Status" KPI directly below it. The redundant header
chip was removed; the **Status KPI is now the single status indicator** on the
panel. (The cross-page chip in the global command bar is separate app chrome and
unchanged.) See `RecommendationPanel.tsx` Incident Summary block.

## 3. Azure resources required

Per `infra/ARCHITECTURE.md`, in one resource group (`rg-opspilot-demo`, `eastus2`):

| Resource | Name (default) | Notes |
|----------|----------------|-------|
| Resource Group | `rg-opspilot-demo` | Lifecycle boundary |
| Container Apps Environment | `opspilot-aca-env` | Shared by both workloads |
| Container App: **album-api** | `album-api` | External ingress :8080 |
| Container App: **voting-app** | `voting-app` | External ingress :80 |
| Container App: voting-redis | `voting-redis` | Internal Redis dependency (:6379) |
| Application Insights | `opspilot-appinsights` | Workspace-based |
| Log Analytics Workspace | `opspilot-logs` | Single KQL query backend |
| Azure AI Foundry | `opspilot-foundry` | o4-mini (existing LLM path) |
| Azure Container Registry | (auto by `az containerapp up`) | Holds built images |

## 4. Estimated cost — 1 week (demo footprint, East US 2)

Assumes a low-traffic demo (intermittent requests, scale-to-low, ~1–2 GB
telemetry/week). Pay-as-you-go list prices; **estimate only — verify with the
Azure Pricing Calculator for your subscription/region.**

| Resource | Basis | ~1-week cost (USD) |
|----------|-------|--------------------|
| Container Apps (album-api, voting-app, redis) | ~3 apps, low vCPU-sec + 1 always-on redis replica | **$8 – $18** |
| Container Apps Environment | No base fee; consumption only | $0 |
| Log Analytics ingestion | ~1–2 GB @ ~$2.76/GB (first 5 GB/mo free in many subs) | **$0 – $6** |
| Application Insights | Billed via the Log Analytics workspace (same ingestion) | included above |
| Azure Container Registry | Basic tier ~$0.167/day | **~$1.20** |
| Azure AI Foundry (o4-mini) | Demo-volume inference (o4-mini, low token count) | **$2 – $10** |
| Log Analytics retention | First 31 days free | $0 |
| **Total** | | **≈ $11 – $35 / week** |

**Cost-control levers already in place / recommended:**
- Scale demo apps to zero between runs (`min-replicas 0`); redis is the only
  always-on replica — scale it to 0 when idle (also the failure-demo trigger).
- 5 GB/month free Log Analytics tier typically covers the demo.
- o4-mini (not GPT-4o) is the configured deployment — the cheapest reasoning tier
  (per commit `414133e`, "model switch ... for token reduce").
- Delete `rg-opspilot-demo` after the demo to stop all charges.

## 5. Next steps to achieve live telemetry investigations

1. **Deploy the workloads** (5–10 min):
   ```powershell
   ./infra/deploy-album-api.ps1  -ResourceGroup rg-opspilot-demo -Location eastus2
   ./infra/deploy-voting-app.ps1 -ResourceGroup rg-opspilot-demo -Location eastus2
   ```
2. **Flip the flag**: set `TELEMETRY_MODE=azure`, `AZURE_LOG_ANALYTICS_WORKSPACE_ID`,
   and `APPLICATIONINSIGHTS_CONNECTION_STRING` in `backend/.env`; install
   `azure-monitor-query azure-identity`; grant **Monitoring Reader** to the
   backend identity. → `GET /api/system/services` now returns **live** health.
3. **Wire the agents to the provider**: switch `MetricsAgent` / `LogsAgent` from
   the direct fixture imports to `get_telemetry_provider()` (drop-in; see
   implementation plan §4). → specialist agents investigate live data.
4. **Auto-generate incidents**: add `app/services/incident_detector.py` polling
   `provider.detect_incidents()` (or wire Azure Monitor alert webhooks). →
   incidents open themselves from real telemetry.
5. **Stage the canonical demo**: scale `voting-redis` to zero —
   ```powershell
   az containerapp update --name voting-redis -g rg-opspilot-demo --min-replicas 0 --max-replicas 0
   ```
   voting-app starts failing; OpsPilot detects the spike, the agents read the
   live App Insights exceptions + dependency failures, and the Root Cause agent
   reports the broken Redis dependency end-to-end.

See `docs/PHASE8_IMPLEMENTATION_PLAN.md` for the queries and the detailed RCA flow.

---

### Verification performed
- Backend imports clean; `get_telemetry_provider()` returns the synthetic
  provider and serves the service roster.
- `GET /api/system/services` returns `200` with 4 services (TestClient).
- Frontend `tsc --noEmit` passes with the new component, hook, API, and tokens.
- Synthetic path unchanged and remains the zero-credential default.
