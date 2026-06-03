import React, { useState } from 'react'
import {
  makeStyles,
  tokens,
  Avatar,
  Button,
  Tooltip,
  shorthands,
  Popover,
  PopoverTrigger,
  PopoverSurface,
  mergeClasses,
} from '@fluentui/react-components'
import { AlertRegular, CheckmarkCircleRegular } from '@fluentui/react-icons'

// ── Types & mock data ─────────────────────────────────────────────────────────────

type Severity = 'critical' | 'warning' | 'info' | 'success'

interface Notification {
  id: string
  timestamp: string
  severity: Severity
  message: string
  read: boolean
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: 'n1', timestamp: '2 min ago',  severity: 'critical', read: false, message: 'Checkout service P1 incident detected – ORM connection pool exhausted in deployment v2.4.1.' },
  { id: 'n2', timestamp: '8 min ago',  severity: 'warning',  read: false, message: 'Deployment agent flagged v2.4.1 rollout as high-risk based on historical failure patterns.' },
  { id: 'n3', timestamp: '12 min ago', severity: 'info',     read: true,  message: '5 autonomous agents dispatched for INC-2024-0847 root cause investigation.' },
  { id: 'n4', timestamp: '15 min ago', severity: 'success',  read: false, message: 'Root cause confirmed with 94% confidence – ORM regression isolated to deployment v2.4.1.' },
  { id: 'n5', timestamp: '18 min ago', severity: 'info',     read: true,  message: 'Business impact estimated at $50,400/hr – escalation team notified via PagerDuty.' },
]

const SEV_CFG: Record<Severity, { label: string; bg: string; border: string; text: string }> = {
  critical: { label: 'CRITICAL', bg: 'rgba(220, 38, 38, 0.12)',  border: 'rgba(220, 38, 38, 0.35)', text: '#f87171' },
  warning:  { label: 'WARNING',  bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.35)', text: '#fbbf24' },
  info:     { label: 'INFO',     bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.35)', text: '#60a5fa' },
  success:  { label: 'SUCCESS',  bg: 'rgba(34, 197, 94, 0.12)',  border: 'rgba(34, 197, 94, 0.35)',  text: '#4ade80' },
}

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
  // ── Bell + count badge ──────────────────────────────────────────────
  bellWrap: {
    position: 'relative',
    display: 'inline-flex',
  },
  countBadge: {
    position: 'absolute',
    top: '1px',
    right: '1px',
    minWidth: '16px',
    height: '16px',
    borderRadius: '8px',
    backgroundColor: '#dc2626',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '9px',
    fontWeight: '700',
    color: '#ffffff',
    paddingLeft: '3px',
    paddingRight: '3px',
    pointerEvents: 'none',
    zIndex: 1,
  },
  // ── Popover surface (width/layout; critical overrides via inline style) ─────
  popoverSurface: {
    width: '380px',
    maxHeight: '540px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  // ── Popover header ───────────────────────────────────────────────────
  popHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: '16px',
    paddingRight: '10px',
    paddingTop: '12px',
    paddingBottom: '12px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke1,
    flexShrink: 0,
  },
  popHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  popTitle: {
    fontSize: '11px',
    fontWeight: '700',
    color: tokens.colorNeutralForeground1,
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
  },
  unreadPill: {
    display: 'inline-flex',
    alignItems: 'center',
    paddingLeft: '7px',
    paddingRight: '7px',
    height: '18px',
    borderRadius: '9px',
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    ...shorthands.border('1px', 'solid', 'rgba(220, 38, 38, 0.35)'),
    fontSize: '10px',
    fontWeight: '700',
    color: '#f87171',
  },
  // ── Notification list & rows ───────────────────────────────────────
  notifList: {
    overflowY: 'auto',
    flex: '1',
  },
  notifRow: {
    position: 'relative',
    paddingLeft: '20px',
    paddingRight: '16px',
    paddingTop: '12px',
    paddingBottom: '12px',
    cursor: 'pointer',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke1,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  notifRowUnread: {
    backgroundColor: 'rgba(59, 130, 246, 0.04)',
  },
  unreadAccent: {
    position: 'absolute',
    top: '0',
    left: '0',
    bottom: '0',
    width: '3px',
    backgroundColor: '#3b82f6',
  },
  notifMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  },
  sevBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    paddingLeft: '7px',
    paddingRight: '7px',
    height: '18px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.5px',
    flexShrink: 0,
  },
  notifTime: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
    marginLeft: 'auto',
    flexShrink: 0,
    fontFamily: '"Cascadia Code", "Consolas", monospace',
  },
  notifMsg: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
    lineHeight: '1.5',
  },
  notifMsgRead: {
    color: tokens.colorNeutralForeground3,
  },
})

