// Domain types — Agent
// Mirrors backend app/agents/state.py agent fields

export type AgentName =
  | 'commander'
  | 'metrics_agent'
  | 'logs_agent'
  | 'deployment_agent'
  | 'time_machine_agent'

export type AgentStatus = 'pending' | 'running' | 'complete' | 'failed' | 'skipped'

export interface AgentInfo {
  name: AgentName
  displayName: string
  description: string
  model: string
  status: AgentStatus
  startedAt: string | null
  completedAt: string | null
  toolCallCount: number
  foundryTraceId: string | null   // links to Azure AI Foundry trace for inspection
}

export type AgentStatusMap = Record<AgentName, AgentInfo>
