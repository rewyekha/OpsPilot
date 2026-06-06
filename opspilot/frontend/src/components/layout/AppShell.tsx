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
import { ErrorBoundary } from '../shared/ErrorBoundary'
import { useNotify } from '../../store/NotificationContext'
import { usePreferences } from '../../store/PreferencesContext'

export const PAGE_LABELS: Record<string, string> = {
  home:      'Dashboard',
  incidents: 'Active Incidents',
  history:   'History',
  agents:    'Agents',
  analytics: 'Analytics',
  settings:  'Settings',
}

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
  // Bumping this remounts the active panel, which re-runs its data hooks —
  // i.e. a real refresh of agent statuses, confidence, and timeline.
  const [refreshNonce, setRefreshNonce] = useState(0)

  const handleRefresh = useCallback(() => {
    setRefreshNonce((n) => n + 1)
    notify({ title: 'Refreshing analysis', body: 'Re-running agent investigation…', intent: 'info' })
  }, [notify])

  // Auto-refresh: silently remount the active panel on the configured cadence
  // (Settings → General → Auto refresh interval). 0 = off.
  useEffect(() => {
    if (!autoRefreshSeconds) return
    const id = window.setInterval(() => setRefreshNonce((n) => n + 1), autoRefreshSeconds * 1000)
    return () => window.clearInterval(id)
  }, [autoRefreshSeconds])

  // Decoupled refresh trigger: any component can dispatch `opspilot:refresh`
  // (e.g. the incident actions menu's "Re-run Investigation") to remount the
  // active panel and re-run its data hooks.
  useEffect(() => {
    const onRefresh = () => handleRefresh()
    window.addEventListener('opspilot:refresh', onRefresh)
    return () => window.removeEventListener('opspilot:refresh', onRefresh)
  }, [handleRefresh])

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
          {/* key forces a remount on refresh so data hooks re-fetch.
              ErrorBoundary keeps a page crash from blanking the shell; it
              resets when the active page changes (resetKey). */}
          <div className={styles.pageContent} key={refreshNonce}>
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
