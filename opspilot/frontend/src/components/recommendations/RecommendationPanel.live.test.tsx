/**
 * Live-proof: feed the REAL SSE events captured from a live Azure Foundry run
 * (./__fixtures__/liveEvents.json, with forced sentinel values) into the actual
 * RecommendationPanel and assert the *rendered DOM* shows them.
 *
 * Critically, all events are delivered in ONE render (the worst-case batched
 * delivery that the old single-`lastEvent` hook dropped). The events-log fold
 * applies every event, so findings/root-cause/recommendations all render.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { FluentProvider } from '@fluentui/react-components'
import { opsPilotDarkTheme } from '../../theme/darkTheme'
import { PreferencesProvider } from '../../store/PreferencesContext'
import { NotificationProvider } from '../../store/NotificationContext'
import { SessionProvider } from '../../store/SessionContext'
import liveEvents from './__fixtures__/liveEvents.json'

const h = vi.hoisted(() => ({ events: [] as unknown[] }))

vi.mock('../../hooks/useIncidentStream', () => ({
  useIncidentStream: () => ({
    status: 'connected',
    lastEvent: h.events.length ? h.events[h.events.length - 1] : null,
    events: h.events,
  }),
}))
vi.mock('../../hooks/useIncident', () => ({
  useActiveIncidentWithRecommendations: () => ({
    data: {
      incident: {
        id: 'INC-2024-0847',
        description: '',
        status: 'investigating',
        severity: 'P1',
        affected_services: [],
        reporter: '',
        created_at: '2026-06-03T12:23:00Z',
        updated_at: '',
        resolved_at: null,
        langgraph_run_id: null,
        error_rate_pct: null,
      },
      recommendations: null,
    },
    loading: false,
    error: null,
  }),
}))

import { RecommendationPanel } from './RecommendationPanel'

const Wrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <FluentProvider theme={opsPilotDarkTheme}>
    <PreferencesProvider>
      <NotificationProvider>
        <SessionProvider>{children}</SessionProvider>
      </NotificationProvider>
    </PreferencesProvider>
  </FluentProvider>
)

beforeEach(() => {
  h.events = []
})

describe('Dashboard renders LIVE Azure investigation output', () => {
  it('is empty/waiting first, then shows the forced live values after a batched delivery', async () => {
    const { rerender } = render(
      <Wrap>
        <RecommendationPanel />
      </Wrap>,
    )

    // BEFORE events: honest waiting, no fabricated values.
    expect(screen.getByText(/Waiting for investigation|Connecting to investigation/)).toBeTruthy()
    expect(screen.getByText(/No recommendations yet/)).toBeTruthy()

    // Deliver ALL events in ONE render — the batched case the old hook dropped.
    h.events = liveEvents as unknown[]
    await act(async () => {
      rerender(
        <Wrap>
          <RecommendationPanel />
        </Wrap>,
      )
    })

    // PHASE 9 — root cause KPIs (forced 97 / 5 / 12,345)
    expect(screen.getAllByText('97%').length).toBeGreaterThan(0)
    expect(screen.getByText(/5 svc/)).toBeTruthy()
    expect(screen.getByText(/\$12,345/)).toBeTruthy()

    // PHASE 8 — recommendation card from the live RecommendationAgent
    expect(screen.getByText('LIVE_RECOMMENDATION_TEST')).toBeTruthy()
    expect(screen.queryByText(/Roll Back to v2\.4\.0/)).toBeNull() // no mock

    // PHASE 7 — Commander's live finding text, shown in the drawer
    fireEvent.click(screen.getAllByText('Commander')[0])
    expect(screen.getAllByText(/COMMANDER_LIVE_TEST_2026/).length).toBeGreaterThan(0)
  })
})
