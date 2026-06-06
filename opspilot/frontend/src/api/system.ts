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

export const systemApi = {
  foundryHealth: (): Promise<ApiFoundryHealth> =>
    apiFetch<ApiFoundryHealth>('/api/system/health'),
  health: (): Promise<ApiServiceHealth> => apiFetch<ApiServiceHealth>('/health'),
}
