import { apiFetch } from './client'

/** Coarse health classification (mirrors backend app.telemetry.models.HealthStatus). */
export type ServiceHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

/** One monitored service row (mirrors backend ServiceHealth, camelCase aliases). */
export interface ApiServiceHealth {
  name: string
  status: ServiceHealthStatus
  responseTimeMs: number
  errorRatePct: number
  lastIncident: string | null
  source: string
}

export interface ApiMonitoredServicesResponse {
  telemetryMode: string
  services: ApiServiceHealth[]
}

export const servicesApi = {
  list: (timeoutMs?: number): Promise<ApiMonitoredServicesResponse> =>
    apiFetch<ApiMonitoredServicesResponse>('/api/system/services', { timeoutMs }),
}
