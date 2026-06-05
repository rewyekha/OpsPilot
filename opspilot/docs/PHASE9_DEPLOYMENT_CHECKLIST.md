# Phase 9 — Live Azure Deployment & Telemetry Validation

**Scope:** Deploy ONE real workload (`demo-workloads/album-api`) and prove end-to-end
telemetry flow. No eShop, no Cosmos, no AI Search, no architecture changes, no GitHub push.

**Status of this document:** AUDIT + PLAN only. Nothing has been deployed or modified.

---

## 0. Audit results (Phase 8 artifacts)

| Artifact | Path | Status |
|----------|------|--------|
| `deploy-album-api.ps1` | `infra/deploy-album-api.ps1` | ✅ EXISTS |
| `AzureMonitorTelemetryProvider` | `backend/app/telemetry/azure_monitor.py:46` | ✅ EXISTS |
| `GET /api/system/services` | `backend/app/api/routes/services.py:36` | ✅ EXISTS |
| `TELEMETRY_MODE` feature flag | `backend/app/config.py:37` (`telemetry_mode="synthetic"`) | ✅ EXISTS |

All four Phase 8 foundations are present and verified.

---

## 1. Azure CLI authentication

`az account show` (cached identity):

| Field | Value |
|-------|-------|
| Subscription | **Azure for Students** |
| Subscription ID | `b22658fb-d33d-46a4-8dea-6667c8cfc246` |
| Tenant ID | `3c283067-cd89-42be-9bfc-712dfad00856` (Default Directory · `reyaskhan001gmail.onmicrosoft.com`) |
| User | `reyaskhan001@gmail.com` |
| Azure CLI | `2.83.0`, `containerapp` extension `1.3.0b3` |

> ⚠️ **BLOCKER — the CLI token is EXPIRED.** Although `az account show` returns cached
> data, every live ARM call (`az group list`, `az containerapp env list`,
> `az monitor log-analytics workspace list`) fails with:
> `AADSTS700082: The refresh token has expired due to inactivity` (issued 2026-03-02,
> inactive 90 days). **Re-authentication is required before any deploy or even before
> listing existing resources.** Fix:
> ```powershell
> az login --tenant "3c283067-cd89-42be-9bfc-712dfad00856"
> ```
> Because of this, the "use East US 2 unless resources already exist" check could
> **not** be performed (resource listing is blocked). Re-run §3's pre-flight after login.

> ℹ️ **Azure for Students note:** Container Apps, Log Analytics, and Application
> Insights are all available on student subscriptions. **Azure OpenAI / AI Foundry is
> typically NOT available** on student subs. That only affects the *LLM* path
> (`EXECUTION_MODE=foundry`) — keep `EXECUTION_MODE=mock` for this telemetry demo;
> `TELEMETRY_MODE` is independent of it.

---

## 2. Required Azure resources

All in one resource group, **East US 2** (defaults match `deploy-album-api.ps1`):

| # | Resource | Name (default) | Notes |
|---|----------|----------------|-------|
| 1 | Resource Group | `rg-opspilot-demo` | Lifecycle boundary |
| 2 | Log Analytics Workspace | `opspilot-logs` | KQL backend; provider queries its `customerId` |
| 3 | Application Insights | `opspilot-appinsights` | **Workspace-based** → `opspilot-logs` |
| 4 | Container Apps Environment | `opspilot-aca-env` | Wired to the workspace |
| 5 | Container App: **album-api** | `album-api` | External ingress, port **8080** |
| (auto) | Azure Container Registry | created by `az containerapp up` | Holds the built image |

---

## 3. Deployment order + exact commands

Pre-flight (after `az login`): check for pre-existing resources and switch region only
if they already exist elsewhere:
```powershell
az login --tenant "3c283067-cd89-42be-9bfc-712dfad00856"
az account set --subscription "b22658fb-d33d-46a4-8dea-6667c8cfc246"
az group exists --name rg-opspilot-demo
az monitor log-analytics workspace list -o table
```

### Option A (recommended): one idempotent script
`deploy-album-api.ps1` performs steps 1–5 in the correct order (RG → workspace →
App Insights → env → build+deploy → inject connection string). Run from `opspilot/`:
```powershell
./infra/deploy-album-api.ps1 -ResourceGroup rg-opspilot-demo -Location eastus2
```

