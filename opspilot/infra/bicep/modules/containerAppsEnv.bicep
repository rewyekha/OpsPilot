// ─────────────────────────────────────────────────────────────────────────────
// Container Apps Environment module.
//
// The shared runtime for the demo workloads (album-api, voting-app). Wired to the
// Log Analytics workspace so every container's console/system logs land in the
// same workspace OpsPilot queries. Consumption-only (scale-to-zero) for cost.
// ─────────────────────────────────────────────────────────────────────────────

@description('Workload prefix.')
param namePrefix string

@description('Environment discriminator.')
param environmentName string

@description('Azure region.')
param location string

@description('Name of the Log Analytics workspace (same resource group).')
param logAnalyticsWorkspaceName string

@description('Resource tags.')
param tags object = {}

// Reference the existing workspace to read its customerId + shared key in-module,
// so no secret is passed across the module boundary.
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
}

resource managedEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-${namePrefix}-${environmentName}'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
    zoneRedundant: false
  }
}

output name string = managedEnvironment.name
output id string = managedEnvironment.id
output defaultDomain string = managedEnvironment.properties.defaultDomain
output staticIp string = managedEnvironment.properties.staticIp
