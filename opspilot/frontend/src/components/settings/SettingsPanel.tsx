/**
 * SettingsPanel — real product settings (Phase B).
 *
 * Sections: General · Investigation · AI · System · Export.
 * Every control is real: General + auto-refresh write to PreferencesContext
 * (persisted to localStorage); AI/System values are read LIVE from the backend
 * (/api/system/health, /api/system/services, /health); Export actually downloads
 * JSON / Markdown and opens the browser PDF dialog. No fake toggles.
 */
import React from 'react'
import {
  makeStyles,
  tokens,
  Switch,
  Select,
  Badge,
  Button,
  Spinner,
} from '@fluentui/react-components'
import {
  DocumentPdfRegular,
  CodeRegular,
  DocumentTextRegular,
} from '@fluentui/react-icons'
import {
  usePreferences,
  ACTIVE_THEME_NAME,
  type AutoRefreshSeconds,
} from '../../store/PreferencesContext'
import { useSystemInfo } from '../../hooks/useSystemInfo'
import { useActiveSnapshot } from '../../hooks/useActiveSnapshot'
import { useNotify } from '../../store/NotificationContext'
import {
  buildSnapshot,
  snapshotToMarkdown,
  downloadBlob,
} from '../../utils/incidentExport'
import { ACTIVE_INCIDENT_ID } from '../../utils/constants'

const APP_VERSION = '1.0.0'

const useStyles = makeStyles({
  page: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '880px' },
  head: { display: 'flex', flexDirection: 'column', gap: '4px' },
  h1: { fontSize: '22px', fontWeight: 700, color: tokens.colorNeutralForeground1, margin: 0, letterSpacing: '-0.3px' },
  sub: { fontSize: '13px', color: tokens.colorNeutralForeground3, margin: 0 },
  card: {
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: '8px',
    overflow: 'hidden',
  },
  cardHead: {
    padding: '12px 16px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: tokens.colorNeutralForeground3,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '14px 16px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    ':last-child': { borderBottom: 'none' },
  },
  rowText: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  rowLabel: { fontSize: '13px', fontWeight: 600, color: tokens.colorNeutralForeground1 },
  rowDesc: { fontSize: '12px', color: tokens.colorNeutralForeground3 },
  control: { flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' },
  value: { fontSize: '13px', fontWeight: 600, color: tokens.colorNeutralForeground1, fontVariantNumeric: 'tabular-nums' },
  mono: { fontFamily: '"Cascadia Code","Consolas",monospace', fontSize: '12px' },
  exportRow: { display: 'flex', gap: '10px', padding: '16px', flexWrap: 'wrap' },
})

const Row: React.FC<{ label: string; desc?: string; children: React.ReactNode }> = ({ label, desc, children }) => {
  const s = useStyles()
  return (
    <div className={s.row}>
      <div className={s.rowText}>
        <span className={s.rowLabel}>{label}</span>
        {desc && <span className={s.rowDesc}>{desc}</span>}
      </div>
      <div className={s.control}>{children}</div>
    </div>
  )
}

const REFRESH_OPTIONS: { value: AutoRefreshSeconds; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 15, label: 'Every 15s' },
  { value: 30, label: 'Every 30s' },
  { value: 60, label: 'Every 60s' },
  { value: 120, label: 'Every 2m' },
]

