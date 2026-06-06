<#
.SYNOPSIS
    Shared helpers for the OpsPilot infrastructure scripts: structured logging,
    a PASS/FAIL/WARNING validation tracker, az helpers, and output persistence.

    Dot-source it from every script:  . "$PSScriptRoot/_common.ps1"
#>

Set-StrictMode -Version Latest

# ── Structured logging ───────────────────────────────────────────────────────
function Get-Ts { (Get-Date).ToString('yyyy-MM-dd HH:mm:ss') }

function Write-Step { param([string]$Message) Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-Info { param([string]$Message) Write-Host "[$(Get-Ts)] [INFO ] $Message" }
function Write-Ok   { param([string]$Message) Write-Host "[$(Get-Ts)] [ OK  ] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "[$(Get-Ts)] [WARN ] $Message" -ForegroundColor Yellow }
function Write-Err  { param([string]$Message) Write-Host "[$(Get-Ts)] [FAIL ] $Message" -ForegroundColor Red }

# ── Azure CLI helpers ────────────────────────────────────────────────────────
function Assert-AzCli {
    if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
        throw "Azure CLI (az) not found. Install: https://aka.ms/azcli"
    }
}

function Assert-AzLogin {
    param([string]$SubscriptionId)
    Assert-AzCli
    $acct = az account show -o json 2>$null | ConvertFrom-Json
    if (-not $acct) { throw "Not logged in. Run: az login" }
    if ($SubscriptionId) {
        az account set --subscription $SubscriptionId | Out-Null
        $acct = az account show -o json | ConvertFrom-Json
    }
    Write-Info "Subscription: $($acct.name) ($($acct.id))"
    Write-Info "Tenant: $($acct.tenantId)  User: $($acct.user.name)"
    return $acct
}

# Run an `az ...` command (string array of args) and return parsed JSON, or $null.
function Invoke-AzJson {
    param([Parameter(Mandatory)][string[]]$Args)
    $raw = az @Args -o json 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) { return $null }
    try { return $raw | ConvertFrom-Json } catch { return $null }
}

# ── Output persistence (core-infra → app scripts) ────────────────────────────
function Get-OutputsPath {
    param([string]$ResourceGroup, [string]$Environment)
    Join-Path ([System.IO.Path]::GetTempPath()) "opspilot-infra-$ResourceGroup-$Environment.json"
}

function Save-Outputs {
    param([hashtable]$Outputs, [string]$ResourceGroup, [string]$Environment)
    $path = Get-OutputsPath -ResourceGroup $ResourceGroup -Environment $Environment
    $Outputs | ConvertTo-Json -Depth 6 | Set-Content -Path $path -Encoding utf8
    Write-Info "Core-infra outputs cached: $path"
}

function Read-Outputs {
    param([string]$ResourceGroup, [string]$Environment)
    $path = Get-OutputsPath -ResourceGroup $ResourceGroup -Environment $Environment
    if (Test-Path $path) { return (Get-Content $path -Raw | ConvertFrom-Json) }
    return $null
}

# ── Validation tracker (PASS / FAIL / WARNING) ───────────────────────────────
function New-Validation { return [System.Collections.Generic.List[object]]::new() }

function Add-Result {
    param(
        [Parameter(Mandatory)] $Results,
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][ValidateSet('PASS', 'FAIL', 'WARNING')][string]$Status,
        [string]$Detail = ''
    )
    $Results.Add([pscustomobject]@{ Check = $Name; Status = $Status; Detail = $Detail })
    switch ($Status) {
        'PASS'    { Write-Ok   "$Name $($Detail ? "— $Detail" : '')" }
        'WARNING' { Write-Warn "$Name $($Detail ? "— $Detail" : '')" }
        'FAIL'    { Write-Err  "$Name $($Detail ? "— $Detail" : '')" }
    }
}

