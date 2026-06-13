/**
 * Regression guard for "dashboard visibly reloads during polling".
 *
 * Reproduces the dashboard's loading gate (RecommendationPanel:
 *   `if (latest.loading) return <Spinner/>` else the content subtree)
 * and proves that the silent `opspilot:poll` does NOT re-enter the loading
 * state and therefore does NOT unmount/remount the content — even in the
 * EMPTY state where insightsApi.latest() resolves `null`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import React, { useEffect } from 'react'

// Empty state: latest() resolves null (no investigations) — the exact trigger.
vi.mock('../api/insights', () => ({
  insightsApi: {
    latest: vi.fn().mockResolvedValue(null),
    investigations: vi.fn().mockResolvedValue([]),
    analytics: vi.fn().mockResolvedValue({ has_data: false }),
    agentStats: vi.fn().mockResolvedValue([]),
  },
}))

import { useLatestInvestigation } from './useInsights'

let contentMounts = 0
const Content: React.FC = () => {
  useEffect(() => { contentMounts += 1 }, [])
  return <div data-testid="content" />
}

// Mirror of RecommendationPanel's render gate.
const DashboardLike: React.FC = () => {
  const latest = useLatestInvestigation()
  if (latest.loading) return <div data-testid="spinner" />
  return <Content />
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

describe('dashboard polling is background-only (no remount)', () => {
  beforeEach(() => { contentMounts = 0 })

  it('empty state (latest=null): opspilot:poll never re-enters loading or remounts content', async () => {
    render(<DashboardLike />)
    await waitFor(() => expect(screen.queryByTestId('content')).not.toBeNull())
    expect(contentMounts).toBe(1) // mounted once after the first load

    for (let i = 0; i < 5; i++) {
      act(() => { window.dispatchEvent(new Event('opspilot:poll')) })
      await flush()
    }

    expect(screen.queryByTestId('spinner')).toBeNull() // spinner never flashed
    expect(contentMounts).toBe(1) // content NEVER remounted across 5 polls
  })
})
