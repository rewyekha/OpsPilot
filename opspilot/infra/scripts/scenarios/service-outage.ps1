<#
.SYNOPSIS
    Demo-failure scenario: SERVICE OUTAGE (id: service-outage).

.DESCRIPTION
    Captures the container app's current min/max replica counts, then scales the
    app to zero replicas (--min-replicas 0 --max-replicas 0) so it has no running
    instances and becomes unreachable — a hard service outage.

    The original replica counts are captured into a temp state file BEFORE the
    mutation so -Rollback restores exactly the previous scale (defaulting to
    --min-replicas 1 --max-replicas 1 if the originals can't be read).

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
    [int]$DurationSeconds = 180
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/_scenario-common.ps1"

$ScenarioId = 'service-outage'

# Read current scale rule (min/max replicas) off the live container app.
function Get-CurrentScale {
    $min = az containerapp show --name $AppName --resource-group $ResourceGroup `
        --query properties.template.scale.minReplicas -o tsv 2>$null
    $max = az containerapp show --name $AppName --resource-group $ResourceGroup `
        --query properties.template.scale.maxReplicas -o tsv 2>$null
    return [pscustomobject]@{
        Min = ([string]::IsNullOrWhiteSpace($min) ? $null : [int]$min)
        Max = ([string]::IsNullOrWhiteSpace($max) ? $null : [int]$max)
    }
}

try {
    Assert-AzLogin | Out-Null
    $app = Invoke-AzJson @('containerapp', 'show', '--name', $AppName, '-g', $ResourceGroup)
    if (-not $app) { throw "Container app '$AppName' not found in '$ResourceGroup'." }

    if ($Rollback) {
        Write-Step "[$ScenarioId] ROLLBACK — restoring replica counts"
        $state = Read-ScenarioState -AppName $AppName -ScenarioId $ScenarioId
        # Fall back to 1/1 if the captured originals are missing or were already zero.
        $min = $state?.originalMin
        $max = $state?.originalMax
        if ($null -eq $min -or [int]$min -le 0) { $min = 1 }
        if ($null -eq $max -or [int]$max -le 0) { $max = 1 }
        if ([int]$max -lt [int]$min) { $max = $min }
        Write-Info "Restoring scale → min=$min max=$max"
        az containerapp update --name $AppName --resource-group $ResourceGroup `
            --min-replicas $min --max-replicas $max --only-show-errors | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "az containerapp update (restore scale) failed (exit $LASTEXITCODE)." }
        Remove-ScenarioState -AppName $AppName -ScenarioId $ScenarioId
        Write-Ok "[$ScenarioId] scale restored to min=$min max=$max"
        Write-ScenarioResult -ScenarioId $ScenarioId -Action 'rollback' -Status 'ok'
        exit 0
    }

    Write-Step "[$ScenarioId] EXECUTE — scaling app to zero replicas (outage)"
    $scale = Get-CurrentScale
    Write-Info "Current scale: min=$($scale.Min) max=$($scale.Max)"

    if (($scale.Min -eq 0) -and ($scale.Max -eq 0)) {
        Write-Warn "[$ScenarioId] app is already scaled to zero — scenario already active (no-op)."
        Write-ScenarioResult -ScenarioId $ScenarioId -Action 'execute' -Status 'ok'
        exit 0
    }

    # Capture originals; if currently 0 (shouldn't be, handled above), default to 1.
    Save-ScenarioState -AppName $AppName -ScenarioId $ScenarioId -State @{
        kind        = 'scale-to-zero'
        originalMin = ($scale.Min ?? 1)
        originalMax = ($scale.Max ?? 1)
    } | Out-Null

    Write-Info 'Updating scale → min=0 max=0 (no running instances → unreachable)'
    az containerapp update --name $AppName --resource-group $ResourceGroup `
        --min-replicas 0 --max-replicas 0 --only-show-errors | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "az containerapp update (scale to zero) failed (exit $LASTEXITCODE)." }

    Write-Ok "[$ScenarioId] app scaled to zero; original scale (min=$($scale.Min) max=$($scale.Max)) saved for rollback."
    Write-Info 'Allow ~2-5 min for telemetry ingestion, then OpsPilot should raise a P1 service-down incident.'
    Write-Info "Undo with:  ./service-outage.ps1 -ResourceGroup $ResourceGroup -AppName $AppName -Rollback"
    Write-ScenarioResult -ScenarioId $ScenarioId -Action 'execute' -Status 'ok'
    exit 0
}
catch {
    Write-Err "[$ScenarioId] $($_.Exception.Message)"
    Write-ScenarioResult -ScenarioId $ScenarioId -Action ($Rollback ? 'rollback' : 'execute') -Status 'fail'
    exit 1
}
