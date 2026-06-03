export type RiskLevel   = 'safe' | 'medium' | 'high' | 'critical'
export type ImpactLevel = 'low'  | 'medium' | 'high' | 'critical'

export interface RootCauseSummary {
  title: string
  description: string
  confidence: number
  incidentId: string
  affectedServices: string[]
  affectedUsers: number
  hourlyImpact: number
  blastRadius: number
}

export interface RecommendedAction {
  id: string
  type: 'rollback' | 'fix' | 'infrastructure'
  typeLabel: string
  title: string
  description: string
  steps: string[]
  risk: RiskLevel
  riskLabel: string
  impact: ImpactLevel
  impactLabel: string
  estimatedTime: string
  priority: number
}

export interface MockRecommendations {
  rootCause: RootCauseSummary
  actions: RecommendedAction[]
}

export const MOCK_RECOMMENDATIONS: MockRecommendations = {
  rootCause: {
    title: 'ORM Connection Pool Regression in v2.4.1',
    description:
      'DB connection pool exhausted due to pool_size config reduced from 20 to 10 in v2.4.1 ORM configuration. Deployment at 14:12 UTC directly caused checkout-svc failure at 14:15 UTC — 3.5 min onset gap confirms causal relationship.',
    confidence: 94,
    incidentId: 'INC-2024-0847',
    affectedServices: ['checkout-svc', 'payment-svc', 'order-svc'],
    affectedUsers: 12000,
    hourlyImpact: 50400,
    blastRadius: 3,
  },
  actions: [
    {
      id: 'action-1',
      type: 'rollback',
      typeLabel: 'Rollback',
      title: 'Rollback checkout-svc to v2.4.0',
      description:
        'Immediately roll back checkout-svc to v2.4.0 to restore service stability. Fastest recovery path with lowest risk — no new configuration changes required.',
      steps: [
        'Trigger rollback to v2.4.0 via CI/CD pipeline',
        'Monitor error rate and connection pool metrics',
        'Confirm recovery: error rate < 1%, pool utilization < 70%',
        'Open post-incident review and page on-call team',
      ],
      risk: 'safe',
      riskLabel: 'Safe',
      impact: 'high',
      impactLabel: 'High Impact',
      estimatedTime: '~5 min',
      priority: 1,
    },
    {
      id: 'action-2',
      type: 'fix',
      typeLabel: 'Hotfix',
      title: 'Patch ORM pool_size Configuration',
      description:
        'Correct the v2.4.1 ORM config by restoring pool_size=20. Resolves the regression without rolling back new features. Requires a patch deployment as v2.4.2.',
      steps: [
        'Update ormconfig.json: set pool_size back to 20',
        'Validate config against staging environment',
        'Deploy patch release as v2.4.2 hotfix',
        'Confirm pool utilization drops below 70%',
      ],
      risk: 'medium',
      riskLabel: 'Medium Risk',
      impact: 'high',
      impactLabel: 'High Impact',
      estimatedTime: '~15 min',
      priority: 2,
    },
    {
      id: 'action-3',
      type: 'infrastructure',
      typeLabel: 'Infrastructure',
      title: 'Scale DB Connection Pool Capacity',
      description:
        'Increase DB connection pool beyond 20 to handle peak concurrent traffic. Long-term infrastructure change to prevent future pool exhaustion under high load.',
      steps: [
        'Profile peak concurrent DB connections under traffic load',
        'Calculate optimal pool_size for P99 traffic volume',
        'Update infrastructure config and apply via Terraform',
        'Add connection pool saturation monitoring and alert',
      ],
      risk: 'medium',
      riskLabel: 'Medium Risk',
      impact: 'low',
      impactLabel: 'Low Impact',
      estimatedTime: '~30 min',
      priority: 3,
    },
  ],
}
