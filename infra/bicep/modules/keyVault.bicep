// ─────────────────────────────────────────────────────────────────────────────
// Key Vault module — RBAC-authorized vault for external-dependency config
// (e.g. the Foundry endpoint / Application Insights connection string).
//
// Grants the managed identity the "Key Vault Secrets User" role so workloads
// read secrets keylessly. No access policies, no admin keys.
// ─────────────────────────────────────────────────────────────────────────────

@description('Workload prefix.')
param namePrefix string

@description('Azure region.')
param location string

@description('Globally-unique token (keeps the vault name unique).')
param resourceToken string

@description('Enable purge protection (irreversible while set). Keep false for demos.')
param purgeProtection bool = false

@description('Principal id of the managed identity to grant Secrets User.')
param principalId string

@description('Resource tags.')
param tags object = {}

// Key Vault names: 3-24 chars, alphanumeric + hyphens, start with a letter.
var keyVaultName = take('kv-${namePrefix}-${resourceToken}', 24)

// Built-in role: Key Vault Secrets User
var keyVaultSecretsUserRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enablePurgeProtection: purgeProtection ? true : null
    publicNetworkAccess: 'Enabled'
  }
}

resource secretsUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, principalId, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: keyVaultSecretsUserRoleId
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

output name string = keyVault.name
output id string = keyVault.id
output uri string = keyVault.properties.vaultUri
