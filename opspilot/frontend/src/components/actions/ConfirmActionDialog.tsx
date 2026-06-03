/**
 * ConfirmActionDialog — enterprise-safe confirmation gate before a remediation
 * is executed. Surfaces what is about to happen (action, risk, impact, ETA and
 * the first execution steps) and requires an explicit confirm. High/critical
 * risk actions get a prominent warning.
 *
 * This is the "are you sure?" step between the Recommendation Drawer CTA and the
 * mocked job submission.
 */
import React from 'react'
import {
  makeStyles,
  tokens,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  MessageBar,
  MessageBarBody,
} from '@fluentui/react-components'
import type { ApiRecommendedAction } from '../../api/recommendations'
import { RiskBadge, ImpactBadge } from '../shared/SeverityBadge'
import { asRisk } from '../../theme/tokens'

const useStyles = makeStyles({
  body: { display: 'flex', flexDirection: 'column', gap: '14px' },
  badges: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  meta: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
    fontFamily: '"Cascadia Code", "Consolas", monospace',
  },
  desc: { fontSize: '13px', color: tokens.colorNeutralForeground2, lineHeight: '1.5', margin: 0 },
  stepsLabel: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    color: tokens.colorNeutralForeground3,
  },
  steps: { margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' },
  step: { fontSize: '12px', color: tokens.colorNeutralForeground2, lineHeight: '1.5' },
})

const CTA_LABEL: Record<string, string> = {
  rollback: 'Execute Rollback',
  fix: 'Apply Hotfix',
  infrastructure: 'Provision Infrastructure',
}

export interface ConfirmActionDialogProps {
  action: ApiRecommendedAction | null
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmActionDialog: React.FC<ConfirmActionDialogProps> = ({
  action,
  open,
  onConfirm,
  onCancel,
}) => {
  const s = useStyles()
  const risk = action ? asRisk(action.risk) : 'medium'
  const elevated = risk === 'high' || risk === 'critical'

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onCancel()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Confirm: {action?.title ?? 'Remediation'}</DialogTitle>
          <DialogContent>
            {action && (
              <div className={s.body}>
                {elevated && (
                  <MessageBar intent={risk === 'critical' ? 'error' : 'warning'}>
                    <MessageBarBody>
                      This is a <strong>{action.risk_label}</strong> action against production.
                      Confirm you intend to execute it.
                    </MessageBarBody>
                  </MessageBar>
                )}

                <p className={s.desc}>{action.description}</p>

                <div className={s.badges}>
                  <RiskBadge risk={action.risk} label={action.risk_label} />
                  <ImpactBadge impact={action.impact} label={action.impact_label} />
                  <span className={s.meta}>ETA {action.estimated_time}</span>
                </div>

                {action.steps.length > 0 && (
                  <div>
                    <span className={s.stepsLabel}>Execution Plan</span>
                    <ol className={s.steps}>
                      {action.steps.slice(0, 4).map((step, i) => (
                        <li key={i} className={s.step}>
                          {step}
                        </li>
                      ))}
                      {action.steps.length > 4 && (
                        <li className={s.step}>+{action.steps.length - 4} more…</li>
                      )}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              onClick={onConfirm}
              style={
                elevated
                  ? { backgroundColor: '#dc2626', borderColor: '#dc2626' }
                  : undefined
              }
            >
              {action ? CTA_LABEL[action.type] ?? 'Execute Action' : 'Execute'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
