/**
 * Plugin entry point for Usage Tracking.
 * Wires hooks and tools for live usage snapshots.
 */

import type { Plugin } from "@opencode-ai/plugin"
import { commandHooks, sessionHooks, proxyHooks, markSilent } from "./hooks"
import { createUsageState } from "./state"
import { usageTool, createProxyLimitsTool } from "./tools"

export const UsagePlugin: Plugin = async ({ client }) => {
  const state = createUsageState()

  // Helper to send inline status message
  async function sendStatusMessage(sessionID: string, text: string): Promise<void> {
    await client.session.prompt({
      path: { id: sessionID },
      body: {
        noReply: true,
        parts: [
          {
            type: "text",
            text,
            ignored: true,
          },
        ],
      },
    })
  }

  const proxyHookHandlers = proxyHooks()
  const commandHookHandlers = commandHooks({ client, state })

  return {
    config: commandHookHandlers.config,
    "command.execute.before": commandHookHandlers["command.execute.before"],
    ...sessionHooks(state),
    ...proxyHookHandlers,
    tool: {
      "usage.get": usageTool(),
      "proxy-limits": createProxyLimitsTool(sendStatusMessage, markSilent),
    },
  }
}

export default UsagePlugin
