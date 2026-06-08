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

# ── Resolve the CURRENT Application Insights connection string ────────────────
# album-api is a Node app: it emits NO telemetry unless its container receives
# APPLICATIONINSIGHTS_CONNECTION_STRING (bin/www starts the App Insights SDK only
# when that env var is set). Resolve the value LIVE from the App Insights resource
# so it is always current — never an empty/stale cached output.
$aiConn = $core.appInsightsConnectionString
if ([string]::IsNullOrWhiteSpace($aiConn) -and $core.appInsightsName) {
    $aiConn = az monitor app-insights component show --app $core.appInsightsName -g $ResourceGroup --query connectionString -o tsv 2>$null
}
if ([string]::IsNullOrWhiteSpace($aiConn)) {
    throw "Application Insights connection string could not be resolved (appInsightsName='$($core.appInsightsName)'). album-api would emit NO telemetry — re-run deploy-core-infra.ps1 or confirm the App Insights resource exists."
}

# ── Build + deploy WITH the telemetry env injected atomically ────────────────
# Injecting --env-vars on `up` guarantees the connection string is present on the
# deployed revision (a prior raw `az containerapp up` without this is exactly why
# album-api shipped with no env var and emitted nothing).
# NOTE: `az containerapp up` does NOT accept --only-show-errors.
Write-Step "Building + deploying $AppName from source (App Insights wired)"
az containerapp up `
    --name $AppName `
    --resource-group $ResourceGroup `
    --environment $core.containerAppsEnvironmentName `
    --source $source `
    --ingress external `
    --target-port $targetPort `
    --env-vars "APPLICATIONINSIGHTS_CONNECTION_STRING=$aiConn" "OPSPILOT_SERVICE_NAME=$AppName"
if ($LASTEXITCODE -ne 0) { throw "az containerapp up failed (exit $LASTEXITCODE)." }

# ── Reinforce env vars (idempotent; covers an `up` that ignored --env-vars) ──
Write-Step 'Verifying Application Insights instrumentation'
az containerapp update `
    --name $AppName `
    --resource-group $ResourceGroup `
    --set-env-vars "APPLICATIONINSIGHTS_CONNECTION_STRING=$aiConn" "OPSPILOT_SERVICE_NAME=$AppName" `
    --only-show-errors | Out-Null
Write-Ok 'Instrumentation env vars set'

$fqdn = az containerapp show --name $AppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv
Write-Step "$AppName deployed"
Write-Host "  URL          : https://$fqdn"
Write-Host "  Test endpoint: https://$fqdn/albums"
Write-Host ""
Write-Host "  Generate telemetry, then validate:" -ForegroundColor Cyan
Write-Host "    ./validate-album-api.ps1 -ResourceGroup $ResourceGroup -Environment $Environment"
