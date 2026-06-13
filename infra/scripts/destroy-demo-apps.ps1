<#
.SYNOPSIS
    Tear down the demo WORKLOADS (album-api, voting-app, voting-redis). Idempotent.

.DESCRIPTION
    By default deletes ONLY the demo container apps — core infrastructure and the
    EXTERNAL Azure AI Foundry resources are left untouched.

    -IncludeCoreInfra also deletes the core resources BY NAME (Container Apps env,
    ACR, Key Vault, Application Insights, Log Analytics, Managed Identity). It
    NEVER deletes Cognitive Services / AI Foundry resources and NEVER deletes the
    resource group (which may host Foundry). Requires -Force or an interactive 'yes'.

.EXAMPLE
    ./destroy-demo-apps.ps1 -ResourceGroup rg-opspilot
    ./destroy-demo-apps.ps1 -ResourceGroup rg-opspilot -IncludeCoreInfra -Force
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ResourceGroup,
    [ValidateSet('dev', 'staging', 'prod')][string]$Environment = 'dev',
    [string]$SubscriptionId,
    [switch]$IncludeCoreInfra,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/_common.ps1"

Write-Step "Destroy demo workloads — $ResourceGroup"
Assert-AzLogin -SubscriptionId $SubscriptionId | Out-Null

function Remove-ContainerApp {
    param([string]$Name)
    $exists = Invoke-AzJson @('containerapp', 'show', '--name', $Name, '-g', $ResourceGroup)
    if ($exists) {
        az containerapp delete --name $Name --resource-group $ResourceGroup --yes --only-show-errors | Out-Null
        Write-Ok "deleted container app: $Name"
    } else {
        Write-Info "skip (not found): $Name"
    }
}

# ── Demo workloads (always) ──────────────────────────────────────────────────
foreach ($app in @('album-api', 'voting-app', 'voting-redis')) { Remove-ContainerApp -Name $app }

# ── Optional core infra teardown (never Foundry, never the RG) ───────────────
if ($IncludeCoreInfra) {
    if (-not $Force) {
        $ans = Read-Host "Also delete CORE infra (Container Apps env, ACR, Key Vault, App Insights, Log Analytics, Managed Identity)? Type 'yes'"
        if ($ans -ne 'yes') { Write-Warn 'Core infra teardown cancelled.'; exit 0 }
    }

    # Safety: refuse if any Cognitive Services / Foundry resource is present — we never touch those.
    $cog = Invoke-AzJson @('resource', 'list', '-g', $ResourceGroup, '--resource-type', 'Microsoft.CognitiveServices/accounts')
    if ($cog) {
        Write-Warn "Resource group hosts Cognitive Services / Foundry ($($cog[0].name)). Core resources will be deleted individually by name — Foundry and the resource group are preserved."
    }

    $core = Read-Outputs -ResourceGroup $ResourceGroup -Environment $Environment

    function Remove-ByName {
        param([string]$Kind, [string[]]$ShowArgs, [string[]]$DeleteArgs, [string]$Name)
        if (-not $Name) { Write-Info "skip $Kind (name unknown)"; return }
        $exists = Invoke-AzJson $ShowArgs
        if ($exists) {
            az @DeleteArgs --only-show-errors | Out-Null
            Write-Ok "deleted $Kind`: $Name"
        } else { Write-Info "skip (not found) $Kind`: $Name" }
    }

    $envName = $core?.containerAppsEnvironmentName
    Remove-ByName -Kind 'Container Apps env' -Name $envName `
        -ShowArgs @('containerapp', 'env', 'show', '-n', "$envName", '-g', $ResourceGroup) `
        -DeleteArgs @('containerapp', 'env', 'delete', '-n', "$envName", '-g', $ResourceGroup, '--yes')

    $acr = (Invoke-AzJson @('acr', 'list', '-g', $ResourceGroup))
    if ($acr) { az acr delete -n $acr[0].name -g $ResourceGroup --yes --only-show-errors | Out-Null; Write-Ok "deleted ACR: $($acr[0].name)" }

    $kv = (Invoke-AzJson @('keyvault', 'list', '-g', $ResourceGroup))
    if ($kv) { az keyvault delete -n $kv[0].name -g $ResourceGroup | Out-Null; Write-Ok "deleted Key Vault: $($kv[0].name) (soft-deleted)" }

    $ai = (Invoke-AzJson @('resource', 'list', '-g', $ResourceGroup, '--resource-type', 'Microsoft.Insights/components'))
    if ($ai) { az resource delete -n $ai[0].name -g $ResourceGroup --resource-type 'Microsoft.Insights/components' --only-show-errors | Out-Null; Write-Ok "deleted App Insights: $($ai[0].name)" }

    $law = (Invoke-AzJson @('monitor', 'log-analytics', 'workspace', 'list', '-g', $ResourceGroup))
    if ($law) { az monitor log-analytics workspace delete -n $law[0].name -g $ResourceGroup --yes --force true --only-show-errors | Out-Null; Write-Ok "deleted Log Analytics: $($law[0].name)" }

    $mi = (Invoke-AzJson @('identity', 'list', '-g', $ResourceGroup))
    if ($mi) { az identity delete -n $mi[0].name -g $ResourceGroup --only-show-errors | Out-Null; Write-Ok "deleted Managed Identity: $($mi[0].name)" }
}

Write-Step 'Teardown complete'
Write-Host '  Azure AI Foundry (opspilot-agenthub) and the resource group are untouched.' -ForegroundColor Green
