# Phase 9 — Real Azure SRE Mode: Final Report

**Outcome:** OpsPilot now behaves like a real Azure SRE platform. The dashboard
service inventory is sourced **only** from Azure (no hardcoded services). One real
workload — **album-api** — is deployed to Azure Container Apps, instrumented with
Application Insights, and **discovered + investigated live** by OpsPilot through
Azure Monitor. End-to-end telemetry flow is proven with real query output below.

---

## 1. Azure resources created (all in `rg-opspilot`)

| Resource | Name | Type | Region | Notes |
|----------|------|------|--------|-------|
| Log Analytics Workspace | `opspilot-logs` | `Microsoft.OperationalInsights/workspaces` | eastus2 | customerId `8e501718-346d-473c-b477-84ecdbbd254d` |
| Application Insights | `opspilot-appinsights` | `Microsoft.Insights/components` | eastus2 | Workspace-based; instrumentation key `b8f3c5cf-…` |
| Smart Detector alert | `Failure Anomalies - opspilot-appinsights` | `microsoft.alertsmanagement/smartDetectorAlertRules` | global | Auto-created with App Insights; free |
| Container Apps Environment | `opspilot-aca-env` | `Microsoft.App/managedEnvironments` | **westus3** | See region note below |
| Container App | `album-api` | `Microsoft.App/containerApps` | westus3 | External ingress, port 8080 |
| Container Registry | `ca8f5de386e1acr` | `Microsoft.ContainerRegistry/registries` | westus3 | Basic SKU, auto-created by `az containerapp up` for the image |

**Minimum-resource principle honored:** only the 4 required resources (+ the ACR
the build needs, + the free smart-detector). No Cosmos, no AI Search, no eShop,
no voting-app.

> **Region note:** eastus2 returned `AKSCapacityHeavyUsage` when creating the
> Container Apps Environment (a transient regional capacity issue), which left a
> `Failed` environment. It was deleted and recreated in **westus3**, which had
> capacity. The Log Analytics workspace + Application Insights remain in eastus2
> and are reused cross-region (App Insights ingestion is region-independent;
> Container Apps logs cross-region to the workspace) — so deletion/soft-delete of
> the workspace was avoided. The deploy scripts were also fixed: `az containerapp
> up` rejects `--only-show-errors`, which had aborted the first two attempts.

---

## 2. Monthly cost estimate (demo footprint, pay-as-you-go)

| Resource | Basis | ~Monthly (USD) |
|----------|-------|----------------|
| Azure Container Registry (Basic) | $0.167/day fixed | **~$5** |
| Container App: album-api | Consumption; scales toward zero when idle, light vCPU/mem seconds | **$2 – $8** |
| Container Apps Environment | No base fee (consumption) | $0 |
| Log Analytics ingestion | Demo telemetry ≪ 5 GB/mo free tier | **$0 – $3** |
| Application Insights | Billed via the workspace (same ingestion) | included |
| **Infra total** | | **≈ $7 – $16 / month** |

Biggest lever: **delete the ACR** (or use a shared one) and **scale album-api to
zero** between demos. Deleting `rg-opspilot` stops all charges.

## 3. Foundry (LLM) cost estimate

- **Model: `o4-mini` only.** Config defaults and `.env` set every role
  (commander/specialist/reasoning) to `o4-mini`; no `gpt-4o` / `gpt-4o-mini` is
  reachable at runtime.
- **Event-driven, no polling.** Foundry is called only when an investigation runs
  (triggered via the API/SSE), never on a timer. Service discovery + the
  Monitored Services panel make **zero** Foundry calls (pure Azure Monitor reads).
- **Per investigation:** ~7 agent steps × ~2–5K tokens ≈ 30–60K tokens. At
  o4-mini rates (~$1.1/1M input, ~$4.4/1M output, approximate) that is
  **≈ $0.05 – $0.20 per full investigation**. A demo session of a dozen
  investigations is **< $2**.

## 4. Files modified / created (Phase 9)

**Backend — service inventory & telemetry**
- `backend/app/telemetry/synthetic.py` — removed the hardcoded service roster; `list_services()`/`get_all_service_health()` now return `[]` (Azure-only discovery).
- `backend/app/telemetry/azure_monitor.py` — real discovery (union of App Insights `AppRoleName` + Container Apps `ContainerAppConsoleLogs_CL`); removed the hardcoded `["album-api","voting-app"]` fallback.
- `backend/app/agents/metrics/agent.py` — `_investigate` reads `get_telemetry_provider().query_error_rate/latency/throughput` (live in azure mode).
- `backend/app/agents/logs/agent.py` — `_investigate` reads `get_telemetry_provider().query_error_logs`.
- `backend/app/config.py` — model deployments default to `o4-mini` (was `gpt-4o`/`gpt-4o-mini`).
- `backend/pyproject.toml` — added `azure-monitor-query ^2.0.0`.
- `backend/.env` — `TELEMETRY_MODE=azure`, `AZURE_LOG_ANALYTICS_WORKSPACE_ID=8e501718-…` (gitignored).

**Frontend — no service names in source**
- `frontend/src/components/services/MonitoredServices.tsx` — empty state now reads exactly **"No monitored Azure services discovered"**.
- `frontend/src/components/command/GlobalCommandBar.tsx` — removed `checkout-service, payment-gateway` / `Checkout service…` placeholders (genericized).
- `frontend/src/utils/search.ts` — removed `checkout-service` from a static search entry.

**Demo workload — instrumentation**
- `demo-workloads/album-api/src/bin/www` — Application Insights SDK bootstrap (sets cloud role = `OPSPILOT_SERVICE_NAME`) before Express loads.
- `demo-workloads/album-api/src/package.json` — added `applicationinsights ^2.9.6`.

