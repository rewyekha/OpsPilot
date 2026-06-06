<#
.SYNOPSIS
    Phase 2 — Validate OpsPilot core infrastructure + Azure AI Foundry connectivity.

.DESCRIPTION
    Read-only. Checks each core resource and the EXTERNAL Foundry dependency, then
    prints a PASS / FAIL / WARNING summary and exits non-zero on any FAIL. Never
    creates, updates, or deletes anything (Foundry included).

    Checks: Log Analytics · Application Insights · Container Apps Environment ·
    Managed Identity · Key Vault · Foundry endpoint reachable · authentication ·
    o4-mini deployment exists · o4-mini invocation test.

.EXAMPLE
    ./validate-core-infra.ps1 -ResourceGroup rg-opspilot `
        -FoundryEndpoint https://opspilot-agenthub-resource.services.ai.azure.com/ `
        -FoundryApiKey $env:FOUNDRY_API_KEY
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ResourceGroup,
    [ValidateSet('dev', 'staging', 'prod')][string]$Environment = 'dev',
    [string]$SubscriptionId,
    [string]$FoundryEndpoint = $env:FOUNDRY_ENDPOINT,
    [string]$FoundryApiKey = $env:FOUNDRY_API_KEY,
    [string]$FoundryDeployment = 'o4-mini',
    [string]$FoundryApiVersion = '2025-04-01-preview'
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/_common.ps1"

Write-Step "Validating core infrastructure — $ResourceGroup"
Assert-AzLogin -SubscriptionId $SubscriptionId | Out-Null
$R = New-Validation

# ── Core Azure resources (queried by resource group — no name guessing) ──────
$law = Invoke-AzJson @('monitor', 'log-analytics', 'workspace', 'list', '-g', $ResourceGroup)
if ($law) { Add-Result $R 'Log Analytics Workspace' 'PASS' $law[0].name }
else { Add-Result $R 'Log Analytics Workspace' 'FAIL' 'not found in resource group' }

$appi = Invoke-AzJson @('resource', 'list', '-g', $ResourceGroup, '--resource-type', 'Microsoft.Insights/components')
if ($appi) { Add-Result $R 'Application Insights' 'PASS' $appi[0].name }
else { Add-Result $R 'Application Insights' 'FAIL' 'not found' }

$caEnv = Invoke-AzJson @('containerapp', 'env', 'list', '-g', $ResourceGroup)
if ($caEnv) {
    $state = $caEnv[0].properties.provisioningState
    if ($state -eq 'Succeeded') { Add-Result $R 'Container Apps Environment' 'PASS' "$($caEnv[0].name) ($state)" }
    else { Add-Result $R 'Container Apps Environment' 'WARNING' "$($caEnv[0].name) ($state)" }
} else { Add-Result $R 'Container Apps Environment' 'FAIL' 'not found' }

$mi = Invoke-AzJson @('identity', 'list', '-g', $ResourceGroup)
if ($mi) { Add-Result $R 'Managed Identity' 'PASS' $mi[0].name }
else { Add-Result $R 'Managed Identity' 'FAIL' 'not found' }

$kv = Invoke-AzJson @('keyvault', 'list', '-g', $ResourceGroup)
if ($kv) { Add-Result $R 'Key Vault' 'PASS' $kv[0].name }
else { Add-Result $R 'Key Vault' 'FAIL' 'not found' }

# ── Azure AI Foundry (EXTERNAL — validated, never modified) ───────────────────
if (-not $FoundryEndpoint -or -not $FoundryApiKey) {
    Add-Result $R 'Foundry connectivity' 'WARNING' 'FOUNDRY_ENDPOINT / FOUNDRY_API_KEY not provided — skipped'
    Add-Result $R 'Foundry authentication' 'WARNING' 'skipped (no credentials)'
    Add-Result $R 'o4-mini deployment' 'WARNING' 'skipped (no credentials)'
    Add-Result $R 'o4-mini invocation test' 'WARNING' 'skipped (no credentials)'
} else {
    $base = $FoundryEndpoint.TrimEnd('/')

    # 1. Endpoint reachable (any HTTP response = reachable; only a connection error fails).
    try {
        Invoke-WebRequest -Uri $base -Method Head -TimeoutSec 15 -SkipHttpErrorCheck | Out-Null
        Add-Result $R 'Foundry connectivity' 'PASS' $base
    } catch {
        Add-Result $R 'Foundry connectivity' 'FAIL' "unreachable: $($_.Exception.Message)"
    }

    # 2–4. Authentication + deployment exists + invocation, via one chat-completions call.
    $uri = "$base/openai/deployments/$FoundryDeployment/chat/completions?api-version=$FoundryApiVersion"
    $body = @{ messages = @(@{ role = 'user'; content = 'ping' }); max_completion_tokens = 16 } | ConvertTo-Json -Depth 4
    try {
        $resp = Invoke-WebRequest -Uri $uri -Method Post -Headers @{ 'api-key' = $FoundryApiKey } `
            -ContentType 'application/json' -Body $body -TimeoutSec 60 -SkipHttpErrorCheck
        $code = [int]$resp.StatusCode
        switch ($code) {
            200 {
                Add-Result $R 'Foundry authentication' 'PASS' 'api-key accepted'
                Add-Result $R 'o4-mini deployment' 'PASS' "$FoundryDeployment present"
                Add-Result $R 'o4-mini invocation test' 'PASS' 'chat completion 200'
            }
            { $_ -in 401, 403 } {
                Add-Result $R 'Foundry authentication' 'FAIL' "HTTP $code — invalid api-key"
                Add-Result $R 'o4-mini deployment' 'WARNING' 'not tested (auth failed)'
                Add-Result $R 'o4-mini invocation test' 'WARNING' 'not tested (auth failed)'
            }
            404 {
                Add-Result $R 'Foundry authentication' 'PASS' 'request reached service'
                Add-Result $R 'o4-mini deployment' 'FAIL' "deployment '$FoundryDeployment' not found (404)"
                Add-Result $R 'o4-mini invocation test' 'FAIL' 'deployment missing'
            }
            default {
                Add-Result $R 'Foundry authentication' 'WARNING' "HTTP $code"
                Add-Result $R 'o4-mini deployment' 'WARNING' "HTTP $code"
                Add-Result $R 'o4-mini invocation test' 'FAIL' "unexpected HTTP $code"
            }
        }
    } catch {
        Add-Result $R 'o4-mini invocation test' 'FAIL' "request error: $($_.Exception.Message)"
    }
}

exit (Write-ValidationSummary -Results $R -Title 'Core infrastructure')
