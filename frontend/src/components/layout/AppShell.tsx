import React, { useCallback, useEffect, useState } from 'react'
import { makeStyles, tokens, Button } from '@fluentui/react-components'
import { HomeRegular } from '@fluentui/react-icons'
import { NavBar } from './NavBar'
import { SideNav } from './SideNav'
import { GlobalCommandBar } from '../command/GlobalCommandBar'
import { IncidentPanel } from '../incident/IncidentPanel'
import { AgentsPanel } from '../agents/AgentsPanel'
import { HistoryPanel } from '../history/HistoryPanel'
import { RecommendationPanel } from '../recommendations/RecommendationPanel'
import { AnalyticsPanel } from '../analytics/AnalyticsPanel'
import { SettingsPanel } from '../settings/SettingsPanel'
import { DemoScenariosPanel } from '../demo/DemoScenariosPanel'
import { ErrorBoundary } from '../shared/ErrorBoundary'
import { useNotify } from '../../store/NotificationContext'
import { usePreferences } from '../../store/PreferencesContext'

export const PAGE_LABELS: Record<string, string> = {
  home:      'Dashboard',
  incidents: 'Active Incidents',
  history:   'History',
  agents:    'Agents',
  analytics: 'Analytics',
  demo:      'Demo Scenarios',
  settings:  'Settings',
}

// Silent autonomous-update cadence: dispatches `opspilot:poll` so data hooks
// re-fetch (no remount / no toast). This poll ONLY surfaces slow-changing data —
// newly auto-detected incidents, monitor status, demo-scenario status. The ACTIVE
// investigation updates in real time over SSE (useLiveInvestigation), independent
// of this interval, so 15s keeps the dashboard live while cutting backend/Azure
// load (and the per-service KQL the /active poll drives) ~3× versus the old 5s.
const POLL_INTERVAL_MS = 15000

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'hidden',
  },
  topBar: {
    flexShrink: 0,
  },
  body: {
    display: 'flex',
    flex: '1',
    overflow: 'hidden',
  },
  main: {
    flex: '1',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    background: 'radial-gradient(ellipse at 50% 35%, #0f2244 0%, #0a1628 65%)',
  },
  pageContent: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1',
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '1',
    gap: '10px',
    paddingBottom: '80px',
  },
  hexMark: {
    width: '60px',
    height: '60px',
    backgroundColor: tokens.colorBrandBackground,
    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
    marginBottom: '12px',
    opacity: '0.22',
  },
  pageTitle: {
    color: tokens.colorNeutralForeground1,
    fontSize: '20px',
    fontWeight: '600',
    letterSpacing: '-0.3px',
    margin: '0',
  },
  pageSubtitle: {
    color: tokens.colorNeutralForeground3,
    fontSize: '13px',
    margin: '0',
  },
})

export const AppShell: React.FC = () => {
  const styles = useStyles()
  const notify = useNotify()
  const [isNavCollapsed, setIsNavCollapsed] = useState(false)
  const [activePage, setActivePage] = useState('home')
  const { autoRefreshSeconds } = usePreferences()

  // BACKGROUND refresh — no remount, no full-page spinner. The data hooks all
  // listen for `opspilot:refresh` / `opspilot:poll` and refetch in place (SWR:
  // they keep the current view and swap in fresh data when it arrives). Previously
  // this bumped a `key` to REMOUNT the active panel, which re-entered every hook's
  // loading state and flashed a full-dashboard spinner on each refresh.
  const handleRefresh = useCallback(() => {
    window.dispatchEvent(new Event('opspilot:refresh'))
    notify({ title: 'Refreshing', body: 'Updating dashboard…', intent: 'info' })
  }, [notify])

  // Auto-refresh (Settings → General → Auto refresh interval; 0 = off). Silent
  // background poll on the configured cadence — never a remount.
  useEffect(() => {
    if (!autoRefreshSeconds) return
    const id = window.setInterval(() => window.dispatchEvent(new Event('opspilot:poll')), autoRefreshSeconds * 1000)
    return () => window.clearInterval(id)
  }, [autoRefreshSeconds])

  // Autonomous real-time updates: a silent periodic poll so the dashboard,
  // active incidents, history, analytics and agents reflect monitor-created
  // investigations without a manual refresh. Distinct from the heavy remount
  // refresh above — this only re-runs data hooks.
  useEffect(() => {
    const id = window.setInterval(() => window.dispatchEvent(new Event('opspilot:poll')), POLL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [])

  // Decoupled navigation: `opspilot:navigate` with detail `{ page }`.
  useEffect(() => {
    const onNav = (e: Event) => {
      const page = (e as CustomEvent<{ page: string }>).detail?.page
      if (page) setActivePage(page)
    }
    window.addEventListener('opspilot:navigate', onNav)
    return () => window.removeEventListener('opspilot:navigate', onNav)
  }, [])

  return (
    <div className={styles.root}>
      <div className={styles.topBar}>
        <NavBar activePage={activePage} pageLabels={PAGE_LABELS} />
        <GlobalCommandBar onNavigate={setActivePage} onRefresh={handleRefresh} />
      </div>
      <div className={styles.body}>
        <SideNav
          isCollapsed={isNavCollapsed}
          onToggleCollapse={() => setIsNavCollapsed((v) => !v)}
          activePage={activePage}
          onNavigate={setActivePage}
        />
        <main className={styles.main}>
          {/* No remount-on-refresh: data hooks refetch in place (SWR) so refresh
              never blanks the page. ErrorBoundary keeps a page crash from blanking
              the shell; it resets when the active page changes (resetKey). */}
          <div className={styles.pageContent}>
            <ErrorBoundary resetKey={activePage}>
              {activePage === 'incidents'
                ? <IncidentPanel />
                : activePage === 'agents'
                  ? <AgentsPanel />
                  : activePage === 'history'
                    ? <HistoryPanel />
                    : activePage === 'analytics'
                      ? <AnalyticsPanel />
                      : activePage === 'settings'
                        ? <SettingsPanel />
                        : activePage === 'demo'
                          ? <DemoScenariosPanel />
                          : activePage === 'home'
                            ? <RecommendationPanel />
                            : <PagePlaceholder
                              label={PAGE_LABELS[activePage] ?? activePage}
                              onNavigate={setActivePage}
                            />
              }
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  )
}

const PagePlaceholder: React.FC<{ label: string; onNavigate: (page: string) => void }> = ({
  label,
  onNavigate,
}) => {
  const styles = useStyles()
  return (
    <div className={styles.placeholder}>
      <div className={styles.hexMark} />
      <p className={styles.pageTitle}>{label}</p>
      <p className={styles.pageSubtitle}>This workspace isn’t available right now.</p>
      <Button
        icon={<HomeRegular />}
        appearance="primary"
        size="medium"
        style={{ marginTop: '12px' }}
        onClick={() => onNavigate('home')}
      >
        Back to Dashboard
      </Button>
    </div>
  )
}
