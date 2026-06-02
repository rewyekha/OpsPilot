export interface AffectedService {
  name: string
  status: 'critical' | 'degraded' | 'healthy'
}

export interface MockIncidentData {
  id: string
  title: string
  description: string
  severity: 'P0' | 'P1' | 'P2' | 'P3'
  severityLabel: string
  status: 'investigating' | 'mitigated' | 'resolved'
  statusLabel: string
  startedDisplay: string
  investigationDuration: string
  affectedServices: AffectedService[]
  confidence: number
  blastRadius: number
  affectedUsers: number
  errorRate: number
  businessImpactPerHour: number
}

export const MOCK_INCIDENT: MockIncidentData = {
  id: 'INC-2024-0847',
  title: 'Checkout Service Failure',
  description: 'DB connection pool exhausted — v2.4.1 ORM configuration regression',
  severity: 'P1',
  severityLabel: 'CRITICAL',
  status: 'investigating',
  statusLabel: 'Investigating',
  startedDisplay: 'Nov 29 · 14:18 UTC',
  investigationDuration: '00:04:32',
  affectedServices: [
    { name: 'checkout-svc', status: 'critical' },
    { name: 'payment-svc', status: 'degraded' },
    { name: 'order-svc',   status: 'degraded' },
  ],
  confidence: 87,
  blastRadius: 3,
  affectedUsers: 12000,
  errorRate: 62,
  businessImpactPerHour: 50400,
}
