<#
.SYNOPSIS
    Deploy the azure-voting-app-redis demo workload (Flask + Redis) to Azure
    Container Apps and wire its telemetry into the OpsPilot observability stack.

.DESCRIPTION
    Phase 8 — Real Azure Workload Integration.

    Deploys two Container Apps into the shared environment:
      1. redis      — internal-only `redis:6` cache (ingress: internal, port 6379)
      2. voting-app — the Flask web UI, with REDIS env var pointed at redis's
                      internal FQDN.

    This makes voting-app a realistic *dependency-failure* target: scaling the
    redis app to zero (or deleting it) breaks voting-app, which OpsPilot then
    root-causes from the Application Insights exception/dependency telemetry.

    Idempotent: re-running updates the existing Container Apps in place.

.PARAMETER ResourceGroup
    Target resource group. Created if it does not exist.

.PARAMETER Location
    Azure region (default: eastus2).

.PARAMETER EnvironmentName
    Container Apps Environment name (shared with album-api). Created if absent.

.PARAMETER AppName
    Web Container App name (default: voting-app).

.PARAMETER LogAnalyticsWorkspace
    Log Analytics workspace name backing the environment + App Insights.

.PARAMETER AppInsightsName
    Application Insights component name (shared with album-api).

.EXAMPLE
    ./infra/deploy-voting-app.ps1 -ResourceGroup rg-opspilot-demo -Location eastus2

.NOTES
    Requires: Azure CLI (az) >= 2.53, the containerapp extension, and `az login`.
    Run from the repo root (opspilot/).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string] $ResourceGroup,
    [string] $Location = "eastus2",
    [string] $EnvironmentName = "opspilot-aca-env",
    [string] $AppName = "voting-app",
    [string] $RedisAppName = "voting-redis",
    [string] $LogAnalyticsWorkspace = "opspilot-logs",
    [string] $AppInsightsName = "opspilot-appinsights"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot   = Split-Path -Parent $PSScriptRoot          # opspilot/
$sourcePath = Join-Path $repoRoot "demo-workloads/voting-app/azure-vote"
$targetPort = 80

if (-not (Test-Path (Join-Path $sourcePath "Dockerfile"))) {
    throw "voting-app source not found at $sourcePath. Did you clone demo-workloads? See demo-workloads/README.md."
}

Write-Host "==> voting-app deploy" -ForegroundColor Cyan
Write-Host "    ResourceGroup : $ResourceGroup"
Write-Host "    Location      : $Location"
Write-Host "    Source        : $sourcePath (port $targetPort)"

# ── 0. Prerequisites ─────────────────────────────────────────────────────────
az extension add --name containerapp --upgrade --only-show-errors | Out-Null
az extension add --name application-insights --upgrade --only-show-errors | Out-Null
az provider register --namespace Microsoft.App --wait | Out-Null
az provider register --namespace Microsoft.OperationalInsights --wait | Out-Null

# ── 1. Resource group ────────────────────────────────────────────────────────
az group create --name $ResourceGroup --location $Location --only-show-errors | Out-Null

# ── 2. Log Analytics workspace (shared) ──────────────────────────────────────
Write-Host "==> Ensuring Log Analytics workspace '$LogAnalyticsWorkspace'..." -ForegroundColor Cyan
az monitor log-analytics workspace create `
    --resource-group $ResourceGroup `
    --workspace-name $LogAnalyticsWorkspace `
    --location $Location --only-show-errors | Out-Null

$workspaceId = az monitor log-analytics workspace show `
    --resource-group $ResourceGroup --workspace-name $LogAnalyticsWorkspace `
    --query customerId -o tsv
$workspaceResourceId = az monitor log-analytics workspace show `
    --resource-group $ResourceGroup --workspace-name $LogAnalyticsWorkspace `
    --query id -o tsv

# ── 3. Application Insights (shared, workspace-based) ─────────────────────────
Write-Host "==> Ensuring Application Insights '$AppInsightsName'..." -ForegroundColor Cyan
az monitor app-insights component create `
    --app $AppInsightsName --location $Location `
    --resource-group $ResourceGroup --workspace $workspaceResourceId --only-show-errors | Out-Null
$appInsightsConn = az monitor app-insights component show `
    --app $AppInsightsName --resource-group $ResourceGroup `
    --query connectionString -o tsv

# ── 4. Ensure the Container Apps Environment exists ──────────────────────────
# Create it explicitly (wired to the workspace) so both apps share it and can
# reach each other over the internal network.
Write-Host "==> Ensuring Container Apps Environment '$EnvironmentName'..." -ForegroundColor Cyan
$envExists = az containerapp env show --name $EnvironmentName --resource-group $ResourceGroup `
    --query name -o tsv 2>$null
