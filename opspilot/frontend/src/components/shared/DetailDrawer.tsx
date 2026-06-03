/**
 * DetailDrawer — the canonical right-side drill-down surface.
 *
 * This is the reusable primitive behind every "click a row → inspect details"
 * interaction in the console (agent findings, recommendation execution plans,
 * timeline events, agent investigations). It wraps Fluent's OverlayDrawer with
 * a consistent header (title + optional subtitle + close button) and a padded,
 * scrollable body — so individual surfaces only supply content.
 *
 * Progressive disclosure: summary lives in the list/table; depth lives here.
 */
import React from 'react'
import {
  makeStyles,
  tokens,
  Button,
  OverlayDrawer,
  DrawerHeader,
  DrawerHeaderTitle,
  DrawerBody,
} from '@fluentui/react-components'
import { DismissRegular } from '@fluentui/react-icons'

const useStyles = makeStyles({
  drawer: {
    backgroundColor: tokens.colorNeutralBackground2,
  },
  header: {
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  subtitle: {
    fontSize: '12px',
    fontWeight: 400,
    color: tokens.colorNeutralForeground3,
    marginTop: '2px',
    fontFamily: '"Cascadia Code", "Consolas", monospace',
  },
  body: {
    paddingTop: '16px',
    paddingBottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
})

export interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Optional element rendered at the right of the header (e.g. a status badge). */
  headerAction?: React.ReactNode
  size?: 'small' | 'medium' | 'large'
  children: React.ReactNode
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  open,
  onClose,
  title,
  subtitle,
  headerAction,
  size = 'medium',
  children,
}) => {
  const s = useStyles()
  return (
    <OverlayDrawer
      open={open}
      onOpenChange={(_, { open: next }) => {
        if (!next) onClose()
      }}
      position="end"
      size={size}
      className={s.drawer}
    >
      <DrawerHeader className={s.header}>
        <DrawerHeaderTitle
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {headerAction}
              <Button
                appearance="subtle"
                aria-label="Close panel"
                icon={<DismissRegular />}
                onClick={onClose}
              />
            </div>
          }
        >
          <div>
            <div>{title}</div>
            {subtitle != null && <div className={s.subtitle}>{subtitle}</div>}
          </div>
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody className={s.body}>{children}</DrawerBody>
    </OverlayDrawer>
  )
}

// ── Small layout helpers shared by drawer content ────────────────────────────

const useSectionStyles = makeStyles({
  section: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    color: tokens.colorNeutralForeground3,
  },
  evidenceList: {
    listStyleType: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  evidenceItem: {
    display: 'flex',
    gap: '8px',
    fontSize: '13px',
    color: tokens.colorNeutralForeground2,
    lineHeight: '1.5',
  },
  bullet: { color: tokens.colorBrandForeground1, flexShrink: 0 },
  raw: {
    margin: 0,
    padding: '12px',
    borderRadius: '6px',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    fontSize: '12px',
    fontFamily: '"Cascadia Code", "Consolas", monospace',
    color: tokens.colorNeutralForeground2,
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
  },
})

export const DrawerSection: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => {
  const s = useSectionStyles()
  return (
    <section className={s.section}>
      <span className={s.label}>{label}</span>
      {children}
    </section>
  )
}

export const EvidenceList: React.FC<{ items: string[] }> = ({ items }) => {
  const s = useSectionStyles()
  if (!items.length) return null
  return (
    <ul className={s.evidenceList}>
      {items.map((item, i) => (
        <li key={i} className={s.evidenceItem}>
          <span className={s.bullet}>▸</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export const RawJson: React.FC<{ value: unknown }> = ({ value }) => {
  const s = useSectionStyles()
  return <pre className={s.raw}>{JSON.stringify(value, null, 2)}</pre>
}
