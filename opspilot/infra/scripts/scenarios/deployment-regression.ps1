<#
.SYNOPSIS
    Demo-failure scenario: DEPLOYMENT REGRESSION (id: deployment-regression).

.DESCRIPTION
    Captures the container app's current image, then deploys a BROKEN revision by
    updating the image to a tag that fails to pull
    (mcr.microsoft.com/azuredocs/aci-helloworld:nonexistent-tag-opspilot).
    The new revision cannot start → the app serves errors / becomes unavailable,
    simulating a bad deploy.

    The original image is captured into a temp state file BEFORE the mutation so
    -Rollback restores exactly the previous image.

    Expected OpsPilot reaction: P1 incident — error spike / service-down correlated
    with a recent deployment.

.EXAMPLE
    ./deployment-regression.ps1 -ResourceGroup rg-opspilot
.EXAMPLE
    ./deployment-regression.ps1 -ResourceGroup rg-opspilot -Rollback
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

$ScenarioId  = 'deployment-regression'
$BrokenImage = 'mcr.microsoft.com/azuredocs/aci-helloworld:nonexistent-tag-opspilot'

# Read the live image off the running container app (single container at index 0).
function Get-CurrentImage {
    $img = az containerapp show --name $AppName --resource-group $ResourceGroup `
        --query properties.template.containers[0].image -o tsv 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($img)) { return $null }
    return $img.Trim()
}

try {
    Assert-AzLogin | Out-Null
    # Confirm the app exists before doing anything.
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

    Write-Step "[$ScenarioId] EXECUTE — deploying a broken (unpullable) revision"
    $current = Get-CurrentImage
    if ([string]::IsNullOrWhiteSpace($current)) { throw "Could not read current image for '$AppName'." }

    if ($current -eq $BrokenImage) {
        # Idempotent: already broken. Don't overwrite a previously captured good image.
        Write-Warn "[$ScenarioId] image is already the broken tag — scenario already active (no-op)."
        Write-ScenarioResult -ScenarioId $ScenarioId -Action 'execute' -Status 'ok'
        exit 0
    }

    Save-ScenarioState -AppName $AppName -ScenarioId $ScenarioId -State @{
        kind          = 'image-swap'
        originalImage = $current
        brokenImage   = $BrokenImage
    } | Out-Null
    Write-Info "Captured original image: $current"

    Write-Info "Updating image → $BrokenImage (expected to fail pull / unhealthy revision)"
    az containerapp update --name $AppName --resource-group $ResourceGroup `
        --image $BrokenImage --only-show-errors | Out-Null
    # NOTE: the control-plane update may succeed even though the revision can't pull;
    # the unhealthy revision is exactly the fault we want, so we don't fail on exit code
    # alone, but we do surface it.
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "az containerapp update returned exit $LASTEXITCODE (a failing pull can still produce this) — verifying state was captured."
    }

    Write-Ok "[$ScenarioId] broken revision deployed; original image saved for rollback."
    Write-Info 'Allow ~2-5 min for telemetry ingestion, then OpsPilot should raise a P1 post-deploy incident.'
    Write-Info "Undo with:  ./deployment-regression.ps1 -ResourceGroup $ResourceGroup -AppName $AppName -Rollback"
    Write-ScenarioResult -ScenarioId $ScenarioId -Action 'execute' -Status 'ok'
    exit 0
}
catch {
    Write-Err "[$ScenarioId] $($_.Exception.Message)"
    Write-ScenarioResult -ScenarioId $ScenarioId -Action ($Rollback ? 'rollback' : 'execute') -Status 'fail'
    exit 1
}