export const NavBar: React.FC<NavBarProps> = ({ activePage, pageLabels }) => {
  const s = useStyles()
  const [notifs, setNotifs] = useState<Notification[]>(INITIAL_NOTIFICATIONS)
  const [open, setOpen] = useState(false)

  const unreadCount = notifs.filter((n) => !n.read).length

  const markRead = (id: string) =>
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))

  const markAllRead = () =>
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))

  const pageTitle = pageLabels[activePage] ?? activePage

  return (
    <header className={s.root}>
      {/* Brand mark */}
      <div className={s.brand}>
        <div className={s.brandHex} />
        <span className={s.brandLabel}>OpsPilot</span>
      </div>

      {/* Separator + page title */}
      <div className={s.sep} />
      <span className={s.pageTitle}>{pageTitle}</span>

      <div className={s.spacer} />

      {/* Right actions */}
      <div className={s.actions}>
        {/* System health pill */}
        <Tooltip content="All Azure services operational" relationship="description">
          <div className={s.statusPill}>
            <div className={s.statusDot} />
            <span className={s.statusLabel}>All systems operational</span>
          </div>
        </Tooltip>

        {/* Bell + notification popover */}
        <div className={s.bellWrap}>
          <Popover
            open={open}
            onOpenChange={(_, d) => setOpen(d.open)}
            positioning="below-end"
          >
            <PopoverTrigger>
              <Button
                icon={<AlertRegular />}
                appearance="subtle"
                size="small"
                aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
              />
            </PopoverTrigger>

            <PopoverSurface
              className={s.popoverSurface}
              style={{
                padding: 0,
                backgroundColor: tokens.colorNeutralBackground2,
                border: `1px solid ${tokens.colorNeutralStroke1}`,
                borderRadius: '8px',
                boxShadow: '0 16px 48px rgba(0, 0, 0, 0.55)',
              }}
            >
              {/* Header */}
              <div className={s.popHeader}>
                <div className={s.popHeaderLeft}>
                  <span className={s.popTitle}>Notifications</span>
                  {unreadCount > 0 && (
                    <div className={s.unreadPill}>{unreadCount} unread</div>
                  )}
                </div>
                {unreadCount > 0 && (
                  <Button
                    icon={<CheckmarkCircleRegular />}
                    appearance="subtle"
                    size="small"
                    onClick={markAllRead}
                  >
                    Mark all read
                  </Button>
                )}
              </div>

              {/* Notification rows */}
              <div className={s.notifList}>
                {notifs.map((n) => {
                  const sev = SEV_CFG[n.severity]
                  return (
                    <div
                      key={n.id}
                      className={mergeClasses(s.notifRow, !n.read && s.notifRowUnread)}
                      onClick={() => markRead(n.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') markRead(n.id)
                      }}
                    >
                      {!n.read && <div className={s.unreadAccent} />}
                      <div className={s.notifMeta}>
                        <div
                          className={s.sevBadge}
                          style={{
                            backgroundColor: sev.bg,
                            border: `1px solid ${sev.border}`,
                            color: sev.text,
                          }}
                        >
                          {sev.label}
                        </div>
                        <span className={s.notifTime}>{n.timestamp}</span>
                      </div>
                      <span className={mergeClasses(s.notifMsg, n.read && s.notifMsgRead)}>
                        {n.message}
                      </span>
                    </div>
                  )
                })}
              </div>
            </PopoverSurface>
          </Popover>

          {/* Count badge overlays the bell button */}
          {unreadCount > 0 && (
            <div className={s.countBadge} aria-hidden="true">
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </div>

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
