// ─────────────────────────────────────────────────────────────────────────────
// Monitoring module — Log Analytics Workspace + workspace-based Application Insights.
//
// Both telemetry sinks land in ONE workspace so OpsPilot's AzureMonitor provider
// issues a single class of KQL (AppRequests/AppExceptions + ContainerAppConsoleLogs_CL).
// ─────────────────────────────────────────────────────────────────────────────

@description('Workload prefix.')
param namePrefix string

@description('Environment discriminator.')
param environmentName string

@description('Azure region.')
param location string

@description('Log Analytics retention (days).')
param retentionInDays int = 30

@description('Daily ingestion cap (GB); -1 = uncapped.')
param dailyQuotaGb int = 1

@description('Resource tags.')
param tags object = {}

var workspaceName = 'log-${namePrefix}-${environmentName}'
var appInsightsName = 'appi-${namePrefix}-${environmentName}'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: retentionInDays
    workspaceCapping: {
      dailyQuotaGb: dailyQuotaGb
    }
    features: {
      searchVersion: 1
    }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

output workspaceName string = logAnalytics.name
output workspaceId string = logAnalytics.id
output customerId string = logAnalytics.properties.customerId
output appInsightsName string = appInsights.name
output appInsightsId string = appInsights.id
output appInsightsConnectionString string = appInsights.properties.ConnectionString
