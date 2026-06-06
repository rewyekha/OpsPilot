// ─────────────────────────────────────────────────────────────────────────────
// OpsPilot — Core demo infrastructure (main.bicep)
//
// Provisions ONLY the infrastructure OpsPilot actually requires to investigate
// real Azure workloads:
//   • Log Analytics Workspace      (telemetry + Container Apps logs backend)
//   • Application Insights          (workspace-based; app telemetry)
//   • User-assigned Managed Identity (keyless auth for workloads + backend)
//   • Key Vault                     (RBAC; holds external dependency config)
//   • Container Apps Environment    (runtime for the demo workloads)
//   • Azure Container Registry      (OPTIONAL — only when building from source)
//
// Azure AI Foundry (opspilot-agenthub + o4-mini) is an EXTERNAL dependency.
// It is NEVER provisioned, updated, or deleted here — only validated by the
// scripts. No AI Search / Cosmos DB / Redis / Service Bus (not required).
//
// Deploy:  az deployment group create -g <rg> -f main.bicep -p parameters/dev.bicepparam
// ─────────────────────────────────────────────────────────────────────────────

targetScope = 'resourceGroup'

// ── Parameters (no hardcoded values — everything is parameterised) ───────────

@description('Environment discriminator: dev | staging | prod. Drives naming + SKUs.')
@allowed([ 'dev', 'staging', 'prod' ])
param environmentName string

@description('Azure region for all resources. Defaults to the resource group region.')
param location string = resourceGroup().location

@description('Short workload prefix used in every resource name (Azure CAF style).')
@minLength(2)
@maxLength(12)
param namePrefix string = 'opspilot'

@description('Deploy an Azure Container Registry. Only needed if you build images from source (az containerapp up). Set false to reuse an existing registry / public images.')
param deployContainerRegistry bool = true

@description('Log Analytics retention in days.')
@minValue(30)
@maxValue(730)
param logRetentionInDays int = 30

@description('Log Analytics daily ingestion cap (GB). -1 = uncapped. Set a small cap for demos to bound cost.')
param logDailyQuotaGb int = 1

@description('Enable Key Vault purge protection. Keep false for short-lived demo envs so the vault can be fully deleted.')
param keyVaultPurgeProtection bool = false

@description('Tags applied to every resource.')
param tags object = {
  workload: 'opspilot'
  environment: environmentName
  managedBy: 'bicep'
  costCenter: 'demo'
}

// ── Deterministic, globally-unique naming token ──────────────────────────────
// resourceToken is stable per resource group, so re-deploys are idempotent and
// globally-unique names (Key Vault, ACR) don't collide across subscriptions.
var resourceToken = toLower(uniqueString(subscription().id, resourceGroup().id, environmentName))

// ── Module: Monitoring (Log Analytics + Application Insights) ─────────────────
module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    retentionInDays: logRetentionInDays
    dailyQuotaGb: logDailyQuotaGb
    tags: tags
  }
}

// ── Module: Managed Identity ─────────────────────────────────────────────────
module identity 'modules/identity.bicep' = {
  name: 'identity'
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: tags
  }
}

// ── Module: Key Vault (RBAC; MI granted Secrets User) ────────────────────────
module keyVault 'modules/keyVault.bicep' = {
  name: 'keyVault'
  params: {
    namePrefix: namePrefix
    location: location
    resourceToken: resourceToken
    purgeProtection: keyVaultPurgeProtection
    principalId: identity.outputs.principalId
    tags: tags
  }
}

// ── Module: Container Apps Environment (wired to Log Analytics) ───────────────
module containerEnv 'modules/containerAppsEnv.bicep' = {
  name: 'containerAppsEnv'
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    logAnalyticsWorkspaceName: monitoring.outputs.workspaceName
    tags: tags
  }
}

// ── Module: Container Registry (optional) ────────────────────────────────────
module registry 'modules/registry.bicep' = if (deployContainerRegistry) {
  name: 'registry'
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    resourceToken: resourceToken
    principalId: identity.outputs.principalId
    tags: tags
  }
}

// ── Outputs (consumed by the deploy/validate scripts + backend .env) ─────────
output resourceGroupName string = resourceGroup().name
output location string = location
output environmentName string = environmentName

output logAnalyticsWorkspaceName string = monitoring.outputs.workspaceName
output logAnalyticsWorkspaceId string = monitoring.outputs.workspaceId
output logAnalyticsCustomerId string = monitoring.outputs.customerId
output appInsightsName string = monitoring.outputs.appInsightsName
output appInsightsConnectionString string = monitoring.outputs.appInsightsConnectionString

output managedIdentityName string = identity.outputs.name
output managedIdentityId string = identity.outputs.id
output managedIdentityClientId string = identity.outputs.clientId
output managedIdentityPrincipalId string = identity.outputs.principalId

output keyVaultName string = keyVault.outputs.name
output keyVaultUri string = keyVault.outputs.uri

output containerAppsEnvironmentName string = containerEnv.outputs.name
output containerAppsEnvironmentId string = containerEnv.outputs.id
output containerAppsDefaultDomain string = containerEnv.outputs.defaultDomain

output containerRegistryLoginServer string = registry.?outputs.loginServer ?? ''
output containerRegistryName string = registry.?outputs.name ?? ''
