/**
 * EmptyState — a single, production-ready empty/zero-data surface used across
 * History, Agents, Analytics, Settings and the Dashboard. Replaces the ad-hoc
 * "nothing here" strings so every empty page looks intentional and consistent.
 */
import React from 'react'
import { makeStyles, tokens, Button } from '@fluentui/react-components'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: '6px',
    padding: '48px 24px',
    minHeight: '220px',
  },
  icon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    marginBottom: '8px',
    borderRadius: '12px',
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground3,
    fontSize: '24px',
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: tokens.colorNeutralForeground1,
  },
  body: {
    fontSize: '13px',
    lineHeight: 1.5,
    maxWidth: '420px',
    color: tokens.colorNeutralForeground3,
    whiteSpace: 'pre-line',
  },
  actions: { marginTop: '14px', display: 'flex', gap: '8px' },
})

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  body?: string
  actionLabel?: string
  onAction?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}) => {
  const s = useStyles()
  return (
    <div className={s.root} role="status">
      {icon && <div className={s.icon}>{icon}</div>}
      <div className={s.title}>{title}</div>
      {body && <div className={s.body}>{body}</div>}
      {(actionLabel || secondaryLabel) && (
        <div className={s.actions}>
          {actionLabel && onAction && (
            <Button appearance="primary" size="small" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryLabel && onSecondary && (
            <Button appearance="secondary" size="small" onClick={onSecondary}>
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