**Infra — deploy fixes**
- `infra/deploy-album-api.ps1`, `infra/deploy-voting-app.ps1` — removed `--only-show-errors` from `az containerapp up` and added `$LASTEXITCODE` failure guards.

*(New-in-Phase-8 files that this phase builds on: `backend/app/telemetry/*`, `backend/app/api/routes/services.py`, `frontend/src/api/services.ts`, `frontend/src/hooks/useMonitoredServices.ts`.)*

## 5. Deployment URL

**https://album-api.victoriousmushroom-1217a769.westus3.azurecontainerapps.io**
- `GET /` → `{"message":"Call the /albums route to retrieve a list of albums"}`
- `GET /albums` → live album JSON (verified)

## 6. Service discovery implementation

Discovery is **dynamic and Azure-sourced** — no service names exist in frontend
source or in any hardcoded backend roster.

```
Dashboard (MonitoredServices.tsx)
  → GET /api/system/services            (telemetryMode + discovered services)
    → get_telemetry_provider()          (TELEMETRY_MODE=azure → AzureMonitorTelemetryProvider)
      → list_services()  =  union of:
          • AppRequests | distinct AppRoleName                  (instrumented apps)
          • ContainerAppConsoleLogs_CL | distinct ContainerAppName_s  (any Container App)
      → get_service_health(svc)  =  AppRequests rollup (error rate, p99) over 5 min
```
- **Zero workloads in Azure** → `list_services()` returns `[]` → dashboard shows
  *"No monitored Azure services discovered"*.
- **Workloads present** → only the discovered ones are shown, with live health.
- The synthetic provider is retained (abstraction default) but now ships **no**
  inventory, so it can never reintroduce demo services.

## 7. Evidence — live end-to-end flow (real query output)

**Stage 1 — album-api → Application Insights → Log Analytics** (`AppRequests` by role):
```
AppRoleName    Requests   Failures   P99ms
album-api      138        16         5
```
Result codes captured: `200 ×121`, `304 ×1`, `404 ×16` (the failing traffic I generated).

**Stage 2 — discovery source** (`ContainerAppConsoleLogs_CL | distinct ContainerAppName_s`):
```
ContainerAppName_s
album-api
```

**Stage 3 — AzureMonitorTelemetryProvider** (run live against the workspace):
```
provider: azure | is_live: True
list_services() -> ['album-api']                         ← discovered, not hardcoded
get_service_health('album-api') -> status=unhealthy, responseTimeMs=3.0, errorRatePct=14.68, source=azure
query_error_rate('album-api')  -> 4 datapoints, peak 100.0
query_latency_p99('album-api') -> 4 datapoints, peak 12.0
```

**Stage 4 — dashboard API** (`GET /api/system/services`, TELEMETRY_MODE=azure):
```json
{ "telemetryMode": "azure",
  "services": [ { "name": "album-api", "status": "unhealthy",
                  "responseTimeMs": 3.0, "errorRatePct": 14.68,
                  "lastIncident": null, "source": "azure" } ] }
```
*(Health = "unhealthy" because the validation traffic included a 404 burst → 14.68%
error rate, above the 10% threshold. Steady clean traffic would report "healthy".
This is real computed health, not a fixture.)*

### Screenshot locations
Save UI captures under **`opspilot/doc/screenshots/`** (alongside the existing
`v1-shell.png`). To reproduce the live dashboard:
1. Ensure `az login` is active; restart the backend so it picks up `TELEMETRY_MODE=azure`.
2. Generate traffic: `curl https://album-api.victoriousmushroom-1217a769.westus3.azurecontainerapps.io/albums` (repeat).
3. Capture:
   - `phase9-monitored-services.png` — dashboard panel showing `album-api` with the `AZURE` source chip + live health.
   - `phase9-empty-state.png` — set `TELEMETRY_MODE=synthetic` to capture *"No monitored Azure services discovered"*.
   - `phase9-appinsights-requests.png` — App Insights → Logs blade with the `AppRequests` query above.

## 8. Remaining work before adding voting-app

1. **Deploy into the existing westus3 env, not eastus2** — run
   `./infra/deploy-voting-app.ps1 -ResourceGroup rg-opspilot -Location westus3`
   (eastus2 had the capacity failure; the env now lives in westus3). The
   `--only-show-errors` bug is already fixed in that script.
2. **Redis dependency cost** — the script provisions an internal `voting-redis`
   Container App at **min 1 replica (always-on)** → adds steady cost. Scale it to
   zero when idle: `az containerapp update -n voting-redis -g rg-opspilot --min-replicas 0 --max-replicas 0`.
3. **Python instrumentation** — voting-app (Flask/uwsgi) has no App Insights SDK.
   It will be **discovered** via `ContainerAppConsoleLogs_CL`, but for
   `AppRequests`/`AppExceptions` health it needs `azure-monitor-opentelemetry`
   (or `opencensus-ext-azure`) added to its image — the same instrumentation
   pattern applied to album-api's `bin/www`.
4. **Dependency-failure demo** — once live, scaling `voting-redis` to zero
   produces real exceptions for OpsPilot to root-cause (the canonical demo).
5. **No new region risk** — westus3 capacity is confirmed working, so voting-app
   should deploy without the eastus2 issue.

---

### Status: ✅ album-api is LIVE and visible inside OpsPilot through Azure discovery.
All seven parts complete. The dashboard contains no hardcoded services; inventory,
health, and agent telemetry all originate from real Azure Monitor data.
