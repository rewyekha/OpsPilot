/**
 * PreferencesContext — app-wide UI preferences.
 *
 * Holds the timezone display mode (drives every timestamp via utils/formatters)
 * and the auto-refresh interval (drives the shell's periodic panel refresh).
 * Both are persisted to localStorage so the console remembers them across
 * reloads. One provider at the root means a single switch reformats / re-paces
 * the entire app with no prop drilling.
 */
import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react'
import {
  formatRelative,
  formatTime,
  formatTimestamp,
  formatTimeWithSeconds,
  timeZoneAbbr,
  type DateInput,
  type TimeZoneMode,
} from '../utils/formatters'

/** Auto-refresh cadence in seconds; 0 = off. */
export type AutoRefreshSeconds = 0 | 15 | 30 | 60 | 120

/** The single dark enterprise theme the console ships with. */
export const ACTIVE_THEME_NAME = 'Dark · Enterprise'

const TZ_KEY = 'opspilot.timeZoneMode'
const REFRESH_KEY = 'opspilot.autoRefreshSeconds'

function readStored<T>(key: string, fallback: T, valid: (v: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    const parsed = JSON.parse(raw)
    return valid(parsed) ? (parsed as T) : fallback
  } catch {
    return fallback
  }
}

interface PreferencesContextValue {
  timeZoneMode: TimeZoneMode
  setTimeZoneMode: (mode: TimeZoneMode) => void
  toggleTimeZoneMode: () => void
  autoRefreshSeconds: AutoRefreshSeconds
  setAutoRefreshSeconds: (seconds: AutoRefreshSeconds) => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timeZoneMode, setTimeZoneMode] = useState<TimeZoneMode>(() =>
    readStored<TimeZoneMode>(TZ_KEY, 'local', (v) => v === 'local' || v === 'utc'),
  )
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState<AutoRefreshSeconds>(() =>
    readStored<AutoRefreshSeconds>(REFRESH_KEY, 0, (v) => [0, 15, 30, 60, 120].includes(v as number)),
  )

  useEffect(() => {
    try { localStorage.setItem(TZ_KEY, JSON.stringify(timeZoneMode)) } catch { /* ignore */ }
  }, [timeZoneMode])
  useEffect(() => {
    try { localStorage.setItem(REFRESH_KEY, JSON.stringify(autoRefreshSeconds)) } catch { /* ignore */ }
  }, [autoRefreshSeconds])

  const toggleTimeZoneMode = useCallback(
    () => setTimeZoneMode((m) => (m === 'local' ? 'utc' : 'local')),
    [],
  )

  const value = useMemo<PreferencesContextValue>(
    () => ({
      timeZoneMode,
      setTimeZoneMode,
      toggleTimeZoneMode,
      autoRefreshSeconds,
      setAutoRefreshSeconds,
    }),
    [timeZoneMode, toggleTimeZoneMode, autoRefreshSeconds],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within <PreferencesProvider>')
  return ctx
}

/** Mode-bound formatter helpers — the idiomatic way to render time in a component. */
export function useFormatters() {
  const { timeZoneMode } = usePreferences()
  return useMemo(
    () => ({
      mode: timeZoneMode,
      zoneAbbr: () => timeZoneAbbr(timeZoneMode),
      time: (v: DateInput) => formatTime(v, timeZoneMode),
      timeWithSeconds: (v: DateInput) => formatTimeWithSeconds(v, timeZoneMode),
      timestamp: (v: DateInput) => formatTimestamp(v, timeZoneMode),
      relative: (v: DateInput) => formatRelative(v),
    }),
    [timeZoneMode],
  )
}
