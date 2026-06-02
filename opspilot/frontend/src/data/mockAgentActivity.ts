export type AgentRole = 'commander' | 'metrics' | 'logs' | 'deployment' | 'time_machine'
export type AgentStatus = 'completed' | 'running' | 'waiting'

export interface AgentActivity {
  id: AgentRole
  name: string
  role: string
  status: AgentStatus
  startedAt: string
  completedAt: string | undefined
  durationLabel: string | undefined
  findings: string
  confidence: number
}

export const MOCK_AGENT_ACTIVITIES: AgentActivity[] = [
  {
    id: 'commander',
    name: 'Commander Agent',
    role: 'Incident Triage & Orchestration',
    status: 'completed',
    startedAt: '14:18:02',
    completedAt: '14:18:06',
    durationLabel: '4s',
    findings:
      'Incident triaged as P1-Critical. Root cause hypothesis: deployment regression in checkout-svc. Dispatched Metrics, Logs, Deployment, and Time Machine agents for parallel deep-dive investigation.',
    confidence: 94,
  },
  {
    id: 'metrics',
    name: 'Metrics Agent',
    role: 'APM & Infrastructure Telemetry',
    status: 'completed',
    startedAt: '14:18:07',
    completedAt: '14:18:14',
    durationLabel: '7s',
    findings:
      'Error rate spiked to 62% at 14:15:41 UTC. DB connection pool saturated at 100% utilization (pool_size=10). P99 latency 4,218ms vs. 45ms baseline. CPU and memory nominal across all pods.',
    confidence: 91,
  },
  {
    id: 'logs',
    name: 'Logs Agent',
    role: 'Log Analytics & Pattern Recognition',
    status: 'completed',
    startedAt: '14:18:07',
    completedAt: '14:18:18',
    durationLabel: '11s',
    findings:
      '1,847 ConnectionPoolTimeoutError entries in checkout-svc since 14:15:33 UTC. All errors originate from ORM layer. Pattern consistent with pool exhaustion under concurrent write load.',
    confidence: 89,
  },
  {
    id: 'deployment',
    name: 'Deployment Agent',
    role: 'Change Intelligence & Release Analysis',
    status: 'completed',
    startedAt: '14:18:08',
    completedAt: '14:18:21',
    durationLabel: '13s',
    findings:
      'v2.4.1 deployed at 14:12:00 UTC — 2nd deployment today. Diff: ORM pool_size reduced 20 → 10. No prior incidents at pool_size=10 under this traffic level. Change onset ≤3.5 min before incident start.',
    confidence: 96,
  },
  {
    id: 'time_machine',
    name: 'Time Machine Agent',
    role: 'Historical Baseline & Anomaly Correlation',
    status: 'running',
    startedAt: '14:18:22',
    completedAt: undefined,
    durationLabel: undefined,
    findings:
      'Scanning 7-day baseline metrics for pool exhaustion patterns. Cross-referencing previous v2.x deployments to confirm regression signature and assess rollback risk profile...',
    confidence: 72,
  },
]
