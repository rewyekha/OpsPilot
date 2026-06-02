import React, { useState } from 'react'
import { makeStyles, tokens, Button } from '@fluentui/react-components'
import { AddRegular } from '@fluentui/react-icons'
import { NavBar } from './NavBar'
import { SideNav } from './SideNav'
import { IncidentPanel } from '../incident/IncidentPanel'
import { AgentActivityPanel } from '../agents/AgentActivityPanel'

export const PAGE_LABELS: Record<string, string> = {
  home:      'Dashboard',
  incidents: 'Active Incidents',
  history:   'History',
  agents:    'Agents',
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
  const [isNavCollapsed, setIsNavCollapsed] = useState(false)
  const [activePage, setActivePage] = useState('incidents')

  return (
    <div className={styles.root}>
      <div className={styles.topBar}>
        <NavBar activePage={activePage} pageLabels={PAGE_LABELS} />
      </div>
      <div className={styles.body}>
        <SideNav
          isCollapsed={isNavCollapsed}
          onToggleCollapse={() => setIsNavCollapsed((v) => !v)}
          activePage={activePage}
          onNavigate={setActivePage}
        />
        <main className={styles.main}>
          {activePage === 'incidents'
            ? <IncidentPanel />
            : activePage === 'agents'
              ? <AgentActivityPanel />
              : <PagePlaceholder label={PAGE_LABELS[activePage] ?? activePage} />
          }
        </main>
      </div>
    </div>
  )
}

// Sprint 2: replace with real page components
const PagePlaceholder: React.FC<{ label: string }> = ({ label }) => {
  const styles = useStyles()
  return (
    <div className={styles.placeholder}>
      <div className={styles.hexMark} />
      <p className={styles.pageTitle}>{label}</p>
      <p className={styles.pageSubtitle}>Feature panels activate in Sprint 2</p>
      <Button
        icon={<AddRegular />}
        appearance="primary"
        size="medium"
        style={{ marginTop: '12px' }}
      >
        New Investigation
      </Button>
    </div>
  )
}
