# OpsPilot — Phase 8 Azure Architecture

Phase 8 turns OpsPilot from a synthetic-fixture demo into a system that
investigates **real Azure workloads**. This document describes the Azure
resources, how telemetry flows from the demo workloads into OpsPilot, and how
the new `TelemetryProvider` abstraction maps onto these resources.

## Resource topology

```
Subscription
└─ Resource Group: rg-opspilot-demo
   │
   ├─ Container Apps Environment: opspilot-aca-env
   │   ├─ Container App: album-api      (Node/Express, ext ingress :8080)
   │   ├─ Container App: voting-app      (Flask, ext ingress :80)
   │   └─ Container App: voting-redis    (redis:6, internal ingress :6379)
   │
   ├─ Application Insights: opspilot-appinsights   (workspace-based)
   ├─ Log Analytics Workspace: opspilot-logs       (telemetry + ACA console/system logs)
   └─ Azure AI Foundry: opspilot-foundry           (o4-mini — agent reasoning)
```

> The expected Phase 8 architecture (per the task) is exactly:
> **Resource Group → 2 Container Apps (album-api, voting-app) + Application
> Insights + Log Analytics Workspace + Azure AI Foundry.** `voting-redis` is an
> internal supporting container for the voting-app dependency and is not a
> monitored "service" in its own right (though killing it is the canonical
> demo incident).

## Data flow

```
┌─────────────────┐   requests / exceptions / traces / dependencies
│  album-api      │ ─────────────────────────────────────────────┐
│  voting-app     │                                               │
└─────────────────┘                                               ▼
        │ stdout/stderr                                  ┌──────────────────────┐
        │ (console + system logs)                        │ Application Insights │
        ▼                                                │  (workspace-based)   │
┌──────────────────────────┐                             └──────────┬───────────┘
│ Log Analytics Workspace  │ ◄───────────────────────────────────── │
│  • ContainerAppConsoleLogs_CL                                      │ (same workspace)
│  • AppRequests / AppExceptions / AppDependencies (App Insights)    │
└──────────┬───────────────┘                                        │
           │   KQL (azure-monitor-query SDK)                        │
           ▼                                                        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ OpsPilot backend  —  AzureMonitorTelemetryProvider (TELEMETRY_MODE=azure)   │
│   list_services() · get_service_health() · query_metrics() · query_logs()   │
│   detect_incidents()                                                        │
└───────────────────────────┬───────────────────────────────────────────────┘
                            │ findings → LLM
                            ▼
                  ┌──────────────────────┐
                  │  Azure AI Foundry    │  o4-mini — root cause / recommendations
                  │  (o4-mini deployment)│
                  └──────────────────────┘
```

## Resource details

| Resource | Name (default) | Purpose | Key config |
|----------|----------------|---------|------------|
| Resource Group | `rg-opspilot-demo` | Lifecycle boundary for all demo resources | Region: `eastus2` |
| Container Apps Env | `opspilot-aca-env` | Shared runtime + internal network for the workloads | Wired to Log Analytics |
| Container App | `album-api` | Node/Express REST API (latency/error demos) | External ingress, port 8080 |
| Container App | `voting-app` | Flask web UI (dependency-failure demos) | External ingress, port 80, `REDIS` env |
| Container App | `voting-redis` | Internal Redis dependency for voting-app | Internal ingress, port 6379, TCP |
| Application Insights | `opspilot-appinsights` | App-level telemetry (requests, exceptions, dependencies, traces) | **Workspace-based** → `opspilot-logs` |
| Log Analytics Workspace | `opspilot-logs` | Single query backend (App Insights tables + ACA logs) | `customerId` = workspace GUID OpsPilot queries |
| Azure AI Foundry | `opspilot-foundry` | o4-mini deployment for agent reasoning / RCA | Existing `EXECUTION_MODE=foundry` path |

### Why workspace-based Application Insights

Both App Insights telemetry **and** Container Apps console/system logs land in the
**same Log Analytics workspace**. That lets `AzureMonitorTelemetryProvider` issue
a single class of KQL queries (via `azure-monitor-query`) against one workspace
ID — App-Insights tables (`AppRequests`, `AppExceptions`, `AppDependencies`) for
golden-signal metrics, and `ContainerAppConsoleLogs_CL` for raw app logs.

## How the abstraction maps to resources

| `TelemetryProvider` method | `synthetic` source | `azure` source (Log Analytics / App Insights) |
|----------------------------|--------------------|-----------------------------------------------|
| `list_services()` | Static demo roster | `AppRequests \| distinct AppRoleName` |
| `get_service_health(svc)` | Fixture-derived | `AppRequests`/`AppExceptions` rollup over last 5 min |
| `query_metrics(svc)` | `metrics_tools.py` fixtures | `AppRequests` (duration p99, count, failures) |
| `query_logs(svc)` | `logs_tools.py` fixtures | `AppExceptions` + `ContainerAppConsoleLogs_CL` |
| `detect_incidents()` | Pre-baked checkout incident | Threshold scan over `AppRequests`/`AppExceptions` |

Selection is controlled by the `TELEMETRY_MODE` feature flag
(`synthetic` | `azure`). The synthetic provider is **never removed** — it remains
the zero-credential default for local dev, CI, and the offline demo.

## Identity & access (production hardening)

- Container Apps use **system-assigned managed identity**; the OpsPilot backend
  uses **managed identity** (or `DefaultAzureCredential` locally) to read the
  workspace — no keys in the app.
- Required RBAC for the OpsPilot backend identity:
  - **Monitoring Reader** on the Log Analytics workspace + App Insights component.
  - **Reader** on the resource group (to enumerate Container Apps for `list_services`).
- App Insights connection string is injected into each workload via Container App
  env vars (set by the deploy scripts), sourced from Key Vault in production.

## Provisioning order

1. `az group create` → resource group.
2. Log Analytics workspace (`opspilot-logs`).
3. Workspace-based Application Insights (`opspilot-appinsights`).
4. Container Apps Environment + Managed Identity + Key Vault.
5. `scripts/deploy-album-api.ps1` and `scripts/deploy-voting-app.ps1` (build +
   deploy workloads, inject the App Insights connection string).
6. Configure OpsPilot backend `.env`:
   `TELEMETRY_MODE=azure`, `AZURE_LOG_ANALYTICS_WORKSPACE_ID`,
   `APPLICATIONINSIGHTS_CONNECTION_STRING`, plus the existing
   `EXECUTION_MODE=foundry` Foundry settings.

Steps 1–4 are provisioned by `bicep/main.bicep` via
[`scripts/deploy-core-infra.ps1`](./scripts/deploy-core-infra.ps1). The refactored
Bicep provisions **only** the core OpsPilot infrastructure — Log Analytics,
Application Insights, Managed Identity, Key Vault, Container Apps Environment, and
an optional Container Registry. **Azure AI Foundry is an external dependency and
is never provisioned** (only validated); there is no Cosmos DB / AI Search / Redis
(the file-based investigation store is the source of truth). See
[`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md) and [`COST_ESTIMATE.md`](./COST_ESTIMATE.md).
