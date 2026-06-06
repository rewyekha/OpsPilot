<#
.SYNOPSIS
    Phase 1 — Deploy OpsPilot core demo infrastructure (idempotent).

.DESCRIPTION
    Provisions ONLY what OpsPilot needs (Log Analytics, Application Insights,
    Managed Identity, Key Vault, Container Apps Environment, optional ACR) via
    infra/bicep/main.bicep. Azure AI Foundry is an EXTERNAL dependency and is
    never provisioned here. Safe to re-run — uses an incremental deployment.

    Caches the deployment outputs to a temp file so the app deploy/validate
    scripts can consume them. Optionally stores the Foundry endpoint in Key Vault.

.EXAMPLE
    ./deploy-core-infra.ps1 -ResourceGroup rg-opspilot -Location eastus2 -Environment dev

.NOTES
    Requires: Azure CLI >= 2.53 + `az login`. Run from anywhere (paths are script-relative).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ResourceGroup,
    [string]$Location = 'eastus2',
    [ValidateSet('dev', 'staging', 'prod')][string]$Environment = 'dev',
    [string]$NamePrefix = 'opspilot',
    [string]$SubscriptionId,
    [bool]$DeployContainerRegistry = $true,
    # Optional: cache the (external) Foundry endpoint into Key Vault for the app/backend.
    [string]$FoundryEndpoint
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/_common.ps1"

$bicep = Join-Path $PSScriptRoot '../bicep/main.bicep' | Resolve-Path

Write-Step "OpsPilot core infrastructure — $Environment"
Assert-AzLogin -SubscriptionId $SubscriptionId | Out-Null

# ── 0. Register resource providers (idempotent) ──────────────────────────────
Write-Step 'Ensuring resource providers are registered'
foreach ($ns in @('Microsoft.App', 'Microsoft.OperationalInsights', 'Microsoft.Insights',
                  'Microsoft.ManagedIdentity', 'Microsoft.KeyVault', 'Microsoft.ContainerRegistry')) {
    az provider register --namespace $ns --wait | Out-Null
    Write-Info "provider registered: $ns"
}

# ── 1. Resource group (idempotent) ───────────────────────────────────────────
Write-Step "Resource group: $ResourceGroup ($Location)"
az group create --name $ResourceGroup --location $Location --tags workload=opspilot environment=$Environment managedBy=script --only-show-errors | Out-Null
Write-Ok "Resource group ready"

# ── 2. Deploy core infrastructure (incremental = idempotent) ─────────────────
$deploymentName = "opspilot-core-$Environment-$((Get-Date).ToString('yyyyMMddHHmmss'))"
Write-Step "Deploying core infrastructure ($deploymentName)"
Write-Info "Template: $bicep"

$result = az deployment group create `
    --resource-group $ResourceGroup `
    --name $deploymentName `
    --mode Incremental `
    --template-file $bicep `
    --parameters environmentName=$Environment location=$Location namePrefix=$NamePrefix deployContainerRegistry=$DeployContainerRegistry `
    -o json 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Err "Deployment failed:"
    Write-Host $result
    exit 1
}
$o = ($result | ConvertFrom-Json).properties.outputs

# ── 3. Cache outputs for the app scripts ─────────────────────────────────────
$outputs = @{
    resourceGroup                 = $ResourceGroup
    environment                   = $Environment
    location                      = $o.location.value
    logAnalyticsWorkspaceName     = $o.logAnalyticsWorkspaceName.value
    logAnalyticsCustomerId        = $o.logAnalyticsCustomerId.value
    appInsightsName               = $o.appInsightsName.value
    appInsightsConnectionString   = $o.appInsightsConnectionString.value
    managedIdentityClientId       = $o.managedIdentityClientId.value
    managedIdentityPrincipalId    = $o.managedIdentityPrincipalId.value
    keyVaultName                  = $o.keyVaultName.value
    keyVaultUri                   = $o.keyVaultUri.value
    containerAppsEnvironmentName  = $o.containerAppsEnvironmentName.value
    containerAppsDefaultDomain    = $o.containerAppsDefaultDomain.value
    containerRegistryLoginServer  = $o.containerRegistryLoginServer.value
}
Save-Outputs -Outputs $outputs -ResourceGroup $ResourceGroup -Environment $Environment

# ── 4. (Optional) cache the external Foundry endpoint in Key Vault ────────────
if ($FoundryEndpoint) {
    Write-Step 'Storing Foundry endpoint in Key Vault (external dependency reference)'
    az keyvault secret set --vault-name $outputs.keyVaultName --name 'foundry-endpoint' --value $FoundryEndpoint --only-show-errors | Out-Null
    Write-Ok 'foundry-endpoint secret set'
}

# ── 5. Summary ────────────────────────────────────────────────────────────────
Write-Step 'Core infrastructure deployed'
Write-Host "  Log Analytics      : $($outputs.logAnalyticsWorkspaceName) (customerId $($outputs.logAnalyticsCustomerId))"
Write-Host "  Application Insights: $($outputs.appInsightsName)"
Write-Host "  Managed Identity    : clientId $($outputs.managedIdentityClientId)"
Write-Host "  Key Vault           : $($outputs.keyVaultName) ($($outputs.keyVaultUri))"
Write-Host "  Container Apps Env   : $($outputs.containerAppsEnvironmentName)"
Write-Host "  Container Registry   : $(($outputs.containerRegistryLoginServer) ? $outputs.containerRegistryLoginServer : '(not deployed)')"
Write-Host ''
Write-Host '  Backend (.env) for live telemetry investigations:' -ForegroundColor Cyan
Write-Host "    TELEMETRY_MODE=azure"
Write-Host "    AZURE_LOG_ANALYTICS_WORKSPACE_ID=$($outputs.logAnalyticsCustomerId)"
Write-Host "    APPLICATIONINSIGHTS_CONNECTION_STRING=$($outputs.appInsightsConnectionString)"
Write-Host ''
Write-Host '  Next: ./validate-core-infra.ps1 -ResourceGroup ' -NoNewline; Write-Host $ResourceGroup
