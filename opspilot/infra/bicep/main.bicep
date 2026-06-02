// ── OpsPilot Azure Infrastructure — Main Bicep Template ──────────────────────
//
// Deploys all Azure resources required by OpsPilot.
// Orchestrates modules in: infra/bicep/modules/
//
// Resources deployed:
//   - Azure Container Apps Environment + 3 container apps (frontend, api, agents)
//   - Azure AI Foundry project (wraps Azure OpenAI + AI Search)
//   - Azure Cosmos DB (NoSQL API)
//   - Azure AI Search
//   - Azure Key Vault
//   - Azure Application Insights + Log Analytics workspace
//   - Managed Identity for all container apps (no stored secrets)
//   - Role assignments: Container Apps MI → Key Vault Secrets User
//                       Container Apps MI → Cosmos DB Contributor
//                       Container Apps MI → AI Search Index Contributor

targetScope = 'resourceGroup'

@description('Environment name: dev | staging | prod')
param environmentName string

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Azure AI Foundry project name')
param aiFoundryProjectName string = 'opspilot-foundry'

// ── Module: Azure AI Foundry ──────────────────────────────────────────────────
module aiFoundry 'modules/aiFoundry.bicep' = {
  name: 'aiFoundry'
  params: {
    projectName: aiFoundryProjectName
    location: location
    environmentName: environmentName
  }
}

// ── Module: Azure Cosmos DB ───────────────────────────────────────────────────
module cosmosDb 'modules/cosmosDb.bicep' = {
  name: 'cosmosDb'
  params: {
    location: location
    environmentName: environmentName
  }
}

// ── Module: Azure AI Search ───────────────────────────────────────────────────
module aiSearch 'modules/aiSearch.bicep' = {
  name: 'aiSearch'
  params: {
    location: location
    environmentName: environmentName
  }
}

// ── Module: Azure Key Vault ───────────────────────────────────────────────────
module keyVault 'modules/keyVault.bicep' = {
  name: 'keyVault'
  params: {
    location: location
    environmentName: environmentName
  }
}

// ── Module: Azure Container Apps ─────────────────────────────────────────────
module containerApps 'modules/containerApps.bicep' = {
  name: 'containerApps'
  params: {
    location: location
    environmentName: environmentName
    cosmosDbEndpoint: cosmosDb.outputs.endpoint
    aiSearchEndpoint: aiSearch.outputs.endpoint
    aiFoundryEndpoint: aiFoundry.outputs.endpoint
    keyVaultUri: keyVault.outputs.uri
  }
}
