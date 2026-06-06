import React from 'react'
import {
  makeStyles,
  tokens,
  Button,
  Badge,
  Tooltip,
  mergeClasses,
} from '@fluentui/react-components'
import {
  HomeRegular,
  HomeFilled,
  AlertRegular,
  AlertFilled,
  ClockRegular,
  ClockFilled,
  BotRegular,
  BotFilled,
  DataPieRegular,
  DataPieFilled,
  SettingsRegular,
  SettingsFilled,
  ChevronDoubleLeftRegular,
  ChevronDoubleRightRegular,
} from '@fluentui/react-icons'

// ── Data model ────────────────────────────────────────────────────────────────

interface NavItemConfig {
  id: string
  label: string
  icon: React.ElementType
  activeIcon: React.ElementType
  badge?: number
}

const MAIN_ITEMS: NavItemConfig[] = [
  { id: 'home',      label: 'Dashboard',        icon: HomeRegular,     activeIcon: HomeFilled },
  { id: 'incidents', label: 'Active Incidents',  icon: AlertRegular,    activeIcon: AlertFilled, badge: 1 },
  { id: 'history',   label: 'History',           icon: ClockRegular,    activeIcon: ClockFilled },
  { id: 'agents',    label: 'Agents',            icon: BotRegular,      activeIcon: BotFilled },
  { id: 'analytics', label: 'Analytics',         icon: DataPieRegular,  activeIcon: DataPieFilled },
]

const BOTTOM_ITEMS: NavItemConfig[] = [
  { id: 'settings', label: 'Settings', icon: SettingsRegular, activeIcon: SettingsFilled },
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface SideNavProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
  activePage: string
  onNavigate: (page: string) => void
}

// ── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderRightColor: tokens.colorNeutralStroke1,
    overflow: 'hidden',
    flexShrink: 0,
    transition: 'width 0.2s ease, min-width 0.2s ease',
    userSelect: 'none',
  },
  expanded: {
    width: '240px',
    minWidth: '240px',
  },
  collapsed: {
    width: '48px',
    minWidth: '48px',
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    display: 'flex',
    alignItems: 'center',
    height: '40px',
    paddingLeft: '4px',
    paddingRight: '4px',
    flexShrink: 0,
    gap: '8px',
    marginTop: '4px',
    marginBottom: '4px',
  },
  headerCollapsed: {
    justifyContent: 'center',
  },
  brandArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: '1',
    overflow: 'hidden',
    paddingLeft: '6px',
  },
  hex: {
    width: '20px',
    height: '20px',
    minWidth: '20px',
    backgroundColor: tokens.colorBrandBackground,
    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
  },
  brandText: {
    fontSize: '13px',
    fontWeight: '700',
    color: tokens.colorNeutralForeground1,
    letterSpacing: '0.2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  collapseBtn: {
    flexShrink: 0,
    color: tokens.colorNeutralForeground3,
  },

  // ── Nav sections ───────────────────────────────────────────────────────────
  mainSection: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1',
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingLeft: '4px',
    paddingRight: '4px',
    gap: '1px',
  },
  bottomSection: {
    display: 'flex',
    flexDirection: 'column',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke1,
    paddingTop: '4px',
    paddingBottom: '8px',
    paddingLeft: '4px',
    paddingRight: '4px',
    flexShrink: 0,
    gap: '1px',
  },

  // ── Nav item ───────────────────────────────────────────────────────────────
  itemWrapper: {
    position: 'relative',
    borderRadius: '4px',
  },
  // Rendered when item is active — provides the left accent bar
  activeBar: {
    position: 'absolute',
    left: '0px',
    top: '5px',
    bottom: '5px',
    width: '3px',
    backgroundColor: tokens.colorBrandBackground,
    borderRadius: '0 2px 2px 0',
    pointerEvents: 'none',
  },
  itemBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    height: '36px',
    paddingLeft: '8px',
    paddingRight: '8px',
    paddingTop: '0',
    paddingBottom: '0',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textAlign: 'left',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground3,
      color: tokens.colorNeutralForeground1,
    },
    ':focus-visible': {
      outline: `2px solid ${tokens.colorBrandBackground}`,
      outlineOffset: '-1px',
    },
  },
  itemBtnActive: {
    backgroundColor: tokens.colorNeutralBackground4,
    color: tokens.colorNeutralForeground1,
  },
  itemIcon: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '18px',
    flexShrink: 0,
    lineHeight: '1',
  },
  itemLabel: {
    fontSize: '13px',
    fontWeight: '400',
    flex: '1',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  itemLabelActive: {
    fontWeight: '600',
  },
})

// ── Nav item component ────────────────────────────────────────────────────────

interface NavItemProps {
  item: NavItemConfig
  isActive: boolean
  isCollapsed: boolean
  onNavigate: (id: string) => void
}

const NavItem: React.FC<NavItemProps> = ({ item, isActive, isCollapsed, onNavigate }) => {
  const styles = useStyles()
  const Icon = isActive ? item.activeIcon : item.icon

  const btn = (
    <div className={styles.itemWrapper}>
      {isActive && <div className={styles.activeBar} />}
      <button
        className={mergeClasses(styles.itemBtn, isActive && styles.itemBtnActive)}
        onClick={() => onNavigate(item.id)}
        aria-current={isActive ? 'page' : undefined}
      >
        <span className={styles.itemIcon}>
          <Icon />
        </span>
        {!isCollapsed && (
          <>
            <span className={mergeClasses(styles.itemLabel, isActive && styles.itemLabelActive)}>
              {item.label}
            </span>
            {item.badge != null && item.badge > 0 && (
              <Badge size="small" color="danger" shape="rounded">
                {item.badge}
              </Badge>
            )}
          </>
        )}
      </button>
    </div>
  )

  if (isCollapsed) {
    return (
      <Tooltip content={item.label} relationship="label" positioning="after">
        {btn}
      </Tooltip>
    )
  }

  return btn
}

// ── SideNav ───────────────────────────────────────────────────────────────────

export const SideNav: React.FC<SideNavProps> = ({
  isCollapsed,
  onToggleCollapse,
  activePage,
  onNavigate,
}) => {
  const styles = useStyles()

  const toggleBtn = (
    <Button
      icon={isCollapsed ? <ChevronDoubleRightRegular /> : <ChevronDoubleLeftRegular />}
      appearance="subtle"
      size="small"
      onClick={onToggleCollapse}
      className={styles.collapseBtn}
      aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
    />
  )

  return (
    <nav
      className={mergeClasses(styles.root, isCollapsed ? styles.collapsed : styles.expanded)}
      aria-label="Main navigation"
    >
      {/* Header row: brand (when expanded) + collapse toggle */}
      <div className={mergeClasses(styles.header, isCollapsed && styles.headerCollapsed)}>
        {!isCollapsed && (
          <div className={styles.brandArea}>
            <div className={styles.hex} />
            <span className={styles.brandText}>OpsPilot</span>
          </div>
        )}
        {isCollapsed ? (
          <Tooltip content="Expand navigation" relationship="label" positioning="after">
            {toggleBtn}
          </Tooltip>
        ) : (
          toggleBtn
        )}
      </div>

      {/* Main navigation items */}
      <div className={styles.mainSection}>
        {MAIN_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            isActive={activePage === item.id}
            isCollapsed={isCollapsed}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {/* Bottom navigation items (settings) */}
      <div className={styles.bottomSection}>
        {BOTTOM_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            isActive={activePage === item.id}
            isCollapsed={isCollapsed}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  )
}
