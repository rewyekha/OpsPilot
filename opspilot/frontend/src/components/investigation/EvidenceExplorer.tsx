// EvidenceExplorer — drill-down panel for agent findings
//
// Slides in from the right (Fluent UI DrawerSurface) when user clicks
// any finding, timeline event, or graph node.
//
// Displays:
//   - Raw tool call output (formatted JSON)
//   - Agent's interpretation of the evidence
//   - Confidence score with justification text
//   - Link to Azure AI Foundry trace for the specific LLM call
//   - Link to the source data (Prometheus chart, KQL query, GitHub diff)
//   - Timestamp of when evidence was collected
//
// This panel is the primary mechanism for building trust in OpsPilot's outputs.
// Every claim is traceable to a source. Nothing is a black box.
//
// Fluent UI components: DrawerSurface, DrawerHeader, DrawerBody, Tab, TabList.

export {}  // placeholder — implementation in sprint 3
