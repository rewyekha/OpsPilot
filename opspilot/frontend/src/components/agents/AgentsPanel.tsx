/**
 * AgentsPanel — the Agents workspace.
 *
 * Shows the agent fleet health + comparison, computed from real completed
 * investigations (no static activity feed). Live per-agent execution is observed
 * on the dashboard's live investigation queue.
 */
import React from 'react'
import { AgentHealthOverview } from './AgentHealthOverview'

export const AgentsPanel: React.FC = () => <AgentHealthOverview />
