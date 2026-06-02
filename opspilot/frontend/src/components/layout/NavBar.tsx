import React from 'react'
import {
  makeStyles,
  tokens,
  Avatar,
  Button,
  Tooltip,
  shorthands,
} from '@fluentui/react-components'
import { AlertRegular } from '@fluentui/react-icons'

interface NavBarProps {
  activePage: string
  pageLabels: Record<string, string>
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    height: '48px',
    paddingLeft: '14px',
    paddingRight: '14px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke1,
    gap: '0px',
    flexShrink: 0,
  },
  // ── Brand ─────────────────────────────────────────────────────────────────
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
    textDecoration: 'none',
  },
  brandHex: {
    width: '26px',
    height: '26px',
    minWidth: '26px',
    backgroundColor: tokens.colorBrandBackground,
    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
  },
  brandLabel: {
    fontSize: '15px',
    fontWeight: '700',
    color: tokens.colorNeutralForeground1,
    letterSpacing: '-0.2px',
    whiteSpace: 'nowrap',
  },
  // ── Separator ─────────────────────────────────────────────────────────────
  sep: {
    width: '1px',
    height: '18px',
    backgroundColor: tokens.colorNeutralStroke2,
    marginLeft: '14px',
    marginRight: '14px',
    flexShrink: 0,
  },
  // ── Page title ────────────────────────────────────────────────────────────
  pageTitle: {
    fontSize: '13px',
    fontWeight: '400',
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'nowrap',
  },
  // ── Spacer ────────────────────────────────────────────────────────────────
  spacer: {
    flex: '1',
  },
  // ── Right actions ─────────────────────────────────────────────────────────
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  statusPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    paddingLeft: '10px',
    paddingRight: '10px',
    paddingTop: '5px',
    paddingBottom: '5px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: '12px',
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
    marginRight: '6px',
    cursor: 'default',
  },
  statusDot: {
    width: '7px',
    height: '7px',
    minWidth: '7px',
    borderRadius: '50%',
    backgroundColor: '#3bba6e',
  },
  statusLabel: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'nowrap',
  },
  notifWrapper: {
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: '#c72b2b',
    pointerEvents: 'none',
  },
})

export const NavBar: React.FC<NavBarProps> = ({ activePage, pageLabels }) => {
  const styles = useStyles()
  const pageTitle = pageLabels[activePage] ?? activePage

  return (
    <header className={styles.root}>
      {/* Brand mark */}
      <div className={styles.brand}>
        <div className={styles.brandHex} />
        <span className={styles.brandLabel}>OpsPilot</span>
      </div>

      {/* Separator + page title */}
      <div className={styles.sep} />
      <span className={styles.pageTitle}>{pageTitle}</span>

      <div className={styles.spacer} />

      {/* Right actions */}
      <div className={styles.actions}>
        {/* System health pill */}
        <Tooltip content="All Azure services operational" relationship="description">
          <div className={styles.statusPill}>
            <div className={styles.statusDot} />
            <span className={styles.statusLabel}>All systems operational</span>
          </div>
        </Tooltip>

        {/* Notifications */}
        <Tooltip content="1 active alert" relationship="label">
          <div className={styles.notifWrapper}>
            <Button icon={<AlertRegular />} appearance="subtle" size="small" aria-label="Notifications" />
            <div className={styles.notifDot} />
          </div>
        </Tooltip>

        {/* User avatar */}
        <Avatar
          name="M K"
          size={28}
          color="brand"
          style={{ cursor: 'pointer', marginLeft: '4px' }}
        />
      </div>
    </header>
  )
}
