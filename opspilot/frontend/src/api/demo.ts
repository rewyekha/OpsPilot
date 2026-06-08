import { apiFetch, apiPost } from './client'

export interface DemoScenario {
  id: string
  name: string
  description: string
  expected: string
  running: boolean
}

export interface DemoScenarioList {
  demo_mode_enabled: boolean
  resource_group: string
  app_name: string
  pwsh_available: boolean
  scenarios: DemoScenario[]
}

export interface DemoRunStatus {
  scenario: string
  state: 'idle' | 'running' | 'finished'
  action?: string
  returncode?: number | null
  elapsed_seconds?: number
  output_tail?: string
}

export interface DemoRunAck {
  scenario: string
  action: string
  status: string
}

export const demoApi = {
  list: (): Promise<DemoScenarioList> => apiFetch<DemoScenarioList>('/api/demo/scenarios'),
  run: (id: string): Promise<DemoRunAck> =>
    apiPost<DemoRunAck>(`/api/demo/scenarios/${encodeURIComponent(id)}/run`),
  rollback: (id: string): Promise<DemoRunAck> =>
    apiPost<DemoRunAck>(`/api/demo/scenarios/${encodeURIComponent(id)}/rollback`),
  status: (id: string): Promise<DemoRunStatus> =>
    apiFetch<DemoRunStatus>(`/api/demo/scenarios/${encodeURIComponent(id)}/status`),
}
