# OpsPilot demo-failure scenarios

PowerShell scripts that intentionally break a deployed Azure Container App (default
`album-api`) so OpsPilot's autonomous monitor detects the resulting telemetry
anomaly and **auto-creates an incident**. Each scenario can also **roll itself
back** to the exact pre-mutation state.

All scripts share one param contract so a backend runner can invoke them uniformly:

```powershell
param(
  [Parameter(Mandatory)][string]$ResourceGroup,
  [string]$AppName = 'album-api',
  [string]$BaseUrl = '',          # resolved from az ingress fqdn if empty
  [switch]$Rollback,              # when present, UNDO the scenario
  [int]$DurationSeconds = 180
)
```

Every run ends with a single machine-parseable line:

```
SCENARIO_DONE <id> <execute|rollback> <ok|fail>
```

## Scenarios

| id | What it does | Expected OpsPilot incident (severity) | Execute | Rollback |
|----|--------------|----------------------------------------|---------|----------|
| `high-error-rate` | Floods a non-existent path (`/__opspilot_fault__`) with high-volume parallel requests → 404s counted as failed requests, pushing the 5-min error rate above 20%. **No infra change.** | Elevated error rate (**P1/P2**) | `./high-error-rate.ps1 -ResourceGroup <rg>` | `./high-error-rate.ps1 -ResourceGroup <rg> -Rollback` (bursts healthy `GET /albums` 200s to dilute the rate) |
| `latency-spike` | Heavy concurrent load on `GET /albums` to drive p95 latency up via queueing. **No infra change.** Best-effort — depends on the app saturating. | Elevated latency / p95 (**P2**) | `./latency-spike.ps1 -ResourceGroup <rg>` | `./latency-spike.ps1 -ResourceGroup <rg> -Rollback` (stops load; latency self-heals) |
| `deployment-regression` | Captures the current image, then deploys a broken revision (`aci-helloworld:nonexistent-tag-opspilot`) that fails to pull → unhealthy revision / errors. | Post-deploy error spike / service-down (**P1**) | `./deployment-regression.ps1 -ResourceGroup <rg>` | `./deployment-regression.ps1 -ResourceGroup <rg> -Rollback` (restores captured image) |
| `service-outage` | Captures current min/max replicas, then scales to zero (`--min-replicas 0 --max-replicas 0`) → unreachable. | Service down / availability (**P1**) | `./service-outage.ps1 -ResourceGroup <rg>` | `./service-outage.ps1 -ResourceGroup <rg> -Rollback` (restores captured replicas; defaults to 1/1) |
| `restart-storm` | Captures the current image, then forces a crash loop with an unpullable image (`aci-helloworld:nonexistent-restart-opspilot`) → repeated failed starts. | Container instability / restart storm (**P1**) | `./restart-storm.ps1 -ResourceGroup <rg>` | `./restart-storm.ps1 -ResourceGroup <rg> -Rollback` (restores captured image) |

> `<rg>` = your resource group (e.g. `rg-opspilot`). Pass `-AppName` to target a
> different container app, and `-BaseUrl` to skip ingress-FQDN resolution.

## How it works

- **Capture before mutate.** Scenarios that change infrastructure (image / replicas)
  read the live value first and persist it to a temp state file
  `"$env:TEMP/opspilot-scenario-<AppName>-<id>.json"`, so `-Rollback` restores the
  *exact* original. Traffic-only scenarios (`high-error-rate`, `latency-spike`)
  write a marker file only.
- **Idempotent & safe to re-run.** Re-running execute when a scenario is already
  active is a no-op (it won't overwrite a captured-good image with the broken one,
  and won't clobber captured replica counts). Rollback is safe to run even if no
  state file exists.
- **Never destructive.** Scripts only `az containerapp update` the app — they
  **never delete the resource group or the container app**. The worst case
  (lost state file) is recovered by redeploying with `deploy-album-api.ps1`.
- Shared helpers live in `_scenario-common.ps1`; structured logging
  (`Write-Step` / `Write-Info` / `Write-Ok` / `Write-Warn` / `Write-Err`) and az
  helpers come from `../_common.ps1`.

## Prerequisites

1. **Azure CLI** installed and logged in: `az login` (and `az account set --subscription <id>` if needed). The `containerapp` extension is used by `az`.
2. **album-api deployed** with external ingress — see `../deploy-album-api.ps1`.
3. **OpsPilot backend running** with autonomous detection against Azure telemetry:
   - `AUTO_DETECTION_ENABLED=true`
   - `TELEMETRY_MODE=azure`

## Important: detection is not instant

Azure telemetry ingestion (Application Insights / Log Analytics) lags by roughly
**2–5 minutes**. After a scenario's `execute` finishes, allow that window before
expecting OpsPilot to surface the auto-created incident. For the same reason,
**run `-Rollback` only after you've observed the incident** — rolling back too
early can heal the signal before it's ingested.

## Quick example

```powershell
# Break it
./service-outage.ps1 -ResourceGroup rg-opspilot
# ... wait 2-5 min, confirm OpsPilot raised a P1 service-down incident ...

# Fix it
./service-outage.ps1 -ResourceGroup rg-opspilot -Rollback
```
