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

const withApp = (path: string, app?: string) =>
  app ? `${path}?app=${encodeURIComponent(app)}` : path

export const demoApi = {
  list: (): Promise<DemoScenarioList> => apiFetch<DemoScenarioList>('/api/demo/scenarios'),
  run: (id: string, app?: string): Promise<DemoRunAck> =>
    apiPost<DemoRunAck>(withApp(`/api/demo/scenarios/${encodeURIComponent(id)}/run`, app)),
  rollback: (id: string, app?: string): Promise<DemoRunAck> =>
    apiPost<DemoRunAck>(withApp(`/api/demo/scenarios/${encodeURIComponent(id)}/rollback`, app)),
  status: (id: string, app?: string): Promise<DemoRunStatus> =>
    apiFetch<DemoRunStatus>(withApp(`/api/demo/scenarios/${encodeURIComponent(id)}/status`, app)),
}
