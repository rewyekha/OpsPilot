<#
.SYNOPSIS
    Phase 4 — Validate the album-api workload. Read-only; PASS / FAIL / WARNING.

.DESCRIPTION
    Checks: deployment succeeded · ingress URL exists · health endpoint responds ·
    telemetry visible in the OpsPilot workspace. Exits non-zero on any FAIL.

.EXAMPLE
    ./validate-album-api.ps1 -ResourceGroup rg-opspilot -Environment dev
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

Write-Step "Validating $AppName"
Assert-AzLogin -SubscriptionId $SubscriptionId | Out-Null

# album-api health target: GET / returns 200 JSON.
$results = Test-Workload -ResourceGroup $ResourceGroup -Environment $Environment -AppName $AppName -HealthPath '/'
exit (Write-ValidationSummary -Results $results -Title "$AppName")
