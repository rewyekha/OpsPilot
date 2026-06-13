<#
.SYNOPSIS
    Phase 5 — Deploy the voting-app demo workload (Flask + Redis) into the core env.

.DESCRIPTION
    Independent, idempotent. Provisions an internal Redis container app, then builds
    voting-app from local source and wires REDIS + Application Insights. Consumes the
    cached core-infra outputs (run deploy-core-infra.ps1 first).

    Deploy ONE workload at a time — this deploys only voting-app (+ its Redis dependency).

.EXAMPLE
    ./deploy-voting-app.ps1 -ResourceGroup rg-opspilot -Environment dev
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ResourceGroup,
    [ValidateSet('dev', 'staging', 'prod')][string]$Environment = 'dev',
    [string]$AppName = 'voting-app',
    [string]$RedisAppName = 'voting-redis',
    [string]$SubscriptionId
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/_common.ps1"

$targetPort = 80
$source = (Resolve-Path (Join-Path $PSScriptRoot '../../demo-workloads/voting-app/azure-vote') -ErrorAction SilentlyContinue)
if (-not $source -or -not (Test-Path (Join-Path $source 'Dockerfile'))) {
    throw "voting-app source not found. Expected demo-workloads/voting-app/azure-vote (see demo-workloads/README.md)."
}

Write-Step "Deploy $AppName → $ResourceGroup ($Environment)"
Assert-AzLogin -SubscriptionId $SubscriptionId | Out-Null

$core = Read-Outputs -ResourceGroup $ResourceGroup -Environment $Environment
if (-not $core) { throw "Core-infra outputs not found. Run ./deploy-core-infra.ps1 first." }
$envName = $core.containerAppsEnvironmentName

# ── Redis dependency (internal ingress) — idempotent create ──────────────────
Write-Step "Ensuring internal Redis '$RedisAppName'"
$existingRedis = Invoke-AzJson @('containerapp', 'show', '--name', $RedisAppName, '-g', $ResourceGroup)
if (-not $existingRedis) {
    az containerapp create `
        --name $RedisAppName `
        --resource-group $ResourceGroup `
        --environment $envName `
        --image 'redis:6' `
        --ingress internal --target-port 6379 --transport tcp `
        --min-replicas 1 --max-replicas 1 --only-show-errors | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Redis create failed (exit $LASTEXITCODE)." }
    Write-Ok 'Redis container app created'
} else {
    Write-Info 'Redis already present — reusing'
}
$redisFqdn = az containerapp show --name $RedisAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv

# ── Build + deploy voting-app (idempotent) ───────────────────────────────────
Write-Step "Building + deploying $AppName from source"
az containerapp up `
    --name $AppName `
    --resource-group $ResourceGroup `
    --environment $envName `
    --source $source `
    --ingress external `
    --target-port $targetPort
if ($LASTEXITCODE -ne 0) { throw "az containerapp up failed (exit $LASTEXITCODE)." }

# ── Wire env (Redis backend + App Insights) ──────────────────────────────────
Write-Step 'Configuring env vars (REDIS + Application Insights)'
az containerapp update `
    --name $AppName `
    --resource-group $ResourceGroup `
    --set-env-vars "REDIS=$redisFqdn" 'TITLE=OpsPilot Demo Vote' 'VOTE1VALUE=Cats' 'VOTE2VALUE=Dogs' `
                   "APPLICATIONINSIGHTS_CONNECTION_STRING=$($core.appInsightsConnectionString)" "OPSPILOT_SERVICE_NAME=$AppName" `
    --only-show-errors | Out-Null
Write-Ok 'Env vars set'

$fqdn = az containerapp show --name $AppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv
Write-Step "$AppName deployed"
Write-Host "  URL          : https://$fqdn"
Write-Host "  Redis backend: $redisFqdn (internal, $RedisAppName)"
Write-Host ""
Write-Host "  💥 Stage a dependency-failure incident for OpsPilot to investigate:" -ForegroundColor Yellow
Write-Host "     az containerapp update --name $RedisAppName -g $ResourceGroup --min-replicas 0 --max-replicas 0"
Write-Host ""
Write-Host "  Validate: ./validate-voting-app.ps1 -ResourceGroup $ResourceGroup -Environment $Environment"
