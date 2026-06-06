# OpsPilot — Demo Deployment Runbook

Deploy and validate real Azure workloads **one at a time**, feeding live telemetry
into OpsPilot. Each phase has an exact command, expected output, a validation
command, and a rollback command.

> **Azure AI Foundry (`opspilot-agenthub` + `o4-mini`) is an EXTERNAL dependency.**
> Nothing here provisions, updates, or deletes it — it is only *validated*.

## Prerequisites

- Azure CLI ≥ 2.53 with the `containerapp` extension; **`az login`** completed.
- PowerShell 7+ (`pwsh`). Run all scripts from `infra/scripts/`.
- The demo workloads cloned under `demo-workloads/` (see `demo-workloads/README.md`).
- Foundry credentials available for Phase 2:
  `FOUNDRY_ENDPOINT`, `FOUNDRY_API_KEY` (e.g. exported as env vars).

## Dependency diagram

```
                         Azure AI Foundry (EXTERNAL — never provisioned)
                         ┌───────────────────────────────────────────┐
                         │  opspilot-agenthub  ·  o4-mini deployment   │
                         └───────────────▲─────────────────────────────┘
                                         │ validated by validate-core-infra.ps1
                                         │ (reachable · auth · deployment · invoke)
   main.bicep ──────────────────────────┼─────────────────────────────────────────
                                         │
   ┌─────────────────┐   ┌───────────────────────┐   ┌───────────────────────┐
   │ Managed Identity │──▶│ Key Vault (RBAC)       │   │ Container Registry     │ (optional)
   │ (keyless auth)   │   │  ← Secrets User         │   │  ← AcrPull             │
   └────────┬─────────┘   └───────────────────────┘   └───────────┬───────────┘
            │ AcrPull                                              │ build/push
            │                                                      │
   ┌────────▼──────────────────────────────────────────────────────▼───────────┐
   │ Container Apps Environment (cae-opspilot-<env>)                              │
   │   ├─ album-api   (Phase 3, port 8080)                                        │
   │   └─ voting-app  (Phase 5, port 80) ──needs──▶ voting-redis (internal :6379) │
   └───────────────────────────┬─────────────────────────────────────────────────┘
                               │ console/system logs + App Insights telemetry
                               ▼
   ┌──────────────────────────────────────────────┐
   │ Log Analytics Workspace (log-opspilot-<env>)  │◀── Application Insights
   │   AppRequests / AppExceptions / *ConsoleLogs  │     (appi-opspilot-<env>, workspace-based)
   └───────────────────────────┬───────────────────┘
                               │ KQL (azure-monitor-query)
                               ▼
                    OpsPilot backend (TELEMETRY_MODE=azure)
```

---

## Phase 1 — Deploy core infrastructure

**Command**
```powershell
cd infra/scripts
./deploy-core-infra.ps1 -ResourceGroup rg-opspilot -Location eastus2 -Environment dev
```

**Expected output (tail)**
```
==> Core infrastructure deployed
  Log Analytics       : log-opspilot-dev (customerId xxxxxxxx-....)
  Application Insights : appi-opspilot-dev
  Managed Identity     : clientId xxxxxxxx-....
  Key Vault            : kv-opspilot-xxxxxxxx (https://kv-opspilot-....vault.azure.net/)
  Container Apps Env    : cae-opspilot-dev
  Container Registry    : cropspilotdev....azurecr.io
  Backend (.env) for live telemetry investigations:
    TELEMETRY_MODE=azure
    AZURE_LOG_ANALYTICS_WORKSPACE_ID=xxxxxxxx-....
    APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=...
```

**Validation command** → Phase 2.

**Rollback command**
```powershell
./destroy-demo-apps.ps1 -ResourceGroup rg-opspilot -IncludeCoreInfra -Force   # never deletes Foundry / the RG
```

---

## Phase 2 — Validate infrastructure (+ Foundry)

**Command**
```powershell
./validate-core-infra.ps1 -ResourceGroup rg-opspilot -Environment dev `
    -FoundryEndpoint $env:FOUNDRY_ENDPOINT -FoundryApiKey $env:FOUNDRY_API_KEY
```

**Expected output**
```
[ OK  ] Log Analytics Workspace — log-opspilot-dev
[ OK  ] Application Insights — appi-opspilot-dev
[ OK  ] Container Apps Environment — cae-opspilot-dev (Succeeded)
[ OK  ] Managed Identity — id-opspilot-dev
[ OK  ] Key Vault — kv-opspilot-xxxxxxxx
[ OK  ] Foundry connectivity — https://opspilot-agenthub-resource.services.ai.azure.com
[ OK  ] Foundry authentication — api-key accepted
[ OK  ] o4-mini deployment — o4-mini present
[ OK  ] o4-mini invocation test — chat completion 200
OVERALL: PASS  (9 checks, 0 failed, 0 warnings)
```
Returns exit code 0 on PASS/WARNING, 1 on any FAIL.

**Validation command** — this *is* the validation. **Rollback** — n/a (read-only).

---

## Phase 3 — Deploy album-api

**Command**
```powershell
./deploy-album-api.ps1 -ResourceGroup rg-opspilot -Environment dev
```

**Expected output (tail)**
```
==> album-api deployed
  URL          : https://album-api.<env-domain>.azurecontainerapps.io
  Test endpoint: https://album-api.<env-domain>.azurecontainerapps.io/albums
