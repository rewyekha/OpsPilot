// BlastRadiusPanel — impact scope visualization
//
// Renders the Commander's blast radius assessment:
//   - Affected services list with dependency graph hint
//   - Estimated affected user count
//   - Business impact in $/hour
//   - Affected Azure regions (if applicable)
//   - Downstream dependency chain
//
// The $/hour figure is computed from: error_rate × estimated_sessions × avg_order_value
// Formula is configurable per service via Settings.
//
// Fluent UI components: Card, Text, Badge, DataGrid (for affected services table).

export {}  // placeholder — implementation in sprint 3
