// CommandCenter — primary page / default route
//
// Layout: 2-column grid (sidebar + main) with a top incident header bar.
//
// Left column (30%):
//   - IncidentHeader (severity, status, duration, progress)
//   - AgentActivityStream (live agent status feed)
//
// Right column (70%), tabbed:
//   Tab 1: Investigation
//     - RootCausePanel (top)
//     - TimelineView (bottom)
//   Tab 2: Evidence
//     - InvestigationGraph (full width)
//   Tab 3: Impact
//     - BlastRadiusPanel + BusinessImpactCard
//   Tab 4: Recommendations
//     - RecommendationPanel
//
// Bottom bar:
//   - ExecutiveSummary (copy-to-clipboard)
//
// The CommandCenter is the only page shown during the demo.
// All other pages (History, Agents, Settings) are for production completeness.

export {}  // placeholder — implementation in sprint 2