if (-not $envExists) {
    $workspaceKey = az monitor log-analytics workspace get-shared-keys `
        --resource-group $ResourceGroup --workspace-name $LogAnalyticsWorkspace `
        --query primarySharedKey -o tsv
    az containerapp env create `
        --name $EnvironmentName --resource-group $ResourceGroup --location $Location `
        --logs-workspace-id $workspaceId --logs-workspace-key $workspaceKey --only-show-errors | Out-Null
}

# ── 5. Redis dependency (internal ingress) ───────────────────────────────────
Write-Host "==> Deploying internal Redis '$RedisAppName'..." -ForegroundColor Cyan
az containerapp create `
    --name $RedisAppName `
    --resource-group $ResourceGroup `
    --environment $EnvironmentName `
    --image "redis:6" `
    --ingress internal `
    --target-port 6379 `
    --transport tcp `
    --min-replicas 1 --max-replicas 1 --only-show-errors | Out-Null

$redisFqdn = az containerapp show --name $RedisAppName --resource-group $ResourceGroup `
    --query properties.configuration.ingress.fqdn -o tsv

# ── 6. Build + deploy the voting web app ──────────────────────────────────────
Write-Host "==> Building + deploying Container App '$AppName'..." -ForegroundColor Cyan
# NOTE: `az containerapp up` does NOT accept --only-show-errors — intentionally omitted.
az containerapp up `
    --name $AppName `
    --resource-group $ResourceGroup `
    --location $Location `
    --environment $EnvironmentName `
    --source $sourcePath `
    --ingress external `
    --target-port $targetPort `
    --logs-workspace-id $workspaceId
if ($LASTEXITCODE -ne 0) { throw "az containerapp up failed (exit $LASTEXITCODE)." }

# ── 7. Wire env vars (Redis backend + App Insights) ──────────────────────────
Write-Host "==> Configuring env vars (REDIS=$redisFqdn)..." -ForegroundColor Cyan
az containerapp update `
    --name $AppName `
    --resource-group $ResourceGroup `
    --set-env-vars "REDIS=$redisFqdn" `
                   "TITLE=OpsPilot Demo Vote" `
                   "VOTE1VALUE=Cats" `
                   "VOTE2VALUE=Dogs" `
                   "APPLICATIONINSIGHTS_CONNECTION_STRING=$appInsightsConn" `
                   "OPSPILOT_SERVICE_NAME=$AppName" `
    --only-show-errors | Out-Null

# ── 8. Output ─────────────────────────────────────────────────────────────────
$fqdn = az containerapp show --name $AppName --resource-group $ResourceGroup `
    --query properties.configuration.ingress.fqdn -o tsv

Write-Host ""
Write-Host "✅ voting-app deployed." -ForegroundColor Green
Write-Host "   URL              : https://$fqdn"
Write-Host "   Redis backend    : $redisFqdn (internal, $RedisAppName)"
Write-Host "   App Insights     : $AppInsightsName"
Write-Host ""
Write-Host "   💥 To stage a dependency-failure incident for OpsPilot to investigate:"
Write-Host "      az containerapp update --name $RedisAppName --resource-group $ResourceGroup --min-replicas 0 --max-replicas 0"
