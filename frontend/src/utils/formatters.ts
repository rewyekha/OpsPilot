/**
 * Date/time + number formatters.
 *
 * TIMEZONE POLICY
 * ---------------
 * The product previously rendered hardcoded UTC strings ("14:23 UTC",
 * "Nov 29 · 14:18 UTC"). Enterprise consoles (Azure Portal, Defender,
 * Sentinel) render timestamps in the *viewer's* local zone by default and
 * offer an explicit UTC toggle. These helpers implement that policy via
 * `Intl.DateTimeFormat`:
 *
 *   - mode 'local' (DEFAULT) → browser local zone, e.g. "03 Jun 2026, 20:53 IST"
 *   - mode 'utc'             → "03 Jun 2026, 15:23 UTC"
 *
 * The mode is supplied by PreferencesContext (see store/PreferencesContext)
 * so a single toggle reformats the whole app. These functions stay pure so
 * they're trivially testable and reusable outside React.
 */

export type TimeZoneMode = 'local' | 'utc'

/** Anything we accept as a timestamp: ISO string, epoch ms, Date, or nullish. */
export type DateInput = string | number | Date | null | undefined

/** Parse an API timestamp (ISO-8601) or Date. Returns null when unparseable. */
function toDate(value: DateInput): Date | null {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const zoneOpts = (mode: TimeZoneMode): Pick<Intl.DateTimeFormatOptions, 'timeZone'> =>
  mode === 'utc' ? { timeZone: 'UTC' } : {}

/**
 * Short timezone label for the active mode — "IST", "PST", "UTC", …
 * Derived from Intl so it always matches what the user actually sees.
 */
export function timeZoneAbbr(mode: TimeZoneMode = 'local', at: Date = new Date()): string {
  if (mode === 'utc') return 'UTC'
  const parts = new Intl.DateTimeFormat(undefined, {
    timeZoneName: 'short',
  }).formatToParts(at)
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
}

/** Time only: "20:53 IST" (24h). */
export function formatTime(
  value: DateInput,
  mode: TimeZoneMode = 'local',
): string {
  const d = toDate(value)
  if (!d) return typeof value === 'string' ? value : '—'
  const time = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...zoneOpts(mode),
  }).format(d)
  return `${time} ${timeZoneAbbr(mode, d)}`.trim()
}

/** Full timestamp: "03 Jun 2026, 20:53 IST". */
export function formatTimestamp(
  value: DateInput,
  mode: TimeZoneMode = 'local',
): string {
  const d = toDate(value)
  if (!d) return typeof value === 'string' ? value : '—'
  const date = new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...zoneOpts(mode),
  }).format(d)
  return `${date}, ${formatTime(d, mode)}`
}

/** "with seconds" variant for dense log/agent views: "20:53:07 IST". */
export function formatTimeWithSeconds(
  value: DateInput,
  mode: TimeZoneMode = 'local',
): string {
  const d = toDate(value)
  if (!d) return typeof value === 'string' ? value : '—'
  const time = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...zoneOpts(mode),
  }).format(d)
  return `${time} ${timeZoneAbbr(mode, d)}`.trim()
}

/** Relative age: "just now", "4 min ago", "2 h ago", "3 d ago". */
export function formatRelative(
  value: DateInput,
  now: Date = new Date(),
): string {
  const d = toDate(value)
  if (!d) return typeof value === 'string' ? value : '—'
  const diffSec = Math.round((now.getTime() - d.getTime()) / 1000)
  if (diffSec < 0) return 'in the future'
  if (diffSec < 10) return 'just now'
  if (diffSec < 60) return `${diffSec} s ago`
  const min = Math.floor(diffSec / 60)
  if (min < 60) return `${min} min ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs} h ago`
  const days = Math.floor(hrs / 24)
  return `${days} d ago`
}

/** Duration in seconds → "4s", "1m 18s", "1h 03m". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return '—'
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`
  const h = Math.floor(m / 60)
  const remM = m % 60
  return `${h}h ${String(remM).padStart(2, '0')}m`
}

/** Compact currency: "$50,400". */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `$${Math.round(value).toLocaleString()}`
}

/** Compact user count: "12K", "1.2M". */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  )
}
