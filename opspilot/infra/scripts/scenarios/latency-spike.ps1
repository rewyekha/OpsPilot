<#
.SYNOPSIS
    Demo-failure scenario: LATENCY SPIKE (id: latency-spike).

.DESCRIPTION
    Generates heavy concurrent load against GET /albums to drive p95 server-side
    latency up through request queueing / contention for $DurationSeconds. These
    are successful (200) requests, so this targets the LATENCY signal, not errors.

    Pure traffic — NO infrastructure change. Rollback simply stops generating load
    (latency decays on its own once the queue drains).

    Expected OpsPilot reaction: P2 "elevated latency / p95 degradation" incident.
    BEST-EFFORT: whether p95 actually crosses the threshold depends on the app
    saturating under load (replica count, CPU). With a single small replica this
    reliably queues; with autoscale headroom you may need higher -Parallel or a
    longer -DurationSeconds.

.EXAMPLE
    ./latency-spike.ps1 -ResourceGroup rg-opspilot
.EXAMPLE
    ./latency-spike.ps1 -ResourceGroup rg-opspilot -Rollback
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ResourceGroup,
    [string]$AppName = 'album-api',
    [string]$BaseUrl = '',          # resolved from az ingress fqdn if empty
    [switch]$Rollback,              # when present, UNDO the scenario
    [int]$DurationSeconds = 180
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/_scenario-common.ps1"

$ScenarioId = 'latency-spike'
$LoadPath   = '/albums'

try {
    $url = Resolve-AppUrl -ResourceGroup $ResourceGroup -AppName $AppName -BaseUrl $BaseUrl

    if ($Rollback) {
        Write-Step "[$ScenarioId] ROLLBACK — nothing to undo (load-induced, no infra change)"
        Write-Info 'The latency spike was caused purely by concurrent load; it decays once load stops.'
        Write-Info 'No infrastructure was modified, so there is nothing to restore.'
        Remove-ScenarioState -AppName $AppName -ScenarioId $ScenarioId
        Write-ScenarioResult -ScenarioId $ScenarioId -Action 'rollback' -Status 'ok'
        exit 0
    }

    Write-Step "[$ScenarioId] EXECUTE — heavy concurrent load to inflate p95 latency"
    Save-ScenarioState -AppName $AppName -ScenarioId $ScenarioId -State @{
        kind    = 'traffic-only'
        loadUrl = "$url$LoadPath"
        note    = 'no infrastructure change; latency is load-induced and self-heals when load stops'
    } | Out-Null

    Write-Info "Saturating $url$LoadPath with high concurrency for ${DurationSeconds}s"
    # High parallelism on a successful endpoint → queueing → p95 climbs.
    $summary = Send-Load -Url "$url$LoadPath" -DurationSeconds $DurationSeconds -Parallel 40 -Label 'latency-load'

    if ($summary.Sent -eq 0) {
        Write-Err "[$ScenarioId] no requests were sent — check connectivity to $url"
        Write-ScenarioResult -ScenarioId $ScenarioId -Action 'execute' -Status 'fail'
        exit 1
    }
    Write-Ok "[$ScenarioId] load delivered — sent=$($summary.Sent) ok=$($summary.Ok) observed client p95=$($summary.P95Ms)ms"
    Write-Warn 'Best-effort: server p95 rises only if the app saturates. Increase -Parallel / -DurationSeconds, or reduce replicas, if p95 stays low.'
    Write-Info 'Allow ~2-5 min for telemetry ingestion, then OpsPilot may raise a P2 latency incident.'
    Write-ScenarioResult -ScenarioId $ScenarioId -Action 'execute' -Status 'ok'
    exit 0
}
catch {
    Write-Err "[$ScenarioId] $($_.Exception.Message)"
    Write-ScenarioResult -ScenarioId $ScenarioId -Action ($Rollback ? 'rollback' : 'execute') -Status 'fail'
    exit 1
}
