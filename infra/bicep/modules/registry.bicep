// ─────────────────────────────────────────────────────────────────────────────
// Container Registry module (OPTIONAL).
//
// Only deployed when building images from local source (az containerapp up uses
// it as the cloud-build target). Basic SKU, admin user disabled — the managed
// identity is granted AcrPull for keyless pulls.
// ─────────────────────────────────────────────────────────────────────────────

@description('Workload prefix.')
param namePrefix string

@description('Environment discriminator (used only for tagging / traceability).')
param environmentName string

@description('Azure region.')
param location string

@description('Globally-unique token (registry names are global + alphanumeric).')
param resourceToken string

@description('Principal id of the managed identity to grant AcrPull.')
param principalId string

@description('Resource tags.')
param tags object = {}

// ACR names: 5-50 chars, alphanumeric only, globally unique, lowercase.
var registryName = take(toLower('cr${namePrefix}${environmentName}${resourceToken}'), 50)

// Built-in role: AcrPull
var acrPullRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')

resource registry 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  // namePrefix(2+) + environmentName(3+) + 13-char token ⇒ always ≥ 18 chars.
  #disable-next-line BCP334
  name: registryName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
    anonymousPullEnabled: false
  }
}

resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, principalId, acrPullRoleId)
  scope: registry
  properties: {
    roleDefinitionId: acrPullRoleId
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

output name string = registry.name
output loginServer string = registry.properties.loginServer
output id string = registry.id
