import { createDarkTheme, type BrandVariants, type Theme } from '@fluentui/react-components'

// Azure blue brand ramp — all 16 steps required by createDarkTheme
const opsPilotBrand: BrandVariants = {
  10:  '#020b14',
  20:  '#051626',
  30:  '#082238',
  40:  '#0b2e4a',
  50:  '#0d3a5c',
  60:  '#0f476e',
  70:  '#125382',
  80:  '#1562a0',
  90:  '#1a78c2',
  100: '#2191e8',
  110: '#40a5f5',
  120: '#6abbf8',
  130: '#8fccfa',
  140: '#b3ddfc',
  150: '#d4eefe',
  160: '#eef7ff',
}

const base = createDarkTheme(opsPilotBrand)

export const opsPilotDarkTheme: Theme = {
  ...base,

  // ── Surfaces — Azure portal dark palette ──────────────────────────────────
  colorNeutralBackground1: '#0a1628',   // page background
  colorNeutralBackground2: '#0d1c35',   // sidebar, top bar
  colorNeutralBackground3: '#112040',   // hover, elevated cards
  colorNeutralBackground4: '#162848',   // active nav items
  colorNeutralBackground5: '#1a3054',   // deep card surfaces
  colorNeutralBackground6: '#091224',   // deepest layer

  // ── Text ──────────────────────────────────────────────────────────────────
  colorNeutralForeground1: '#e4ecf4',   // primary
  colorNeutralForeground2: '#a8bdd0',   // secondary
  colorNeutralForeground3: '#6a8498',   // tertiary / muted
  colorNeutralForeground4: '#445a6c',   // disabled / hint

  // ── Borders ───────────────────────────────────────────────────────────────
  colorNeutralStroke1: '#1c3050',           // default border
  colorNeutralStroke2: '#243c64',           // emphasized border
  colorNeutralStroke3: '#2c4a78',           // focus outline
  colorNeutralStrokeAccessible: '#4a80b8',  // accessible border
  colorNeutralStrokeOnBrand: '#0a1628',
}
