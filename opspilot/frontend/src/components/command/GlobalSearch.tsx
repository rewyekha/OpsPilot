/**
 * GlobalSearch — console-wide search across incidents, agents, recommendations,
 * timeline events and findings.
 *
 * Uses Fluent SearchBox + a Popover result list grouped by category. The data
 * comes from utils/search (`search()`), which is a swappable seam: mock today,
 * backend endpoint later. Selecting a result navigates the shell to the owning
 * surface.
 */
import React, { useMemo, useState } from 'react'
import {
  makeStyles,
  tokens,
  SearchBox,
  Popover,
  PopoverTrigger,
  PopoverSurface,
  Text,
} from '@fluentui/react-components'
import { search, groupResults, CATEGORY_LABELS } from '../../utils/search'

const useStyles = makeStyles({
  box: { width: '320px', maxWidth: '40vw' },
  surface: {
    padding: 0,
    width: '360px',
    maxHeight: '440px',
    overflowY: 'auto',
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
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
    width: '100%',
    textAlign: 'left',
    backgroundColor: 'transparent',
    ':hover': { backgroundColor: tokens.colorNeutralBackground3 },
    ':focus-visible': {
      outline: `2px solid ${tokens.colorBrandStroke1}`,
      outlineOffset: '-2px',
    },
  },
  itemTitle: { fontSize: '13px', color: tokens.colorNeutralForeground1, fontWeight: 600 },
  itemSub: { fontSize: '11px', color: tokens.colorNeutralForeground3 },
  empty: { padding: '20px 14px', fontSize: '13px', color: tokens.colorNeutralForeground3 },
})

export interface GlobalSearchProps {
  onNavigate?: (page: string) => void
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onNavigate }) => {
  const s = useStyles()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const groups = useMemo(() => groupResults(search(query)), [query])
  const hasQuery = query.trim().length > 0

  const select = (target: string) => {
    setOpen(false)
    setQuery('')
    onNavigate?.(target)
  }

  return (
    <Popover
      open={open && hasQuery}
      onOpenChange={(_, d) => setOpen(d.open)}
      positioning="below-start"
      // keep focus in the input while the result list is shown
      trapFocus={false}
    >
      {/* PopoverTrigger wants a single focusable child; SearchBox qualifies */}
      <PopoverTrigger disableButtonEnhancement>
        <SearchBox
          className={s.box}
          placeholder="Search incidents, agents, findings…"
          value={query}
          onChange={(_, d) => {
            setQuery(d.value)
            setOpen(true)
          }}
          onFocus={() => hasQuery && setOpen(true)}
          aria-label="Global search"
        />
      </PopoverTrigger>

      <PopoverSurface className={s.surface}>
        {groups.length === 0 ? (
          <div className={s.empty}>No results for “{query.trim()}”.</div>
        ) : (
          groups.map(([category, results]) => (
            <div key={category}>
              <Text className={s.groupLabel}>{CATEGORY_LABELS[category]}</Text>
              {results.map((r) => (
                <button key={r.id} className={s.item} onClick={() => select(r.target)}>
                  <span className={s.itemTitle}>{r.title}</span>
                  <span className={s.itemSub}>{r.subtitle}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </PopoverSurface>
    </Popover>
  )
}