### Option B: the exact manual commands the script runs (for transparency)
```powershell
$RG   = "rg-opspilot-demo"
$LOC  = "eastus2"
$LAW  = "opspilot-logs"
$AI   = "opspilot-appinsights"
$ENV  = "opspilot-aca-env"
$APP  = "album-api"
$SRC  = "./demo-workloads/album-api/src"

# 0. Extensions / providers
az extension add --name containerapp --upgrade
az extension add --name application-insights --upgrade
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait

# 1. Resource Group
az group create --name $RG --location $LOC

# 2. Log Analytics Workspace
az monitor log-analytics workspace create -g $RG -n $LAW --location $LOC
$WORKSPACE_ID  = az monitor log-analytics workspace show -g $RG -n $LAW --query customerId -o tsv
$WORKSPACE_RID = az monitor log-analytics workspace show -g $RG -n $LAW --query id -o tsv

# 3. Application Insights (workspace-based)
az monitor app-insights component create --app $AI -g $RG --location $LOC --workspace $WORKSPACE_RID
$AI_CONN = az monitor app-insights component show --app $AI -g $RG --query connectionString -o tsv

# 4. Container Apps Environment (created by `up` on first run; or explicitly:)
$WORKSPACE_KEY = az monitor log-analytics workspace get-shared-keys -g $RG -n $LAW --query primarySharedKey -o tsv
az containerapp env create -n $ENV -g $RG --location $LOC `
    --logs-workspace-id $WORKSPACE_ID --logs-workspace-key $WORKSPACE_KEY

# 5. Album API Container App (cloud build from local source)
az containerapp up -n $APP -g $RG --location $LOC --environment $ENV `
    --source $SRC --ingress external --target-port 8080 --logs-workspace-id $WORKSPACE_ID

# 6. Inject App Insights connection string
az containerapp update -n $APP -g $RG `
    --set-env-vars "APPLICATIONINSIGHTS_CONNECTION_STRING=$AI_CONN" "OPSPILOT_SERVICE_NAME=$APP"
```

---

## 4. album-api project inspection

| Check | Result | Verdict |
|-------|--------|---------|
| Dockerfile valid | `node:lts-alpine`, prod install, `USER node`, `EXPOSE 8080`, `CMD ["npm","start"]` | ✅ READY |
| Exposed port | `8080` (`EXPOSE 8080`; `bin/www` → `process.env.PORT \|\| "8080"`) | ✅ READY |
| Startup command | `npm start` → `node ./bin/www` (creates HTTP server, `server.listen(port)`) | ✅ READY |
| Health endpoint | **No `/health` route.** `GET /` returns `200` JSON (`{message:...}`); `GET /albums` returns the album list | ⚠️ MINOR — use `GET /` as the liveness/health target |
| App Insights SDK | **Absent** — deps are only `express`, `axios`, `morgan`. No `applicationinsights` package, no `appInsights.setup()` | ⛔ BLOCKER for App-Insights metrics (see §6) |

**Implication:** Container Apps does **not** auto-instrument Node for Application
Insights (unlike App Service). With no SDK, the App Insights tables the provider queries
(`AppRequests`, `AppExceptions`, `AppDependencies`) **stay empty** — only raw
`ContainerAppConsoleLogs_CL` (stdout) would populate. Telemetry flow therefore requires
adding the App Insights Node SDK to album-api (§6).

---

## 5. LIVE DEPLOYMENT PLAN (telemetry flow)

```
   ┌──────────────────────────────────────────────────────────────┐
   │ album-api  (Container App, East US 2, ext ingress :8080)      │
   │   GET / , GET /albums   ──emits──▶ requests / exceptions      │
   │   ⚠ needs `applicationinsights` SDK to emit AppRequests       │
   └───────────────────────────────┬──────────────────────────────┘
                                    │ APPLICATIONINSIGHTS_CONNECTION_STRING
                                    ▼
                       ┌──────────────────────────┐
                       │  Application Insights     │  (workspace-based)
                       │  AppRequests / AppExceptions / AppDependencies
                       └───────────────┬──────────┘
                                       │ (same workspace)
                                       ▼
                       ┌──────────────────────────┐
                       │  Log Analytics Workspace  │  opspilot-logs
                       │  customerId = WORKSPACE_ID │
                       └───────────────┬──────────┘
                                       │ KQL (azure-monitor-query + DefaultAzureCredential)
                                       ▼
            ┌───────────────────────────────────────────────────┐
            │ AzureMonitorTelemetryProvider (TELEMETRY_MODE=azure)│
            │   list_services · get_service_health ·             │
            │   query_error_rate/latency/throughput · query_logs │
            └───────────────────────────┬───────────────────────┘
                                        │
                   ┌────────────────────┴───────────────────┐
                   ▼                                        ▼
   GET /api/system/services                  Metrics/Logs agents
   → "Monitored Services" panel              (⚠ still import fixtures — wire to provider)
                   │                                        │
                   └──────────────────┬─────────────────────┘
                                      ▼
                          OpsPilot Dashboard (localhost:3000)
