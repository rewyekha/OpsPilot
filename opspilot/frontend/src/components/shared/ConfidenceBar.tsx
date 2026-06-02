// ConfidenceBar — reusable animated confidence score display
//
// Props:
//   value: number         — 0.0 to 1.0
//   label?: string        — optional label above bar
//   animate?: boolean     — animate from 0 to value on mount (default: true)
//   size?: 'small' | 'medium' | 'large'
//
// Color rules (matches Azure Monitor conventions):
//   ≥ 0.8  → --colorPaletteGreenBackground3
//   0.5–0.8 → --colorPaletteYellowBackground3
//   < 0.5  → --colorPaletteRedBackground3
//
// Used by: RootCausePanel, RecommendationPanel, AgentCard

export {}  // placeholder — implementation in sprint 3
