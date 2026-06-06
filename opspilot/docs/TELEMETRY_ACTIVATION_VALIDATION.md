# OpsPilot — Azure Telemetry Activation & Validation

Validation-only pass (no infrastructure deployed, no resources created, Foundry
untouched). Goal: confirm whether OpsPilot can run in real Azure telemetry mode
and whether the environment is ready for infrastructure deployment.

## Task 1 — Telemetry configuration audit

| Question | Finding |
|----------|---------|
| Where is `TELEMETRY_MODE` loaded? | `backend/app/config.py` → `Settings.telemetry_mode` (pydantic-settings, default `"synthetic"`). Resolved via `app/telemetry/factory.py::resolve_telemetry_mode()`. |
| Is `.env` actually read? | **Yes.** `SettingsConfigDict(env_file=".env")`; the app loaded `telemetry_mode=synthetic` from it. |
| Do env vars override `.env`? | **Yes** — pydantic-settings precedence is process env > `.env` > defaults (verified: setting `TELEMETRY_MODE` in the environment switched the active mode). |
| Are providers cached? | **Yes.** `get_telemetry_provider()` is `@lru_cache` (process-wide singleton); `get_settings()` is `@lru_cache` too. **A running backend must be restarted (or caches cleared) after editing `.env`.** |
| Is the Azure provider reachable? | Code path is correct (`azure-monitor-query` + `azure-identity` installed; `AzureMonitorTelemetryProvider` builds a `LogsQueryClient` with `DefaultAzureCredential`). **But there is no Log Analytics workspace to query** (see Task 4). |

Behavioral proof (FastAPI TestClient):
```
synthetic (current .env)         → HTTP 200  {"telemetryMode":"synthetic","services":[]}
azure, NO workspace id           → HTTP 500  (provider __init__ raises TelemetryConfigurationError)
azure, WITH a workspace id       → HTTP 200  {"telemetryMode":"azure","services":[]}
```

## Task 2 — Switch to Azure telemetry (blocked: required settings missing)

Current `backend/.env`: `TELEMETRY_MODE=synthetic`, **no** `AZURE_LOG_ANALYTICS_WORKSPACE_ID`,
**no** `APPLICATIONINSIGHTS_CONNECTION_STRING` (config defaults are empty strings).

**Missing (not invented):**
- `AZURE_LOG_ANALYTICS_WORKSPACE_ID` — the workspace `customerId` GUID.
- `APPLICATIONINSIGHTS_CONNECTION_STRING` — the App Insights connection string.

Both come from a deployed Log Analytics workspace + App Insights, which **do not
exist** (torn down in the prior cleanup). Command to obtain them (this is the
**next** phase — infrastructure deployment — intentionally NOT run here):
```powershell
infra/scripts/deploy-core-infra.ps1 -ResourceGroup rg-opspilot -Environment dev
#  → outputs AZURE_LOG_ANALYTICS_WORKSPACE_ID + APPLICATIONINSIGHTS_CONNECTION_STRING
```
> Flipping `TELEMETRY_MODE=azure` **without** a workspace id makes `/api/system/services`
> return HTTP 500, so the flag was **not** switched — keeping synthetic is the safe state
> until the workspace exists.

## Task 3 — Azure authentication

`az account show` → **PASS**
- Subscription: **Azure for Students** (`b22658fb-d33d-46a4-8dea-6667c8cfc246`)
- Tenant: `3c283067-cd89-42be-9bfc-712dfad00856`
- User: `reyaskhan001@gmail.com` · State: **Enabled**
- Live ARM calls succeed (the resource-list queries below returned real results).

Required later: grant the query principal **Monitoring Reader** on the workspace
once it exists (DefaultAzureCredential uses this az-login locally).

## Task 4 — Azure telemetry provider verification

| Check | Result |
|-------|--------|
| Workspace reachable | **FAIL** — `az monitor log-analytics workspace list` = **none in the subscription** |
| Application Insights reachable | **FAIL** — `az resource list --resource-type Microsoft.Insights/components` = **none** |
| Azure Monitor queries succeed | **BLOCKED** — no workspace to query (code path verified via throwaway-GUID test → graceful `[]`) |
| Service discovery succeeds | Returns `[]` (no workspace → query fails → empty), not synthetic data |
| Synthetic provider not used (in azure mode) | **Confirmed** — azure mode selects `AzureMonitorTelemetryProvider`, never synthetic |