```

---

## 6. Code/config changes required before `TELEMETRY_MODE=azure`

| # | Item | Detail | Classification |
|---|------|--------|----------------|
| 1 | Re-authenticate Azure CLI | Token expired (`AADSTS700082`); `az login --tenant 3c283067-…` | ⛔ **BLOCKER** |
| 2 | Add App Insights SDK to album-api | `npm i applicationinsights`; add `require("applicationinsights").setup().start();` at the top of `bin/www`/`app.js`. Without it `AppRequests` stays empty → provider returns no data | ⛔ **BLOCKER** (for App-Insights-based metrics) |
| 3 | Install `azure-monitor-query` | Not in `pyproject.toml` (only `azure-identity` is, and `azure` isn't importable in the active interpreter). `pip install azure-monitor-query azure-identity` + add to `pyproject.toml` | 🟡 **MINOR WORK** |
| 4 | Wire Metrics/Logs agents to the provider | `metrics/agent.py` & `logs/agent.py` still `import from app.tools.metrics_tools/logs_tools`. Switch to `get_telemetry_provider().query_*` (drop-in; same return shapes). Until then agents read fixtures even in azure mode | 🟡 **MINOR WORK** |
| 5 | Backend `.env` for azure mode | Set `TELEMETRY_MODE=azure`, `AZURE_LOG_ANALYTICS_WORKSPACE_ID=<customerId>`, `APPLICATIONINSIGHTS_CONNECTION_STRING=<conn>` | 🟡 **MINOR WORK** |
| 6 | RBAC: Monitoring Reader | Grant the backend identity (or `az login` user) **Monitoring Reader** on the workspace + App Insights | 🟡 **MINOR WORK** |
| — | `deploy-album-api.ps1` | Idempotent, correct order, injects connection string | ✅ **READY** |
| — | `AzureMonitorTelemetryProvider` | KQL written, lazy SDK import, graceful errors | ✅ **READY** |
| — | `GET /api/system/services` | Returns provider health roster (200 verified) | ✅ **READY** |
| — | album-api Dockerfile/port/startup | Valid, port 8080, `npm start` | ✅ **READY** |

**Minimum path to a working `GET /api/system/services` against Azure:** items 1, 3, 5, 6
(the services endpoint uses `get_service_health`, which works off `AppRequests`; item 2
is required for those rows to be non-empty). **Full live *investigations*** additionally
need item 4.

---

## 7. Validation commands (post-deploy)

```powershell
# A. App is up
$FQDN = az containerapp show -n album-api -g rg-opspilot-demo --query properties.configuration.ingress.fqdn -o tsv
curl "https://$FQDN/"          # → {"message":"Call the /albums route..."}
curl "https://$FQDN/albums"    # → album JSON (generates a request)

# B. Telemetry landed in App Insights (wait 2–5 min after traffic)
az monitor app-insights query --app opspilot-appinsights -g rg-opspilot-demo `
    --analytics-query "AppRequests | where AppRoleName == 'album-api' | summarize count() by bin(TimeGenerated, 1m) | order by TimeGenerated desc"

# C. Provider sees it (with TELEMETRY_MODE=azure backend running)
curl http://localhost:8000/api/system/services    # → telemetryMode:"azure", album-api row

# D. Dashboard
# open http://localhost:3000 → "Monitored Services" panel shows album-api (source chip: AZURE)
```

---

## 8. Rollback steps

```powershell
# Soft rollback — stop telemetry source / cost, keep resources
az containerapp update -n album-api -g rg-opspilot-demo --min-replicas 0 --max-replicas 0

# Revert OpsPilot to synthetic (instant, no Azure dependency)
#   backend/.env →  TELEMETRY_MODE=synthetic    (then restart backend)

# Hard rollback — delete everything (stops all charges)
az group delete --name rg-opspilot-demo --yes --no-wait
```
The synthetic provider is never removed, so flipping `TELEMETRY_MODE=synthetic` is a
zero-risk fallback at any time.

---

## 9. Judge Demo Flow

1. **Deploy album-api**
   `./infra/deploy-album-api.ps1 -ResourceGroup rg-opspilot-demo -Location eastus2`
   → prints the public URL.
2. **Generate traffic**
   `for ($i=0; $i -lt 200; $i++) { curl "https://$FQDN/albums" | Out-Null }`
   (and a few bad paths, e.g. `curl "https://$FQDN/nope"`, to create failures/exceptions).
3. **View telemetry** — run validation §7B (App Insights `AppRequests` count climbing),
   then open the dashboard's **Monitored Services** panel showing `album-api` with a live
   `AZURE` source chip, real response time, and error rate.
4. **Trigger investigation** — open an incident for `album-api` (manually or via the
   incident detector); the Metrics/Logs agents (once wired, item 4) read the live App
   Insights signals.
5. **Show recommendations** — the Root Cause + Recommendation agents produce findings and
   a remediation playbook on the dashboard, end-to-end from real Azure telemetry.

---

## 10. Summary

| | |
|---|---|
| **Azure readiness score** | **6 / 10** — all OpsPilot scaffolding (script, provider, endpoint, flag) and the workload (Dockerfile/port/startup) are READY; live telemetry is gated by 2 blockers (CLI auth, album-api instrumentation) + minor wiring |
| **Blockers** | (1) Azure CLI token expired → `az login`; (2) album-api has no App Insights SDK → App Insights tables stay empty |
| **Next command** | `az login --tenant "3c283067-cd89-42be-9bfc-712dfad00856"` |
