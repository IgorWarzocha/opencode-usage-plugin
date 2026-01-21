/**
 * Plugin entry point for Usage Tracking.
 * Wires hooks and tools for live usage snapshots.
 */

import type { Plugin } from "@opencode-ai/plugin"
import { commandHooks, sessionHooks } from "./hooks"
import { createUsageState } from "./state"
import { usageTool } from "./tools"

export const UsagePlugin: Plugin = async ({ client }) => {
  const state = createUsageState()

  return {
    ...commandHooks({ client, state }),
    ...sessionHooks(state),
    tool: {
      "usage.get": usageTool(),
    },
  }
}

export default UsagePlugin
