// TimelineView — chronological event sequence panel
//
// Renders the list[TimelineEvent] produced by the Time Machine Agent.
// Events are grouped by source (metrics / logs / deployment / infra).
// Each event shows: timestamp, source badge, description, severity indicator.
// New events slide in from the bottom as the Time Machine Agent emits them.
// Clicking an event opens the EvidenceExplorer panel for that event's evidence_refs.
//
// Design reference: Azure Monitor's activity log timeline.
// Fluent UI components: Timeline (custom via Divider), Badge, Text, Link.
// Animation: CSS transition on new entry insertion.

export {}  // placeholder — implementation in sprint 3