export const SettingsPanel: React.FC = () => {
  const s = useStyles()
  const notify = useNotify()
  const { timeZoneMode, toggleTimeZoneMode, autoRefreshSeconds, setAutoRefreshSeconds } = usePreferences()
  const { data, loading, offline } = useSystemInfo()
  const { ready, buildInput } = useActiveSnapshot()

  const foundry = data.foundry
  const telemetryMode = data.services?.telemetryMode ?? '—'
  const modelDeployment = foundry
    ? Array.from(new Set([foundry.commanderModel, foundry.specialistModel, foundry.reasoningModel])).join(', ')
    : '—'
  const costMode = foundry
    ? /o4-mini/i.test(modelDeployment) && !/gpt-4o/i.test(modelDeployment)
      ? 'Enabled · o4-mini only'
      : 'Standard'
    : '—'

  const onExport = (fmt: 'json' | 'md' | 'pdf') => {
    if (fmt === 'pdf') {
      notify({ title: 'Opening print dialog', body: 'Choose “Save as PDF” to export.', intent: 'info' })
      window.print()
      return
    }
    if (!ready) {
      notify({ title: 'Nothing to export', body: 'Incident data has not loaded yet.', intent: 'warning' })
      return
    }
    const input = buildInput()
    if (fmt === 'json') {
      downloadBlob(`${ACTIVE_INCIDENT_ID}-snapshot.json`, JSON.stringify(buildSnapshot(input), null, 2), 'application/json')
      notify({ title: 'Exported JSON', body: `${ACTIVE_INCIDENT_ID}-snapshot.json`, intent: 'success' })
    } else {
      downloadBlob(`${ACTIVE_INCIDENT_ID}-report.md`, snapshotToMarkdown(input), 'text/markdown')
      notify({ title: 'Exported Markdown', body: `${ACTIVE_INCIDENT_ID}-report.md`, intent: 'success' })
    }
  }

  return (
    <div className={s.page}>
      <div className={s.head}>
        <h1 className={s.h1}>Settings</h1>
        <p className={s.sub}>Console preferences and live platform configuration.</p>
      </div>

      {/* GENERAL */}
      <div className={s.card}>
        <div className={s.cardHead}>General</div>
        <Row label="Theme" desc="The console ships a single dark enterprise theme.">
          <Badge appearance="tint" color="informative">{ACTIVE_THEME_NAME}</Badge>
        </Row>
        <Row label="Timezone" desc="Drives every timestamp across the console.">
          <span className={s.value}>{timeZoneMode === 'utc' ? 'UTC' : 'Local'}</span>
          <Switch
            checked={timeZoneMode === 'utc'}
            onChange={toggleTimeZoneMode}
            label="UTC"
            aria-label="Use UTC time"
          />
        </Row>
        <Row label="Auto refresh interval" desc="How often the active panel re-runs its data hooks.">
          <Select
            value={String(autoRefreshSeconds)}
            onChange={(_, d) => setAutoRefreshSeconds(Number(d.value) as AutoRefreshSeconds)}
            aria-label="Auto refresh interval"
          >
            {REFRESH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Row>
      </div>

      {/* INVESTIGATION */}
      <div className={s.card}>
        <div className={s.cardHead}>Investigation</div>
        <Row label="Agent timeout" desc="Max wall-clock per specialist agent before it is marked timed out.">
          <span className={s.value}>120s</span>
        </Row>
        <Row label="Confidence threshold" desc="Below this combined confidence the orchestrator escalates to deep reasoning.">
          <span className={s.value}>70%</span>
        </Row>
        <Row label="Auto-escalation" desc="Escalate low-confidence investigations to the o4-mini reasoning agent.">
          <Badge appearance="tint" color="success">Enabled</Badge>
        </Row>
        <div className={s.row} style={{ paddingTop: 0 }}>
          <span className={s.rowDesc}>These are configured server-side (backend environment). Shown here for visibility.</span>
        </div>
      </div>

      {/* AI */}
      <div className={s.card}>
        <div className={s.cardHead}>AI {loading && <Spinner size="extra-tiny" style={{ marginLeft: 8 }} />}</div>
        <Row label="Model deployment" desc="Azure AI Foundry deployment backing every agent role.">
          <span className={`${s.value} ${s.mono}`}>{modelDeployment}</span>
        </Row>
        <Row label="Execution mode" desc="How the backend resolves the AI provider.">
          {foundry
            ? <Badge appearance="tint" color={foundry.foundryConfigured ? 'success' : 'warning'}>{foundry.executionMode}</Badge>
            : <span className={s.value}>—</span>}
        </Row>
        <Row label="Telemetry mode" desc="Source of monitored-service discovery and metrics.">
          <Badge appearance="tint" color={telemetryMode === 'azure' ? 'success' : 'informative'}>{telemetryMode}</Badge>
        </Row>
        <Row label="Cost optimization" desc="o4-mini-only keeps inference cost minimal; no GPT-4o calls.">
          <span className={s.value}>{costMode}</span>
        </Row>
      </div>

      {/* SYSTEM */}
      <div className={s.card}>
        <div className={s.cardHead}>System</div>
        <Row label="Backend status" desc="Live reachability of the OpsPilot API.">
          <Badge appearance="tint" color={offline ? 'danger' : data.health ? 'success' : 'warning'}>
            {offline ? 'Offline' : data.health?.status ?? 'Unknown'}
          </Badge>
        </Row>
        <Row label="API version" desc="Version reported by the backend /health endpoint.">
          <span className={`${s.value} ${s.mono}`}>{data.health?.version ?? '—'}</span>
        </Row>
        <Row label="App version" desc="This frontend build.">
          <span className={`${s.value} ${s.mono}`}>{APP_VERSION}</span>
        </Row>
      </div>

      {/* EXPORT */}
      <div className={s.card}>
        <div className={s.cardHead}>Export</div>
        <div className={s.exportRow}>
          <Button icon={<DocumentPdfRegular />} onClick={() => onExport('pdf')}>PDF</Button>
          <Button icon={<CodeRegular />} onClick={() => onExport('json')}>JSON</Button>
          <Button icon={<DocumentTextRegular />} onClick={() => onExport('md')}>Markdown</Button>
        </div>
      </div>
    </div>
  )
}
