// ─────────────────────────────────────────────────────────────────────────────
// Identity module — user-assigned managed identity.
//
// Shared by the OpsPilot backend (to read Log Analytics / App Insights) and the
// demo workloads (to pull from ACR). Keyless auth — no stored credentials.
// ─────────────────────────────────────────────────────────────────────────────

@description('Workload prefix.')
param namePrefix string

@description('Environment discriminator.')
param environmentName string

@description('Azure region.')
param location string

@description('Resource tags.')
param tags object = {}

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${namePrefix}-${environmentName}'
  location: location
  tags: tags
}

output name string = managedIdentity.name
output id string = managedIdentity.id
output principalId string = managedIdentity.properties.principalId
output clientId string = managedIdentity.properties.clientId