`{ "telemetryMode": "azure" }` is reachable in code **only once a real workspace id
is supplied** — which requires the infra deployment.

## Task 5 — Live endpoint validation

`/health` → `{"status":"healthy","service":"opspilot-api","version":"0.2.0"}`
`/api/system/services` → `{"telemetryMode":"synthetic","services":[]}` (current, safe state)

The mode is intentionally **synthetic**, not azure, because the Azure telemetry
resources do not exist yet. Switching is a one-line change **after** infra deploy.

## Task 6 — End-to-end telemetry validation

| Capability | Status |
|-----------|--------|
| Connect to Azure Monitor | **BLOCKED** (no workspace) — SDK + auth ready |
| Query Log Analytics | **BLOCKED** (no workspace); code path verified |
| Enumerate monitored services | Returns `[]` (no workloads deployed) |
| Retrieve health info | **BLOCKED** (no telemetry source) |
| Ingest telemetry | **BLOCKED** (no App Insights, no instrumented workloads) |
| Power dashboard from Azure | **BLOCKED** (depends on the above) |

The end-to-end pipeline is **wired and code-verified**, but has **no live telemetry
source** until the core infra + a workload are deployed.

## Task 7 — Production readiness report

### ✅ PASS
- Azure authentication (live, correct subscription/tenant/user, enabled).
- Azure SDKs installed: `azure-monitor-query`, `azure-identity`.
- **External dependency — Foundry o4-mini: invocation test HTTP 200** (`model=o4-mini-2025-04-16`).
- Telemetry abstraction is correct: synthetic→`{synthetic,[]}`, azure(+workspace)→`{azure,[]}`.
- `.env` is read; env overrides `.env`; providers cached (restart applies changes).
- Deploy/validate scripts + Bicep for the core infra exist and compile (prior phase).

### ⚠️ WARNING
- **`/api/system/services` returns HTTP 500 if `TELEMETRY_MODE=azure` is set without a workspace id** — `get_telemetry_provider()` is called outside the route's try/except. Recommended hardening: move it inside the try (or fall back to synthetic) so a misconfig degrades to `{azure,[]}` instead of 500. (Not changed — validation-only pass.)
- Subscription is **Azure for Students** — quota/region capacity limits may affect the upcoming Container Apps deployment (eastus2 ACA capacity issues were seen previously).
- Grant **Monitoring Reader** to the query principal on the new workspace after deploy.

### ❌ FAIL (blocks *real azure telemetry*, expected pre-deployment)
- **No Log Analytics workspace** → `AZURE_LOG_ANALYTICS_WORKSPACE_ID` unavailable.
- **No Application Insights** → `APPLICATIONINSIGHTS_CONNECTION_STRING` unavailable.
- **No monitored workloads** (album-api / voting-app not deployed) → nothing to discover even once the workspace exists.

All three FAILs are resolved by the **infrastructure deployment** (the next phase),
not by any change available in this validation-only pass.

## Task 8 — Deployment gate

### ✅ READY FOR INFRA DEPLOYMENT

**Justification.** Everything that can be validated *before* infrastructure exists
passes: Azure auth is live and correct, the Azure SDKs are installed, the external
Foundry/o4-mini dependency is healthy (HTTP 200), and the telemetry code correctly
serves real Azure mode once a workspace id is supplied. The only items that FAIL —
the Log Analytics workspace, Application Insights, and monitored workloads — **are
precisely the resources the next phase (`deploy-core-infra.ps1` → `deploy-album-api.ps1`)
provisions.** They cannot exist in a validation-only pass and do not block the
deployment itself.

Real Azure telemetry activation is therefore **deferred to immediately after infra
deployment**:

```text
1. infra/scripts/deploy-core-infra.ps1 -ResourceGroup rg-opspilot -Environment dev
2. Set in backend/.env:
     TELEMETRY_MODE=azure
     AZURE_LOG_ANALYTICS_WORKSPACE_ID=<deploy output: logAnalyticsCustomerId>
     APPLICATIONINSIGHTS_CONNECTION_STRING=<deploy output>
3. Restart the backend  →  GET /api/system/services  →  {"telemetryMode":"azure", ...}
4. Deploy a workload (album-api) + generate traffic → services appear.
```

OpsPilot is correctly in synthetic mode today (no telemetry resources exist) and is
**ready for infrastructure deployment**, after which azure telemetry activates with
the steps above.
