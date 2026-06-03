export type TimelineEventType =
  | 'deployment'
  | 'incident'
  | 'detection'
  | 'correlation'
  | 'root_cause'

export interface TimelineEvent {
  id: string
  timestamp: string
  type: TimelineEventType
  title: string
  description: string
  source: string
  confidence: number
  isKeyEvent?: boolean
}

export const MOCK_TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: 'evt-1',
    timestamp: '14:12 UTC',
    type: 'deployment',
    title: 'v2.4.1 Deployment Started',
    description:
      'checkout-svc v2.4.1 deployed via CI/CD pipeline. Config diff included ORM pool_size change from 20 to 10. Deployment health checks passed and rollout marked successful.',
    source: 'CI/CD Pipeline',
    confidence: 100,
    isKeyEvent: false,
  },
  {
    id: 'evt-2',
    timestamp: '14:15 UTC',
    type: 'incident',
    title: 'Error Rate Escalated to 62%',
    description:
      'Automated alerting triggered. Error rate on checkout-svc escalated from 1% to 62% within 90 seconds. P1 incident INC-2024-0847 auto-created and on-call team paged.',
    source: 'Alerting System',
    confidence: 100,
    isKeyEvent: false,
  },
  {
    id: 'evt-3',
    timestamp: '14:15 UTC',
    type: 'detection',
    title: 'Latency Spike & Pool Saturation Detected',
    description:
      'P99 latency jumped from 45ms to 4,218ms. DB connection pool saturated at 100% utilization (pool_size=10). CPU and memory nominal across all pods — hardware cause ruled out.',
    source: 'Metrics Agent',
    confidence: 91,
    isKeyEvent: false,
  },
  {
    id: 'evt-4',
    timestamp: '14:16 UTC',
    type: 'detection',
    title: 'ConnectionPoolTimeoutError Pattern Isolated',
    description:
      '1,847 ConnectionPoolTimeoutError entries in checkout-svc ORM layer since 14:15:33 UTC. All errors originate from high-concurrency write operations failing to acquire pool connections.',
    source: 'Logs Agent',
    confidence: 89,
    isKeyEvent: false,
  },
  {
    id: 'evt-5',
    timestamp: '14:18 UTC',
    type: 'correlation',
    title: 'Deployment Correlated with Failure Onset',
    description:
      'v2.4.1 config diff shows pool_size reduced 20 → 10. Deployment at 14:12 UTC aligns within 3.5 minutes of incident onset. No prior incidents at pool_size=10 under current traffic volume.',
    source: 'Deployment Agent',
    confidence: 96,
    isKeyEvent: false,
  },
  {
    id: 'evt-6',
    timestamp: '14:20 UTC',
    type: 'correlation',
    title: 'Historical Baseline Anomaly Confirmed',
    description:
      '7-day baseline analysis: zero pool exhaustion incidents with pool_size=20 at equivalent traffic load. Pattern confirms v2.4.1 regression as the singular causal configuration change.',
    source: 'Time Machine Agent',
    confidence: 87,
    isKeyEvent: false,
  },
  {
    id: 'evt-7',
    timestamp: '14:21 UTC',
    type: 'root_cause',
    title: 'Root Cause Confirmed',
    description:
      'DB connection pool exhausted due to ORM pool_size regression in v2.4.1 deployment. Recommended action: rollback to v2.4.0 immediately or hotfix config to restore pool_size=20.',
    source: 'Commander Agent',
    confidence: 94,
    isKeyEvent: true,
  },
]
