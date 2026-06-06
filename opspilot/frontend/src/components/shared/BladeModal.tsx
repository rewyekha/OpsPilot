/**
 * BladeModal — the single centered modal "blade" used across OpsPilot for the
 * Azure Portal / Grafana-inspect interaction model.
 *
 * Each major card exposes ONE "Open …" primary action that launches a BladeModal.
 * The modal — never a full page, never a side drawer — holds the detail content
 * (Details / Findings / Evidence / Timeline) and ALL the actions for that entity
 * in a sticky footer. This keeps the dashboard clean and executive-friendly:
 * buttons only appear once a user opens a blade.
 *
 * Built on Fluent's modal Dialog (backdrop + focus trap + Esc-to-close).
 * Compose body content with <BladeSection> and footer actions via `actions`.
 */
import React from 'react'
import {
  Dialog,
  DialogSurface,
  makeStyles,
  tokens,
  Button,
} from '@fluentui/react-components'
import { DismissRegular } from '@fluentui/react-icons'

const useStyles = makeStyles({
  surface: {
    padding: 0,
    width: '720px',
    maxWidth: '94vw',
    maxHeight: '88vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: '10px',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '18px 20px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    flexShrink: 0,
  },
  headText: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 },
  titleRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  title: { fontSize: '17px', fontWeight: 700, color: tokens.colorNeutralForeground1, letterSpacing: '-0.3px', margin: 0 },
  subtitle: { fontSize: '12px', color: tokens.colorNeutralForeground3, fontFamily: '"Cascadia Code","Consolas",monospace' },
  body: {
    padding: '4px 20px 16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    padding: '14px 20px',
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    flexShrink: 0,
  },
  footerLabel: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    color: tokens.colorNeutralForeground4,
    marginRight: '4px',
  },
  // BladeSection
  section: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, ':last-child': { borderBottom: 'none' } },
  sectionLabel: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: tokens.colorNeutralForeground3 },
})

export interface BladeModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** Optional badge/chip shown next to the title (e.g. a status). */
  headerBadge?: React.ReactNode
  /** Footer action buttons — the ONLY place entity actions live. */
  actions?: React.ReactNode
  children: React.ReactNode
}

export const BladeModal: React.FC<BladeModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  headerBadge,
  actions,
  children,
}) => {
  const s = useStyles()
  return (
    <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) onClose() }} modalType="modal">
      <DialogSurface className={s.surface}>
        <div className={s.header}>
          <div className={s.headText}>
            <div className={s.titleRow}>
              <h2 className={s.title}>{title}</h2>
              {headerBadge}
            </div>
            {subtitle && <span className={s.subtitle}>{subtitle}</span>}
          </div>
          <Button appearance="subtle" icon={<DismissRegular />} aria-label="Close" onClick={onClose} />
        </div>

        <div className={s.body}>{children}</div>

        {actions && (
          <div className={s.footer}>
            <span className={s.footerLabel}>Actions</span>
            {actions}
          </div>
        )}
      </DialogSurface>
    </Dialog>
  )
}

export const BladeSection: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const s = useStyles()
  return (
    <div className={s.section}>
      <span className={s.sectionLabel}>{label}</span>
      {children}
    </div>
  )
}
