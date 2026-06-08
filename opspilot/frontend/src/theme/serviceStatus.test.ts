import { describe, it, expect } from 'vitest'
import { deriveServiceStatus, STATUS_STYLE } from './serviceStatus'
import type { ApiServiceHealth } from '../api/services'

const svc = (status: ApiServiceHealth['status']): ApiServiceHealth => ({
  name: 'album-api', status, responseTimeMs: 0, errorRatePct: 0, lastIncident: null, source: 'azure',
})

describe('deriveServiceStatus (Task 3 — never UNKNOWN)', () => {
  it('healthy → HEALTHY', () => expect(deriveServiceStatus(svc('healthy'))).toBe('HEALTHY'))
  it('unknown → HEALTHY (idle but discovered, never UNKNOWN)', () =>
    expect(deriveServiceStatus(svc('unknown'))).toBe('HEALTHY'))
  it('degraded → WARNING', () => expect(deriveServiceStatus(svc('degraded'))).toBe('WARNING'))
  it('unhealthy → CRITICAL', () => expect(deriveServiceStatus(svc('unhealthy'))).toBe('CRITICAL'))

  it('active non-P1 incident → INVESTIGATING', () =>
    expect(deriveServiceStatus(svc('healthy'), { severity: 'P2' })).toBe('INVESTIGATING'))
  it('active P1 incident → CRITICAL', () =>
    expect(deriveServiceStatus(svc('healthy'), { severity: 'P1' })).toBe('CRITICAL'))

  it('every status has a colour style', () => {
    for (const k of ['HEALTHY', 'WARNING', 'CRITICAL', 'INVESTIGATING'] as const) {
      expect(STATUS_STYLE[k]).toBeDefined()
    }
  })
})
