/**
 * RecommendationDrawer — execution detail for a single remediation action.
 *
 * Opened by clicking a compact recommendation tile on the dashboard. The tile
 * shows title + risk; this drawer holds the full operational playbook so the
 * dashboard stays scannable.
 *
 * Execution-plan steps come straight from the backend action. Validation and
 * rollback are rendered as first-class sections; when the backend hasn't yet
 * supplied them they degrade to an explicit "not specified" note rather than
 * fabricating steps.
 */
import React, { useState } from 'react'
import { makeStyles, tokens, Button } from '@fluentui/react-components'
import { CheckmarkCircleRegular } from '@fluentui/react-icons'
import type { ApiRecommendedAction } from '../../api/recommendations'
import { DetailDrawer, DrawerSection } from '../shared/DetailDrawer'
import { RiskBadge, ImpactBadge } from '../shared/SeverityBadge'
import { ConfirmActionDialog } from '../actions/ConfirmActionDialog'
import { ActionStatusBadge } from '../actions/ActionStatusBadge'
import { useSession } from '../../store/SessionContext'

const useStyles = makeStyles({
  desc: { fontSize: '13px', color: tokens.colorNeutralForeground2, lineHeight: '1.6', margin: 0 },
  badges: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  meta: { fontSize: '12px', color: tokens.colorNeutralForeground3, fontFamily: '"Cascadia Code", "Consolas", monospace' },
  steps: {
    listStyleType: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    counterReset: 'step',
  },
  step: {
    display: 'flex',
    gap: '10px',
    fontSize: '13px',
    color: tokens.colorNeutralForeground2,
    lineHeight: '1.5',
  },
  stepNum: {
    flexShrink: 0,
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: tokens.colorNeutralBackground4,
    color: tokens.colorNeutralForeground1,
    fontSize: '11px',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: { fontSize: '12px', color: tokens.colorNeutralForeground4, margin: 0, fontStyle: 'italic' },
  ctaRow: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  cta: { flexShrink: 0 },
})

const CTA_LABEL: Record<string, string> = {
  rollback: 'Execute Rollback',
  fix: 'Apply Hotfix',
  infrastructure: 'Provision Infrastructure',
}

export interface RecommendationDrawerProps {
  action: ApiRecommendedAction | null
  open: boolean
  onClose: () => void
}

export const RecommendationDrawer: React.FC<RecommendationDrawerProps> = ({
  action,
  open,
  onClose,
}) => {
  const s = useStyles()
  const { jobs, submitActionJob } = useSession()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const job = action ? jobs[action.id] : undefined
  const inFlight = job?.status === 'submitting' || job?.status === 'running'
  const succeeded = job?.status === 'succeeded'

  const ctaLabel = succeeded
    ? 'Executed'
    : inFlight
      ? 'Executing…'
      : action
        ? CTA_LABEL[action.type] ?? 'Execute Action'
        : 'Execute'

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={action?.title ?? 'Recommendation'}
      subtitle={action ? `${action.type_label} · Priority ${action.priority}` : undefined}
      headerAction={action && <RiskBadge risk={action.risk} label={action.risk_label} />}
    >
      {action && (
        <>
          <DrawerSection label="Description">
            <p className={s.desc}>{action.description}</p>
          </DrawerSection>

          <DrawerSection label="Risk & Impact">
            <div className={s.badges}>
              <RiskBadge risk={action.risk} label={action.risk_label} />
              <ImpactBadge impact={action.impact} label={action.impact_label} />
              <span className={s.meta}>ETA {action.estimated_time}</span>
            </div>
          </DrawerSection>

          <DrawerSection label="Execution Plan">
            {action.steps.length ? (
              <ol className={s.steps}>
                {action.steps.map((step, i) => (
                  <li key={i} className={s.step}>
                    <span className={s.stepNum}>{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={s.muted}>No execution steps provided.</p>
            )}
          </DrawerSection>

          <DrawerSection label="Validation Steps">
            <p className={s.muted}>
              Not specified by the backend for this action — extend the recommendation schema with a
              `validation` field to populate.
            </p>
          </DrawerSection>

          <DrawerSection label="Rollback Plan">
            <p className={s.muted}>
              {action.type === 'rollback'
                ? 'This action is itself the rollback path.'
                : 'Not specified by the backend for this action.'}
            </p>
          </DrawerSection>

          <div className={s.ctaRow}>
            <Button
              className={s.cta}
              appearance="primary"
              disabled={inFlight || succeeded}
              icon={succeeded ? <CheckmarkCircleRegular /> : undefined}
              onClick={() => setConfirmOpen(true)}
            >
              {ctaLabel}
            </Button>
            {job && <ActionStatusBadge status={job.status} />}
          </div>

          <ConfirmActionDialog
            action={action}
            open={confirmOpen}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => {
              setConfirmOpen(false)
              submitActionJob(action)
            }}
          />
        </>
      )}
    </DetailDrawer>
  )
}
