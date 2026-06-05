<#
.SYNOPSIS
    Deploy the album-api demo workload to Azure Container Apps and wire its
    telemetry into the OpsPilot Log Analytics workspace + Application Insights.

.DESCRIPTION
    Phase 8 — Real Azure Workload Integration.

    Builds the Node.js album-api image from demo-workloads/album-api/src using
    `az containerapp up` (cloud build → ACR → Container App), then connects the
    container's Application Insights via the auto-instrumentation connection
    string so OpsPilot's AzureMonitorTelemetryProvider (TELEMETRY_MODE=azure)
    can query its requests/exceptions/traces.

    Idempotent: re-running updates the existing Container App in place.

.PARAMETER ResourceGroup
    Target resource group. Created if it does not exist.

.PARAMETER Location
    Azure region (default: eastus2).

.PARAMETER EnvironmentName
    Container Apps Environment name (shared with voting-app). Created if absent.

.PARAMETER AppName
    Container App name (default: album-api). This is the service name OpsPilot
    shows under "Monitored Services".

.PARAMETER LogAnalyticsWorkspace
    Log Analytics workspace name backing the environment + App Insights.

.PARAMETER AppInsightsName
    Application Insights component name. Created (workspace-based) if absent.

.EXAMPLE
    ./infra/deploy-album-api.ps1 -ResourceGroup rg-opspilot-demo -Location eastus2

.NOTES
    Requires: Azure CLI (az) >= 2.53, the containerapp extension, and a logged-in
    session (`az login`). Run from the repo root (opspilot/).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string] $ResourceGroup,
    [string] $Location = "eastus2",
    [string] $EnvironmentName = "opspilot-aca-env",
    [string] $AppName = "album-api",
    [string] $LogAnalyticsWorkspace = "opspilot-logs",
    [string] $AppInsightsName = "opspilot-appinsights"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot   = Split-Path -Parent $PSScriptRoot          # opspilot/
$sourcePath = Join-Path $repoRoot "demo-workloads/album-api/src"
$targetPort = 8080

if (-not (Test-Path (Join-Path $sourcePath "Dockerfile"))) {
    throw "album-api source not found at $sourcePath. Did you clone demo-workloads? See demo-workloads/README.md."
}

Write-Host "==> album-api deploy" -ForegroundColor Cyan
Write-Host "    ResourceGroup : $ResourceGroup"
Write-Host "    Location      : $Location"
Write-Host "    Source        : $sourcePath (port $targetPort)"

# ── 0. Prerequisites ─────────────────────────────────────────────────────────
az extension add --name containerapp --upgrade --only-show-errors | Out-Null
az provider register --namespace Microsoft.App --wait | Out-Null
az provider register --namespace Microsoft.OperationalInsights --wait | Out-Null

# ── 1. Resource group ────────────────────────────────────────────────────────
az group create --name $ResourceGroup --location $Location --only-show-errors | Out-Null

# ── 2. Log Analytics workspace (shared observability backend) ─────────────────
Write-Host "==> Ensuring Log Analytics workspace '$LogAnalyticsWorkspace'..." -ForegroundColor Cyan
az monitor log-analytics workspace create `
    --resource-group $ResourceGroup `
    --workspace-name $LogAnalyticsWorkspace `
    --location $Location --only-show-errors | Out-Null

$workspaceId = az monitor log-analytics workspace show `
    --resource-group $ResourceGroup --workspace-name $LogAnalyticsWorkspace `
    --query customerId -o tsv

# ── 3. Application Insights (workspace-based) ─────────────────────────────────
Write-Host "==> Ensuring Application Insights '$AppInsightsName'..." -ForegroundColor Cyan
az extension add --name application-insights --upgrade --only-show-errors | Out-Null
$workspaceResourceId = az monitor log-analytics workspace show `
    --resource-group $ResourceGroup --workspace-name $LogAnalyticsWorkspace `
    --query id -o tsv
az monitor app-insights component create `
    --app $AppInsightsName `
    --location $Location `
    --resource-group $ResourceGroup `
    --workspace $workspaceResourceId --only-show-errors | Out-Null

$appInsightsConn = az monitor app-insights component show `
    --app $AppInsightsName --resource-group $ResourceGroup `
    --query connectionString -o tsv

# ── 4. Build + deploy via `az containerapp up` ────────────────────────────────
# `up` creates the environment (wired to the workspace) on first run and builds
# the image in the cloud — no local Docker required.
Write-Host "==> Building + deploying Container App '$AppName'..." -ForegroundColor Cyan
# NOTE: `az containerapp up` does NOT accept --only-show-errors (unlike the other
# az commands here), so it is intentionally omitted.
az containerapp up `
    --name $AppName `
    --resource-group $ResourceGroup `
    --location $Location `
    --environment $EnvironmentName `
    --source $sourcePath `
    --ingress external `
    --target-port $targetPort `
    --logs-workspace-id $workspaceId

if ($LASTEXITCODE -ne 0) {
    throw "az containerapp up failed (exit $LASTEXITCODE) — see output above."
}

# ── 5. Wire Application Insights into the container ───────────────────────────
# Node auto-instrumentation: the App Insights SDK / OTEL distro reads this var.
Write-Host "==> Setting APPLICATIONINSIGHTS_CONNECTION_STRING env var..." -ForegroundColor Cyan
az containerapp update `
    --name $AppName `
    --resource-group $ResourceGroup `
    --set-env-vars "APPLICATIONINSIGHTS_CONNECTION_STRING=$appInsightsConn" `
                   "OPSPILOT_SERVICE_NAME=$AppName" `
    --only-show-errors | Out-Null

# ── 6. Output ─────────────────────────────────────────────────────────────────
$fqdn = az containerapp show --name $AppName --resource-group $ResourceGroup `
    --query properties.configuration.ingress.fqdn -o tsv

Write-Host ""
Write-Host "✅ album-api deployed." -ForegroundColor Green
Write-Host "   URL              : https://$fqdn"
Write-Host "   Test endpoint    : https://$fqdn/albums"
Write-Host "   App Insights     : $AppInsightsName (resource group $ResourceGroup)"
Write-Host ""
Write-Host "   Set these in backend/.env to investigate it live:"
Write-Host "     TELEMETRY_MODE=azure"
Write-Host "     AZURE_LOG_ANALYTICS_WORKSPACE_ID=$workspaceId"
Write-Host "     APPLICATIONINSIGHTS_CONNECTION_STRING=<album/voting share the same component>"
