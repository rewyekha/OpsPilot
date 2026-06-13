<#
.SYNOPSIS
    Demo-failure scenario: SERVICE OUTAGE (id: service-outage).

.DESCRIPTION
    Takes album-api genuinely OFFLINE by DISABLING its external ingress, so the
    public endpoint stops responding (a real, immediate, reversible outage).

    Why not "scale to zero"? `az containerapp update --max-replicas 0` is rejected
    by Azure (max must be >= 1), and `--min-replicas 0` only *allows* scale-to-zero
    after a long idle cooldown — the app keeps a replica running and stays healthy.
    Disabling ingress makes the service unreachable instantly.

    Before cutting ingress, the script seeds ~45s of baseline traffic so the
    monitor's service-down rule (served in the prior 15m, ZERO in the last 5m) has
    a baseline to compare against once requests stop. -Rollback re-enables ingress.

    Expected OpsPilot reaction: P1 "service down / availability" incident.

.EXAMPLE
    ./service-outage.ps1 -ResourceGroup rg-opspilot
.EXAMPLE
    ./service-outage.ps1 -ResourceGroup rg-opspilot -Rollback
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ResourceGroup,
    [string]$AppName = 'album-api',
    [string]$BaseUrl = '',          # resolved from az ingress fqdn if empty
    [switch]$Rollback,              # when present, UNDO the scenario
    [int]$DurationSeconds = 180,
    [int]$TargetPort = 8080,
    [string]$HealthPath = '/albums' # endpoint for the baseline seed (per-app; e.g. "/")
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/_scenario-common.ps1"

$ScenarioId = 'service-outage'

try {
    Assert-AzLogin | Out-Null

    if ($Rollback) {
        Write-Step "[$ScenarioId] ROLLBACK — re-enabling external ingress"
        $state = Read-ScenarioState -AppName $AppName -ScenarioId $ScenarioId
        $port = if ($state -and $state.targetPort) { [int]$state.targetPort } else { $TargetPort }
        Write-Info "Restoring external ingress on port $port"
        az containerapp ingress enable --name $AppName --resource-group $ResourceGroup `
            --type external --target-port $port --transport auto --only-show-errors | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "az containerapp ingress enable failed (exit $LASTEXITCODE)." }
        Remove-ScenarioState -AppName $AppName -ScenarioId $ScenarioId
        Write-Ok "[$ScenarioId] ingress re-enabled on port $port — service reachable again"
        Write-ScenarioResult -ScenarioId $ScenarioId -Action 'rollback' -Status 'ok'
        exit 0
    }

    Write-Step "[$ScenarioId] EXECUTE — taking the service offline (disable ingress)"
    # Read the current target port (also confirms the app exists). Empty + exit 0 ⇒
    # ingress is already disabled.
    $port = az containerapp show --name $AppName --resource-group $ResourceGroup `
        --query "properties.configuration.ingress.targetPort" -o tsv 2>$null
    if ($LASTEXITCODE -ne 0) { throw "Container app '$AppName' not found in '$ResourceGroup'." }
    if ([string]::IsNullOrWhiteSpace($port)) {
        Write-Warn "[$ScenarioId] ingress already disabled — scenario already active (no-op)."
        Write-ScenarioResult -ScenarioId $ScenarioId -Action 'execute' -Status 'ok'
        exit 0
    }

    Save-ScenarioState -AppName $AppName -ScenarioId $ScenarioId -State @{
        kind       = 'disable-ingress'
        targetPort = [int]$port
    } | Out-Null

    # Seed a short burst of baseline traffic so live telemetry has a prior-activity
    # baseline too. Detection no longer DEPENDS on this (OpsPilot's control plane
    # records the outage the moment Execute launches and the monitor raises the
    # incident on its next scan), so a brief seed is enough — no long wait.
    $url = Resolve-AppUrl -ResourceGroup $ResourceGroup -AppName $AppName -BaseUrl $BaseUrl
    Write-Info 'Seeding ~15s of baseline traffic…'
    Send-Load -Url "$url$HealthPath" -DurationSeconds 15 -Parallel 15 -Label 'baseline-200' | Out-Null

    Write-Info 'Disabling external ingress → service becomes unreachable'
    az containerapp ingress disable --name $AppName --resource-group $ResourceGroup --only-show-errors | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "az containerapp ingress disable failed (exit $LASTEXITCODE)." }

    Write-Ok "[$ScenarioId] ingress disabled — $AppName is now unreachable (real outage)."
    Write-Info 'OpsPilot marks the service DOWN immediately and raises a P1 service-down incident within ~30-60s (next monitor scan) — no 5-8 min wait.'
    Write-Info "Undo with:  ./service-outage.ps1 -ResourceGroup $ResourceGroup -AppName $AppName -Rollback"
    Write-ScenarioResult -ScenarioId $ScenarioId -Action 'execute' -Status 'ok'
    exit 0
}
catch {
    Write-Err "[$ScenarioId] $($_.Exception.Message)"
    Write-ScenarioResult -ScenarioId $ScenarioId -Action ($Rollback ? 'rollback' : 'execute') -Status 'fail'
    exit 1
}
