/**
 * GlobalSearch — console-wide search across incidents, agents, recommendations,
 * timeline events and findings.
 *
 * Implementation note (Phase A bugfix): this used to wrap <SearchBox> inside a
 * Fluent <PopoverTrigger>. Opening the Popover on the first keystroke pulled
 * focus off the input (Fluent popover focus management fires even with
 * trapFocus={false}), so only a single character could ever be typed. The fix is
 * to keep the input permanently mounted and render results in a custom
 * absolutely-positioned dropdown that never takes focus — so typing is
 * continuous and focus is preserved. Adds a clear (X) button, Ctrl/⌘+K to focus,
 * arrow-key navigation, Enter to open, and Esc / outside-click to dismiss.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { makeStyles, tokens, SearchBox, Text } from '@fluentui/react-components'
import { search, groupResults, CATEGORY_LABELS, type SearchResult } from '../../utils/search'

const useStyles = makeStyles({
  wrapper: { position: 'relative', width: '320px', maxWidth: '40vw' },
  box: { width: '100%' },
  kbd: {
    position: 'absolute',
    right: '34px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '10px',
    fontWeight: 600,
    color: tokens.colorNeutralForeground4,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '4px',
    padding: '1px 5px',
    pointerEvents: 'none',
    fontFamily: '"Cascadia Code", "Consolas", monospace',
  },
  surface: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    zIndex: 1000,
    width: '360px',
    maxWidth: '80vw',
    maxHeight: '440px',
    overflowY: 'auto',
    padding: '4px 0',
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: '8px',
    boxShadow: tokens.shadow28,
  },
  groupLabel: {
    display: 'block',
    padding: '10px 14px 4px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    color: tokens.colorNeutralForeground3,
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '8px 14px',
    cursor: 'pointer',
    border: 'none',
    borderLeft: '2px solid transparent',
    width: '100%',
    textAlign: 'left',
    backgroundColor: 'transparent',
    ':hover': { backgroundColor: tokens.colorNeutralBackground3 },
  },
  itemActive: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderLeft: `2px solid ${tokens.colorBrandStroke1}`,
  },
  itemTitle: { fontSize: '13px', color: tokens.colorNeutralForeground1, fontWeight: 600 },
  itemSub: { fontSize: '11px', color: tokens.colorNeutralForeground3 },
  empty: { padding: '20px 14px', fontSize: '13px', color: tokens.colorNeutralForeground3 },
  hint: { padding: '8px 14px', fontSize: '11px', color: tokens.colorNeutralForeground4 },
})

export interface GlobalSearchProps {
  onNavigate?: (page: string) => void
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onNavigate }) => {
  const s = useStyles()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => search(query), [query])
  const groups = useMemo(() => groupResults(results), [results])
  // Flatten in display order so arrow-key navigation matches the rendered list.
  const flat = useMemo<SearchResult[]>(() => groups.flatMap(([, rs]) => rs), [groups])
  const hasQuery = query.trim().length > 0
  const showSurface = open && hasQuery

  // Reset highlight whenever the result set changes.
  useEffect(() => setActiveIndex(0), [query])

  // Ctrl/⌘+K focuses the search from anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Click outside closes the dropdown (without disturbing input focus on click-in).
  useEffect(() => {
    if (!showSurface) return
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showSurface])

  const select = (target: string) => {
    setOpen(false)
    setQuery('')
    onNavigate?.(target)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!showSurface || flat.length === 0) {
      if (e.key === 'ArrowDown' && hasQuery) setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % flat.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const choice = flat[activeIndex]
      if (choice) select(choice.target)
    }
  }

  let renderIndex = -1

  return (
    <div className={s.wrapper} ref={wrapperRef}>
      <SearchBox
        ref={inputRef}
        className={s.box}
        placeholder="Search incidents, agents, findings…"
        value={query}
        onChange={(_, d) => {
          setQuery(d.value)
          setOpen(true)
        }}
        onFocus={() => hasQuery && setOpen(true)}
        onKeyDown={onKeyDown}
        aria-label="Global search"
        aria-expanded={showSurface}
        role="combobox"
        aria-controls="global-search-results"
      />
      {!query && <span className={s.kbd} aria-hidden>Ctrl K</span>}

      {showSurface && (
        <div className={s.surface} id="global-search-results" role="listbox">
          {flat.length === 0 ? (
            <div className={s.empty}>No results for “{query.trim()}”.</div>
          ) : (
            groups.map(([category, rs]) => (
              <div key={category}>
                <Text className={s.groupLabel}>{CATEGORY_LABELS[category]}</Text>
                {rs.map((r) => {
                  renderIndex += 1
                  const idx = renderIndex
                  return (
                    <button
                      key={r.id}
                      role="option"
                      aria-selected={idx === activeIndex}
                      className={idx === activeIndex ? `${s.item} ${s.itemActive}` : s.item}
                      onMouseEnter={() => setActiveIndex(idx)}
                      // onMouseDown (not onClick) so selection fires before the
                      // input's blur/outside-click handler closes the surface.
                      onMouseDown={(e) => {
                        e.preventDefault()
                        select(r.target)
                      }}
                    >
                      <span className={s.itemTitle}>{r.title}</span>
                      <span className={s.itemSub}>{r.subtitle}</span>
                    </button>
                  )
                })}
              </div>
            ))
          )}
          {flat.length > 0 && (
            <div className={s.hint}>↑↓ to navigate · Enter to open · Esc to close</div>
          )}
        </div>
      )}
    </div>
  )
}
