<#
.SYNOPSIS
    Shared helpers for the OpsPilot demo-failure SCENARIO scripts.

.DESCRIPTION
    Dot-sourced by every scenario script. Provides:
      · Resolve-AppUrl       — resolve the container app ingress FQDN → https URL
      · Save-ScenarioState   — capture pre-mutation state to a JSON temp file
      · Read-ScenarioState   — read it back during -Rollback
      · Remove-ScenarioState — clean up the temp file after a successful rollback
      · Send-Load            — parallel HTTP request burst (ForEach-Object -Parallel)
      · Write-ScenarioResult — print the machine-parseable SCENARIO_DONE line

    This in turn dot-sources the infra-wide _common.ps1 for the structured logging
    helpers (Write-Step / Write-Info / Write-Ok / Write-Warn / Write-Err) and the
    az helpers (Assert-AzLogin, Invoke-AzJson, ...).

    Dot-source it from every scenario:  . "$PSScriptRoot/_scenario-common.ps1"
#>

Set-StrictMode -Version Latest

# Pull in the infra-wide logging + az helpers (Write-Step, Invoke-AzJson, ...).
. "$PSScriptRoot/../_common.ps1"

# ── App URL resolution ───────────────────────────────────────────────────────
# Resolve the public https base URL for a container app. If $BaseUrl is supplied
# it is normalized (scheme added, trailing slash trimmed) and returned as-is.
function Resolve-AppUrl {
    param(
        [Parameter(Mandatory)][string]$ResourceGroup,
        [Parameter(Mandatory)][string]$AppName,
        [string]$BaseUrl = ''
    )
    if (-not [string]::IsNullOrWhiteSpace($BaseUrl)) {
        $u = $BaseUrl.Trim().TrimEnd('/')
        if ($u -notmatch '^https?://') { $u = "https://$u" }
        return $u
    }
    $fqdn = az containerapp show --name $AppName --resource-group $ResourceGroup `
        --query properties.configuration.ingress.fqdn -o tsv 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($fqdn)) {
        throw "Could not resolve ingress FQDN for '$AppName' in '$ResourceGroup'. Is it deployed with external ingress? Pass -BaseUrl to override."
    }
    return "https://$($fqdn.Trim())"
}

# ── Scenario state persistence (capture-before-mutate → restore-on-rollback) ──
function Get-ScenarioStatePath {
    param(
        [Parameter(Mandatory)][string]$AppName,
        [Parameter(Mandatory)][string]$ScenarioId
    )
    Join-Path ([System.IO.Path]::GetTempPath()) "opspilot-scenario-$AppName-$ScenarioId.json"
}

# Persist captured state to the temp file. Idempotent: re-running execute simply
# overwrites with the (still-original, since rollback restores) captured values.
function Save-ScenarioState {
    param(
        [Parameter(Mandatory)][string]$AppName,
        [Parameter(Mandatory)][string]$ScenarioId,
        [Parameter(Mandatory)][hashtable]$State
    )
    $path = Get-ScenarioStatePath -AppName $AppName -ScenarioId $ScenarioId
    $State['_capturedUtc'] = (Get-Date).ToUniversalTime().ToString('o')
    $State['_appName']     = $AppName
    $State['_scenarioId']  = $ScenarioId
    $State | ConvertTo-Json -Depth 8 | Set-Content -Path $path -Encoding utf8
    Write-Info "Captured original state → $path"
    return $path
}

# Read captured state back. Returns $null if no state file exists.
function Read-ScenarioState {
    param(
        [Parameter(Mandatory)][string]$AppName,
        [Parameter(Mandatory)][string]$ScenarioId
    )
    $path = Get-ScenarioStatePath -AppName $AppName -ScenarioId $ScenarioId
    if (Test-Path $path) {
        try { return (Get-Content $path -Raw | ConvertFrom-Json) }
        catch { Write-Warn "State file unreadable ($path): $($_.Exception.Message)"; return $null }
    }
    return $null
}

# Remove the state file (called after a successful rollback). Safe if absent.
function Remove-ScenarioState {
    param(
        [Parameter(Mandatory)][string]$AppName,
        [Parameter(Mandatory)][string]$ScenarioId
    )
    $path = Get-ScenarioStatePath -AppName $AppName -ScenarioId $ScenarioId
    if (Test-Path $path) { Remove-Item $path -Force -ErrorAction SilentlyContinue; Write-Info "Removed state file: $path" }
}

# ── Parallel HTTP load helper ────────────────────────────────────────────────
# Fire $TotalRequests HTTP requests at $Url with up to $Parallel in flight, for
# at most $DurationSeconds. Returns a summary object with status-code counts and
# latency stats. Uses -SkipHttpErrorCheck so 4xx/5xx do NOT throw (we WANT 404s
# in the high-error-rate scenario to register as failed requests in App Insights).
function Send-Load {
    param(
        [Parameter(Mandatory)][string]$Url,
        [int]$DurationSeconds = 180,
        [int]$Parallel = 20,
        [int]$TotalRequests = 0,      # 0 = run until the duration elapses
        [int]$TimeoutSec = 15,
        [string]$Method = 'GET',
        [string]$Label = 'load'
    )
    $deadline = (Get-Date).AddSeconds($DurationSeconds)
    Write-Info "[$Label] $Method $Url — parallel=$Parallel duration<=${DurationSeconds}s$([string]($TotalRequests -gt 0 ? " total=$TotalRequests" : ''))"

    $results = [System.Collections.Concurrent.ConcurrentBag[int]]::new()
    $latencies = [System.Collections.Concurrent.ConcurrentBag[double]]::new()
    $sent = 0
    $batch = [Math]::Max($Parallel, 1)

    while ((Get-Date) -lt $deadline) {
        if ($TotalRequests -gt 0 -and $sent -ge $TotalRequests) { break }
        $thisBatch = $batch
        if ($TotalRequests -gt 0) { $thisBatch = [Math]::Min($batch, $TotalRequests - $sent) }

        1..$thisBatch | ForEach-Object -Parallel {
            $codes = $using:results
            $lats  = $using:latencies
            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            try {
                $r = Invoke-WebRequest -Uri $using:Url -Method $using:Method `
                    -TimeoutSec $using:TimeoutSec -SkipHttpErrorCheck -UseBasicParsing
                $sw.Stop()
                $codes.Add([int]$r.StatusCode)
                $lats.Add($sw.Elapsed.TotalMilliseconds)
            } catch {
                $sw.Stop()
                # Network-level failure / timeout → record as 0 (treated as failure).
                $codes.Add(0)
                $lats.Add($sw.Elapsed.TotalMilliseconds)
            }
        } -ThrottleLimit $batch

        $sent += $thisBatch
    }

    # Wrap in @() so .Count is always valid even when a filter matches ZERO items
    # (e.g. the high-error-rate flood is all 404s → the 2xx filter is empty). Under
    # Set-StrictMode -Latest, $null.Count throws "property 'Count' cannot be found".
    $codeArr = @($results.ToArray())
    $latArr  = @($latencies.ToArray() | Sort-Object)
    $ok      = @($codeArr | Where-Object { $_ -ge 200 -and $_ -lt 400 }).Count
    $bad     = $codeArr.Count - $ok
    $p95     = 0.0
    if ($latArr.Count -gt 0) {
        $idx = [int][Math]::Ceiling($latArr.Count * 0.95) - 1
        if ($idx -lt 0) { $idx = 0 }
        if ($idx -ge $latArr.Count) { $idx = $latArr.Count - 1 }
        $p95 = [Math]::Round($latArr[$idx], 1)
    }
    $summary = [pscustomobject]@{
        Sent      = $codeArr.Count
        Ok        = $ok
        Failed    = $bad
        ErrorPct  = ($codeArr.Count -gt 0 ? [Math]::Round(100.0 * $bad / $codeArr.Count, 1) : 0)
        P95Ms     = $p95
    }
    Write-Info "[$Label] sent=$($summary.Sent) ok=$($summary.Ok) failed=$($summary.Failed) errPct=$($summary.ErrorPct)% p95=$($summary.P95Ms)ms"
    return $summary
}

# ── Machine-parseable result line ────────────────────────────────────────────
# Always the LAST line a runner needs:  SCENARIO_DONE <id> <execute|rollback> <ok|fail>
function Write-ScenarioResult {
    param(
        [Parameter(Mandatory)][string]$ScenarioId,
        [Parameter(Mandatory)][ValidateSet('execute', 'rollback')][string]$Action,
        [Parameter(Mandatory)][ValidateSet('ok', 'fail')][string]$Status
    )
    $color = ($Status -eq 'ok') ? 'Green' : 'Red'
    Write-Host "SCENARIO_DONE $ScenarioId $Action $Status" -ForegroundColor $color
}
