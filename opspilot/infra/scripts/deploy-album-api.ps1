<#
.SYNOPSIS
    Phase 3 — Deploy the album-api demo workload into the core Container Apps env.

.DESCRIPTION
    Independent, idempotent. Builds album-api (Node/Express) from local source via
    `az containerapp up` and wires its Application Insights connection string so its
    telemetry flows into the OpsPilot workspace. Consumes the cached core-infra
    outputs from deploy-core-infra.ps1 (run that first).

    Deploy ONE workload at a time — this script deploys only album-api.

.EXAMPLE
    ./deploy-album-api.ps1 -ResourceGroup rg-opspilot -Environment dev
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ResourceGroup,
    [ValidateSet('dev', 'staging', 'prod')][string]$Environment = 'dev',
    [string]$AppName = 'album-api',
    [string]$SubscriptionId
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/_common.ps1"

$targetPort = 8080
$source = (Resolve-Path (Join-Path $PSScriptRoot '../../demo-workloads/album-api/src') -ErrorAction SilentlyContinue)
if (-not $source -or -not (Test-Path (Join-Path $source 'Dockerfile'))) {
    throw "album-api source not found. Expected demo-workloads/album-api/src (see demo-workloads/README.md)."
}

Write-Step "Deploy $AppName → $ResourceGroup ($Environment)"
Assert-AzLogin -SubscriptionId $SubscriptionId | Out-Null

$core = Read-Outputs -ResourceGroup $ResourceGroup -Environment $Environment
if (-not $core) { throw "Core-infra outputs not found. Run ./deploy-core-infra.ps1 first." }
Write-Info "Environment: $($core.containerAppsEnvironmentName) | Workspace: $($core.logAnalyticsCustomerId)"

# ── Build + deploy (idempotent: `up` updates the app in place) ───────────────
# NOTE: `az containerapp up` does NOT accept --only-show-errors.
Write-Step "Building + deploying $AppName from source"
az containerapp up `
    --name $AppName `
    --resource-group $ResourceGroup `
    --environment $core.containerAppsEnvironmentName `
    --source $source `
    --ingress external `
    --target-port $targetPort
if ($LASTEXITCODE -ne 0) { throw "az containerapp up failed (exit $LASTEXITCODE)." }

# ── Wire Application Insights (telemetry → OpsPilot workspace) ────────────────
Write-Step 'Configuring Application Insights instrumentation'
az containerapp update `
    --name $AppName `
    --resource-group $ResourceGroup `
    --set-env-vars "APPLICATIONINSIGHTS_CONNECTION_STRING=$($core.appInsightsConnectionString)" "OPSPILOT_SERVICE_NAME=$AppName" `
    --only-show-errors | Out-Null
Write-Ok 'Instrumentation env vars set'

$fqdn = az containerapp show --name $AppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv
Write-Step "$AppName deployed"
Write-Host "  URL          : https://$fqdn"
Write-Host "  Test endpoint: https://$fqdn/albums"
Write-Host ""
Write-Host "  Generate telemetry, then validate:" -ForegroundColor Cyan
Write-Host "    ./validate-album-api.ps1 -ResourceGroup $ResourceGroup -Environment $Environment"
