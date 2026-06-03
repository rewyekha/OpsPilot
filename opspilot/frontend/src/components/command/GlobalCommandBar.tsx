/**
 * GlobalCommandBar — the persistent action surface beneath the top nav, à la
 * the Azure Portal / Defender command bar.
 *
 * Left:  primary investigation actions (New, Refresh, Report, Export).
 * Right: global search + a local/UTC timezone toggle.
 *
 * Every button performs a real action: New Investigation creates client state,
 * Refresh re-runs the active panel's data hooks, Generate Report downloads a
 * Markdown report, and Export Incident downloads a JSON snapshot — all built
 * from the data already loaded, with no backend mutation.
 */
import React, { useState } from 'react'
import {
  makeStyles,
  tokens,
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
  Button,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  DialogTrigger,
  Field,
  Textarea,
  Input,
  Tooltip,
} from '@fluentui/react-components'
import {
  AddRegular,
  ArrowSyncRegular,
  DocumentRegular,
  ArrowExportRegular,
  GlobeRegular,
} from '@fluentui/react-icons'
import { GlobalSearch } from './GlobalSearch'
import { IncidentStatusBadge } from '../shared/SeverityBadge'
import { usePreferences } from '../../store/PreferencesContext'
import { useSession } from '../../store/SessionContext'
import { useNotify } from '../../store/NotificationContext'
import { useRecommendations } from '../../hooks/useRecommendations'
import { useAgentActivity } from '../../hooks/useAgentActivity'
import { useActiveIncidentWithRecommendations } from '../../hooks/useIncident'
import { ACTIVE_INCIDENT_ID } from '../../utils/constants'
import { buildSnapshot, downloadBlob, type SnapshotInput } from '../../utils/incidentExport'
import { ReportDrawer } from '../report/ReportDrawer'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    height: '44px',
    paddingLeft: '12px',
    paddingRight: '12px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    flexShrink: 0,
  },
  toolbar: { gap: '2px', padding: 0 },
  spacer: { flex: 1 },
  right: { display: 'flex', alignItems: 'center', gap: '8px' },
  tzBtn: { fontVariantNumeric: 'tabular-nums', minWidth: '74px' },
})

export interface GlobalCommandBarProps {
  onNavigate?: (page: string) => void
  onRefresh?: () => void
}

export const GlobalCommandBar: React.FC<GlobalCommandBarProps> = ({ onNavigate, onRefresh }) => {
  const s = useStyles()
  const { timeZoneMode, toggleTimeZoneMode } = usePreferences()
  const { createInvestigation, timelineEvents, jobs, incidentStatus } = useSession()
  const notify = useNotify()
  const recState = useRecommendations(ACTIVE_INCIDENT_ID)
  const agentState = useAgentActivity(ACTIVE_INCIDENT_ID)
  const incidentState = useActiveIncidentWithRecommendations()
  const [newOpen, setNewOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [desc, setDesc] = useState('')
  const [services, setServices] = useState('')

  const buildInput = (): SnapshotInput => ({
    incidentId: ACTIVE_INCIDENT_ID,
    status: incidentStatus(ACTIVE_INCIDENT_ID),
    incident: incidentState.data?.incident ?? null,
    rootCause: recState.data?.root_cause ?? null,
    actions: recState.data?.actions ?? [],
    agents: agentState.data?.agents ?? [],
    jobs: Object.values(jobs),
    sessionEvents: timelineEvents,
    generatedAt: new Date().toISOString(),
  })

  const handleExport = () => {
    if (!recState.data && !incidentState.data) {
      notify({ title: 'Nothing to export', body: 'Incident data has not loaded yet.', intent: 'warning' })
      return
    }
    const snapshot = buildSnapshot(buildInput())
    downloadBlob(`${ACTIVE_INCIDENT_ID}-snapshot.json`, JSON.stringify(snapshot, null, 2), 'application/json')
    notify({ title: 'Incident exported', body: `${ACTIVE_INCIDENT_ID}-snapshot.json`, intent: 'success' })
  }

  const handleReport = () => {
    if (!recState.data && !incidentState.data) {
      notify({ title: 'Cannot generate report', body: 'Incident data has not loaded yet.', intent: 'warning' })
      return
    }
    setReportOpen(true)
  }

  return (
    <div className={s.root}>
      <Toolbar className={s.toolbar} aria-label="Investigation commands">
        <Dialog open={newOpen} onOpenChange={(_, d) => setNewOpen(d.open)}>
          <DialogTrigger disableButtonEnhancement>
            <ToolbarButton icon={<AddRegular />} appearance="primary">
              New Investigation
            </ToolbarButton>
          </DialogTrigger>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>New Investigation</DialogTitle>
              <DialogContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <Field label="Incident description" required>
                    <Textarea
                      value={desc}
                      onChange={(_, d) => setDesc(d.value)}
                      placeholder="e.g. Checkout service returning 5xx after v2.4.1 deploy"
                      rows={3}
                    />
                  </Field>
                  <Field label="Affected services (comma-separated)">
                    <Input
                      value={services}
                      onChange={(_, d) => setServices(d.value)}
                      placeholder="checkout-service, payment-gateway"
                    />
                  </Field>
                </div>
              </DialogContent>
              <DialogActions>
                <DialogTrigger disableButtonEnhancement>
                  <Button appearance="secondary">Cancel</Button>
                </DialogTrigger>
                <Button
                  appearance="primary"
                  disabled={desc.trim().length < 10}
                  onClick={() => {
                    // Mock: creates a client-side investigation (no backend call).
                    createInvestigation({
                      description: desc.trim(),
                      affectedServices: services
                        .split(',')
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                    setNewOpen(false)
                    setDesc('')
                    setServices('')
                    onNavigate?.('incidents')
                  }}
                >
                  Dispatch Agents
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>

        <ToolbarDivider />
        <ToolbarButton icon={<ArrowSyncRegular />} onClick={onRefresh}>
          Refresh Analysis
        </ToolbarButton>
        <ToolbarButton icon={<DocumentRegular />} onClick={handleReport}>
          Generate Report
        </ToolbarButton>
        <ToolbarButton icon={<ArrowExportRegular />} onClick={handleExport}>
          Export Incident
        </ToolbarButton>
      </Toolbar>

      <div className={s.spacer} />

      <div className={s.right}>
        {/* Persistent lifecycle status — visible on every page (Dashboard, Incidents, History, Agents) */}
        <IncidentStatusBadge status={incidentStatus(ACTIVE_INCIDENT_ID)} />
        <GlobalSearch onNavigate={onNavigate} />
        <Tooltip
          content={`Showing ${timeZoneMode === 'utc' ? 'UTC' : 'local'} time — click to switch`}
          relationship="description"
        >
          <Button
            className={s.tzBtn}
            size="small"
            appearance="subtle"
            icon={<GlobeRegular />}
            onClick={toggleTimeZoneMode}
          >
            {timeZoneMode === 'utc' ? 'UTC' : 'Local'}
          </Button>
        </Tooltip>
      </div>

      <ReportDrawer input={buildInput()} open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  )
}
