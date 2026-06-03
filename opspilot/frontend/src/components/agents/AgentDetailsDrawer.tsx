/**
 * AgentDetailsDrawer — drill-down for a single investigation agent.
 *
 * Opened by clicking a row in the Investigation Queue (dashboard) or the
 * Agents DataGrid. Replaces the old "everything expanded in a giant card"
 * model: the queue shows the summary, this drawer holds the depth.
 *
 * Reuses the shared DetailDrawer primitive + ConfidenceBar + AgentStatusBadge.
 */
import React from 'react'
import { makeStyles, tokens, Tag, TagGroup } from '@fluentui/react-components'
import type { ApiAgentTask } from '../../api/agents'
import { DetailDrawer, DrawerSection, EvidenceList, RawJson } from '../shared/DetailDrawer'
import { ConfidenceBar } from '../shared/ConfidenceBar'
import { AgentStatusBadge } from '../shared/SeverityBadge'
import { useFormatters } from '../../store/PreferencesContext'
import { formatDuration } from '../../utils/formatters'
import { confidenceColor } from '../../theme/tokens'

const useStyles = makeStyles({
  body: { fontSize: '13px', color: tokens.colorNeutralForeground2, lineHeight: '1.6', margin: 0 },
  timelineGrid: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '6px 16px',
    fontSize: '13px',
  },
  tLabel: { color: tokens.colorNeutralForeground3 },
  tValue: { color: tokens.colorNeutralForeground1, fontVariantNumeric: 'tabular-nums' },
  confNote: { fontSize: '12px', color: tokens.colorNeutralForeground3, margin: 0 },
})

function confidenceExplanation(score: number): string {
  if (score >= 90) return 'High confidence — findings are strongly corroborated across signals.'
  if (score >= 75) return 'Solid confidence — primary evidence aligns, minor gaps remain.'
  if (score >= 50) return 'Moderate confidence — supporting evidence is partial or still streaming.'
  return 'Low confidence — investigation in progress; treat as provisional.'
}

export interface AgentDetailsDrawerProps {
  task: ApiAgentTask | null
  open: boolean
  onClose: () => void
}

export const AgentDetailsDrawer: React.FC<AgentDetailsDrawerProps> = ({ task, open, onClose }) => {
  const s = useStyles()
  const fmt = useFormatters()

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={task?.role_label ?? 'Agent'}
      subtitle={task ? `${task.role} · ${task.id}` : undefined}
      headerAction={task && <AgentStatusBadge status={task.status} pill />}
    >
      {task && (
        <>
          <DrawerSection label="Summary">
            <p className={s.body}>{task.finding}</p>
          </DrawerSection>

          <DrawerSection label="Confidence">
            <ConfidenceBar value={task.confidence} />
            <p className={s.confNote} style={{ color: confidenceColor(task.confidence) }}>
              {confidenceExplanation(task.confidence)}
            </p>
          </DrawerSection>

          {task.evidence.length > 0 && (
            <DrawerSection label="Evidence">
              <EvidenceList items={task.evidence} />
            </DrawerSection>
          )}

          {task.tools_called.length > 0 && (
            <DrawerSection label="Tools Invoked">
              <TagGroup>
                {task.tools_called.map((t) => (
                  <Tag key={t} appearance="brand" size="small" shape="circular">
                    {t}
                  </Tag>
                ))}
              </TagGroup>
            </DrawerSection>
          )}

          <DrawerSection label="Execution Timeline">
            <div className={s.timelineGrid}>
              <span className={s.tLabel}>Started</span>
              <span className={s.tValue}>{fmt.timeWithSeconds(task.started_at)}</span>
              <span className={s.tLabel}>Completed</span>
              <span className={s.tValue}>
                {task.completed_at ? fmt.timeWithSeconds(task.completed_at) : 'In progress…'}
              </span>
              <span className={s.tLabel}>Duration</span>
              <span className={s.tValue}>{formatDuration(task.duration_seconds)}</span>
            </div>
          </DrawerSection>

          <DrawerSection label="Raw Findings">
            <RawJson value={task} />
          </DrawerSection>
        </>
      )}
    </DetailDrawer>
  )
}