```

**Validation command** → Phase 4.

**Rollback command**
```powershell
az containerapp delete -n album-api -g rg-opspilot --yes
# or: ./destroy-demo-apps.ps1 -ResourceGroup rg-opspilot   (removes all demo apps)
```

---

## Phase 4 — Validate album-api

**Generate telemetry first**
```powershell
$u = az containerapp show -n album-api -g rg-opspilot --query properties.configuration.ingress.fqdn -o tsv
1..120 | ForEach-Object { Invoke-WebRequest "https://$u/albums" -SkipHttpErrorCheck | Out-Null }
1..20  | ForEach-Object { Invoke-WebRequest "https://$u/nope-$_" -SkipHttpErrorCheck | Out-Null }  # failures
```

**Command**
```powershell
./validate-album-api.ps1 -ResourceGroup rg-opspilot -Environment dev
```

**Expected output**
```
[ OK  ] album-api deployment — Succeeded
[ OK  ] album-api ingress URL — https://album-api.<env-domain>.azurecontainerapps.io
[ OK  ] album-api health endpoint — HTTP 200 /
[ OK  ] album-api telemetry — N records in last hour
OVERALL: PASS  (4 checks, 0 failed, 0 warnings)
```
*Telemetry may show `WARNING` for 2–5 min after first traffic (ingestion lag) — re-run.*

**Rollback command**
```powershell
az containerapp delete -n album-api -g rg-opspilot --yes
```

---

## Phase 5 — Deploy voting-app

**Command**
```powershell
./deploy-voting-app.ps1 -ResourceGroup rg-opspilot -Environment dev
```

**Expected output (tail)**
```
==> voting-app deployed
  URL          : https://voting-app.<env-domain>.azurecontainerapps.io
  Redis backend: voting-redis.internal.<env-domain>... (internal, voting-redis)
  💥 Stage a dependency-failure incident:
     az containerapp update --name voting-redis -g rg-opspilot --min-replicas 0 --max-replicas 0
```

**Validation command** → Phase 6.

**Rollback command**
```powershell
az containerapp delete -n voting-app   -g rg-opspilot --yes
az containerapp delete -n voting-redis -g rg-opspilot --yes
```

---

## Phase 6 — Validate voting-app

**Generate telemetry first**
```powershell
$u = az containerapp show -n voting-app -g rg-opspilot --query properties.configuration.ingress.fqdn -o tsv
1..80 | ForEach-Object { Invoke-WebRequest "https://$u/" -SkipHttpErrorCheck | Out-Null }
```

**Command**
```powershell
./validate-voting-app.ps1 -ResourceGroup rg-opspilot -Environment dev
```

**Expected output**
```
[ OK  ] voting-app deployment — Succeeded
[ OK  ] voting-app ingress URL — https://voting-app.<env-domain>.azurecontainerapps.io
[ OK  ] voting-app health endpoint — HTTP 200 /
[ OK  ] voting-app telemetry — N records in last hour
OVERALL: PASS  (4 checks, 0 failed, 0 warnings)
```

**Rollback command**
```powershell
az containerapp delete -n voting-app -g rg-opspilot --yes
az containerapp delete -n voting-redis -g rg-opspilot --yes
```

---

## Post-deployment — point OpsPilot at live telemetry

In `backend/.env` (then restart the backend):
```dotenv
TELEMETRY_MODE=azure
AZURE_LOG_ANALYTICS_WORKSPACE_ID=<logAnalyticsCustomerId from Phase 1>
APPLICATIONINSIGHTS_CONNECTION_STRING=<from Phase 1>
# keep the existing EXECUTION_MODE=foundry + o4-mini settings
```
`GET /api/system/services` now discovers `album-api` / `voting-app` from real Azure telemetry; the dashboard "Monitored Services" panel shows them live.

## Full teardown (demo apps only — Foundry preserved)
```powershell
./destroy-demo-apps.ps1 -ResourceGroup rg-opspilot
# add -IncludeCoreInfra -Force to also remove core infra (never Foundry, never the RG)
```

## Idempotency & safety
- Every `deploy-*` script is safe to re-run (incremental Bicep / `containerapp up` update-in-place / guarded Redis create).
- Every `validate-*` script is read-only and returns **PASS / FAIL / WARNING** (exit 1 on FAIL).
- No script ever creates, updates, or deletes Azure AI Foundry resources.
