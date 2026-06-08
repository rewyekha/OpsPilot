<#
.SYNOPSIS
    Demo-failure scenario: HIGH ERROR RATE (id: high-error-rate).

.DESCRIPTION
    Floods the deployed album-api with high-volume requests to a non-existent path
    (/__opspilot_fault__) so they return 404 and register as FAILED requests in
    Application Insights. Sustained for $DurationSeconds at enough volume to push
    the rolling 5-minute error rate above 20%.

    Pure traffic — NO infrastructure change. Rollback fires a burst of healthy
    GET /albums (200) requests to dilute the error rate back down quickly.

    Expected OpsPilot reaction: P1/P2 "elevated error rate" incident, auto-created
    by the autonomous monitor once the telemetry anomaly is ingested (~2-5 min lag).

.EXAMPLE
    ./high-error-rate.ps1 -ResourceGroup rg-opspilot
.EXAMPLE
    ./high-error-rate.ps1 -ResourceGroup rg-opspilot -Rollback
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ResourceGroup,
    [string]$AppName = 'album-api',
    [string]$BaseUrl = '',          # resolved from az ingress fqdn if empty
    [switch]$Rollback,              # when present, UNDO the scenario
    [int]$DurationSeconds = 180,
    [string]$HealthPath = '/albums' # healthy 200 endpoint (per-app; e.g. "/" for voting-app)
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/_scenario-common.ps1"

$ScenarioId = 'high-error-rate'
$FaultPath  = '/__opspilot_fault__'

try {
    $url = Resolve-AppUrl -ResourceGroup $ResourceGroup -AppName $AppName -BaseUrl $BaseUrl

    if ($Rollback) {
        Write-Step "[$ScenarioId] ROLLBACK — flooding healthy traffic to restore error rate"
        Write-Info "Target: $url$HealthPath (no infrastructure change was made)"
        # ~60s of healthy 200s dilutes the rolling error rate back below threshold.
        $rollDuration = [Math]::Min($DurationSeconds, 90)
        $summary = Send-Load -Url "$url$HealthPath" -DurationSeconds $rollDuration -Parallel 20 -Label 'heal-200'
        Remove-ScenarioState -AppName $AppName -ScenarioId $ScenarioId
        Write-Ok "[$ScenarioId] healthy burst complete — ok=$($summary.Ok) failed=$($summary.Failed)"
        Write-ScenarioResult -ScenarioId $ScenarioId -Action 'rollback' -Status 'ok'
        exit 0
    }

    Write-Step "[$ScenarioId] EXECUTE — injecting 404 flood to drive error rate > 20%"
    # No infra mutated, but record a marker so -Rollback has a state file to clean.
    Save-ScenarioState -AppName $AppName -ScenarioId $ScenarioId -State @{
        kind     = 'traffic-only'
        faultUrl = "$url$FaultPath"
        note     = 'no infrastructure change; rollback dilutes error rate with healthy traffic'
    } | Out-Null

    Write-Info "Flooding 404s: $url$FaultPath for ${DurationSeconds}s (high parallelism)"
    $summary = Send-Load -Url "$url$FaultPath" -DurationSeconds $DurationSeconds -Parallel 25 -Label 'fault-404'

    if ($summary.Sent -eq 0) {
        Write-Err "[$ScenarioId] no requests were sent — check connectivity to $url"
        Write-ScenarioResult -ScenarioId $ScenarioId -Action 'execute' -Status 'fail'
        exit 1
    }
    Write-Ok "[$ScenarioId] fault traffic delivered — sent=$($summary.Sent) failed(4xx/err)=$($summary.Failed) errPct=$($summary.ErrorPct)%"
    Write-Info 'Allow ~2-5 min for telemetry ingestion, then OpsPilot should raise a P1/P2 error-rate incident.'
    Write-ScenarioResult -ScenarioId $ScenarioId -Action 'execute' -Status 'ok'
    exit 0
}
catch {
    Write-Err "[$ScenarioId] $($_.Exception.Message)"
    Write-ScenarioResult -ScenarioId $ScenarioId -Action ($Rollback ? 'rollback' : 'execute') -Status 'fail'
    exit 1
}
