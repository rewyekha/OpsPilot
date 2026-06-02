// RootCausePanel — hypothesis confidence visualization
//
// Renders the Commander's root cause assessment:
//   - Primary hypothesis with animated confidence progress bar (0→87%)
//   - Alternative hypotheses in descending confidence order
//   - Reasoning trace expandable section (chain-of-thought)
//   - Link to Foundry trace for the Commander synthesis call
//
// Confidence bars animate from 0 to final value when the panel first renders.
// Confidence ≥ 0.8 = green, 0.5–0.8 = amber, < 0.5 = red (Azure Monitor conventions).
//
// Fluent UI components: ProgressBar, Text, Accordion, Link, Badge.

export {}  // placeholder — implementation in sprint 3
