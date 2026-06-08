<#
.SYNOPSIS
    Demo-failure scenario: RESTART STORM / crash loop (id: restart-storm).

.DESCRIPTION
    Captures the container app's current image, then forces a crash/restart loop by
    updating the image to a tag that fails to pull
    (mcr.microsoft.com/azuredocs/aci-helloworld:nonexistent-restart-opspilot).
    Container Apps repeatedly tries (and fails) to start the revision, producing
    container instability — a restart storm.

    Implemented via the bad-image approach (preferred for reliability over a failing
    startup command, which depends on the app honouring a custom command). The
    original image is captured into a temp state file BEFORE the mutation so
    -Rollback restores it exactly.

    Expected OpsPilot reaction: P1 "container instability / restart storm" incident.

.EXAMPLE
    ./restart-storm.ps1 -ResourceGroup rg-opspilot
.EXAMPLE
    ./restart-storm.ps1 -ResourceGroup rg-opspilot -Rollback
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

$ScenarioId  = 'restart-storm'
# Distinct tag from deployment-regression so the two scenarios never alias each other.
$BrokenImage = 'mcr.microsoft.com/azuredocs/aci-helloworld:nonexistent-restart-opspilot'

function Get-CurrentImage {
    $img = az containerapp show --name $AppName --resource-group $ResourceGroup `
        --query properties.template.containers[0].image -o tsv 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($img)) { return $null }
    return $img.Trim()
}

try {
    Assert-AzLogin | Out-Null
    $app = Invoke-AzJson @('containerapp', 'show', '--name', $AppName, '-g', $ResourceGroup)
    if (-not $app) { throw "Container app '$AppName' not found in '$ResourceGroup'." }

    if ($Rollback) {
        Write-Step "[$ScenarioId] ROLLBACK — restoring original image"
        $state = Read-ScenarioState -AppName $AppName -ScenarioId $ScenarioId
        $original = $state?.originalImage
        if ([string]::IsNullOrWhiteSpace($original)) {
            throw "No captured original image found (state file missing). Cannot safely roll back; redeploy with deploy-album-api.ps1."
        }
        Write-Info "Restoring image → $original"
        az containerapp update --name $AppName --resource-group $ResourceGroup `
            --image $original --only-show-errors | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "az containerapp update (restore) failed (exit $LASTEXITCODE)." }
        Remove-ScenarioState -AppName $AppName -ScenarioId $ScenarioId
        Write-Ok "[$ScenarioId] image restored to $original"
        Write-ScenarioResult -ScenarioId $ScenarioId -Action 'rollback' -Status 'ok'
        exit 0
    }

    Write-Step "[$ScenarioId] EXECUTE — forcing a crash/restart loop via unpullable image"
    $current = Get-CurrentImage
    if ([string]::IsNullOrWhiteSpace($current)) { throw "Could not read current image for '$AppName'." }

    if ($current -eq $BrokenImage) {
        Write-Warn "[$ScenarioId] image is already the broken tag — scenario already active (no-op)."
        Write-ScenarioResult -ScenarioId $ScenarioId -Action 'execute' -Status 'ok'
        exit 0
    }

    Save-ScenarioState -AppName $AppName -ScenarioId $ScenarioId -State @{
        kind          = 'crash-loop-image'
        originalImage = $current
        brokenImage   = $BrokenImage
    } | Out-Null
    Write-Info "Captured original image: $current"

    Write-Info "Updating image → $BrokenImage (revision will fail to pull → restart storm)"
    az containerapp update --name $AppName --resource-group $ResourceGroup `
        --image $BrokenImage --only-show-errors | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "az containerapp update returned exit $LASTEXITCODE (a failing pull can still produce this) — original image was captured for rollback."
    }

    Write-Ok "[$ScenarioId] crash-loop revision deployed; original image saved for rollback."
    Write-Info 'Allow ~2-5 min for telemetry ingestion, then OpsPilot should raise a P1 container-instability incident.'
    Write-Info "Undo with:  ./restart-storm.ps1 -ResourceGroup $ResourceGroup -AppName $AppName -Rollback"
    Write-ScenarioResult -ScenarioId $ScenarioId -Action 'execute' -Status 'ok'
    exit 0
}
catch {
    Write-Err "[$ScenarioId] $($_.Exception.Message)"
    Write-ScenarioResult -ScenarioId $ScenarioId -Action ($Rollback ? 'rollback' : 'execute') -Status 'fail'
    exit 1
}