# ── Shared workload validation (used by validate-album-api / validate-voting-app) ─
# Runs: deployment succeeded · ingress URL exists · health endpoint responds ·
# telemetry visible. Returns a populated results list.
function Test-Workload {
    param(
        [Parameter(Mandatory)][string]$ResourceGroup,
        [Parameter(Mandatory)][string]$Environment,
        [Parameter(Mandatory)][string]$AppName,
        [string]$HealthPath = '/'
    )
    $R = New-Validation
    $core = Read-Outputs -ResourceGroup $ResourceGroup -Environment $Environment

    $app = Invoke-AzJson @('containerapp', 'show', '--name', $AppName, '-g', $ResourceGroup)
    if (-not $app) {
        Add-Result $R "$AppName deployment" 'FAIL' 'container app not found'
        return $R
    }

    # 1. Deployment succeeded
    $state = $app.properties.provisioningState
    if ($state -eq 'Succeeded') { Add-Result $R "$AppName deployment" 'PASS' $state }
    else { Add-Result $R "$AppName deployment" 'FAIL' "provisioningState=$state" }

    # 2. Ingress URL exists
    $fqdn = $app.properties.configuration.ingress.fqdn
    if ($fqdn) { Add-Result $R "$AppName ingress URL" 'PASS' "https://$fqdn" }
    else { Add-Result $R "$AppName ingress URL" 'FAIL' 'no external ingress'; return $R }

    # 3. Health endpoint responds (2xx/3xx)
    try {
        $resp = Invoke-WebRequest -Uri "https://$fqdn$HealthPath" -Method Get -TimeoutSec 30 -SkipHttpErrorCheck
        $code = [int]$resp.StatusCode
        if ($code -ge 200 -and $code -lt 400) { Add-Result $R "$AppName health endpoint" 'PASS' "HTTP $code $HealthPath" }
        else { Add-Result $R "$AppName health endpoint" 'FAIL' "HTTP $code $HealthPath" }
    } catch {
        Add-Result $R "$AppName health endpoint" 'FAIL' $_.Exception.Message
    }

    # 4. Telemetry visible (App Insights AppRequests OR Container Apps console logs)
    if ($core -and $core.logAnalyticsCustomerId) {
        $kql = "union (AppRequests | where AppRoleName == '$AppName'), (ContainerAppConsoleLogs_CL | where ContainerAppName_s == '$AppName') | where TimeGenerated > ago(1h) | count"
        $q = Invoke-AzJson @('monitor', 'log-analytics', 'query', '--workspace', $core.logAnalyticsCustomerId, '--analytics-query', $kql)
        $count = 0
        if ($q) { try { $count = [int]$q[0].Count } catch { $count = 0 } }
        if ($count -gt 0) { Add-Result $R "$AppName telemetry" 'PASS' "$count records in last hour" }
        else { Add-Result $R "$AppName telemetry" 'WARNING' 'no records yet — generate traffic + allow 2-5 min ingestion' }
    } else {
        Add-Result $R "$AppName telemetry" 'WARNING' 'workspace id unknown (run deploy-core-infra to cache outputs)'
    }
    return $R
}

# Prints the summary table and the overall PASS/FAIL/WARNING. Returns an exit code
# (0 = PASS or WARNING-only, 1 = any FAIL) so callers can `exit (Write-ValidationSummary ...)`.
function Write-ValidationSummary {
    param([Parameter(Mandatory)] $Results, [string]$Title = 'Validation')
    Write-Host "`n──────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host " $Title — results" -ForegroundColor White
    Write-Host "──────────────────────────────────────────────" -ForegroundColor DarkGray
    $Results | Format-Table -AutoSize Check, Status, Detail | Out-String | Write-Host

    $fail = ($Results | Where-Object Status -eq 'FAIL').Count
    $warn = ($Results | Where-Object Status -eq 'WARNING').Count
    $overall = if ($fail -gt 0) { 'FAIL' } elseif ($warn -gt 0) { 'WARNING' } else { 'PASS' }
    $color = switch ($overall) { 'PASS' { 'Green' } 'WARNING' { 'Yellow' } 'FAIL' { 'Red' } }
    Write-Host "OVERALL: $overall  ($($Results.Count) checks, $fail failed, $warn warnings)`n" -ForegroundColor $color
    return ($fail -gt 0 ? 1 : 0)
}
