import { apiFetch } from './client'

/** GET /api/system/health — Foundry / model configuration (camelCase aliases). */
export interface ApiFoundryHealth {
  foundryConfigured: boolean
  specialistModel: string
  commanderModel: string
  reasoningModel: string
  agentsAvailable: string[]
  executionMode: string
  azureOpenAiEndpoint: string
}

/** GET /health — liveness + version. */
export interface ApiServiceHealth {
  status: string
  service: string
  version: string
}

/** GET /api/system/monitor — autonomous incident-detection monitor status. */
export interface MonitorStatus {
  enabled: boolean
  running: boolean
  telemetry_mode: string
  interval_seconds: number
  cooldown_seconds: number
  tracked_incidents: string[]
  dispatched_total: number
  last_scan_age_seconds: number | null
  last_error: string | null
  thresholds: Record<string, number>
}

export const systemApi = {
  foundryHealth: (): Promise<ApiFoundryHealth> =>
    apiFetch<ApiFoundryHealth>('/api/system/health'),
  health: (): Promise<ApiServiceHealth> => apiFetch<ApiServiceHealth>('/health'),
  monitor: (): Promise<MonitorStatus> => apiFetch<MonitorStatus>('/api/system/monitor'),
}
