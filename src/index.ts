/**
 * Plugin entry point for Usage Tracking.
 * Wires hooks for live usage snapshots.
 */

import type { Plugin } from "@opencode-ai/plugin"
import { commandHooks, sessionHooks, proxyHooks } from "./hooks"
import { createUsageState } from "./state"
import { loadUsageConfig } from "./usage/config"
import type { UsageConfig } from "./types"

export const UsagePlugin: Plugin = async ({ client }) => {
  const state = createUsageState()

  try {
    const usageConfig = await loadUsageConfig().catch(() => ({} as UsageConfig))

    state.availableProviders.codex = usageConfig?.providers?.openai !== false
    state.availableProviders.proxy = usageConfig?.providers?.proxy !== false
    state.availableProviders.copilot = usageConfig?.providers?.copilot !== false
    state.availableProviders.anthropic = usageConfig?.providers?.anthropic !== false
  } catch (err) {}

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
  }
}

export default UsagePlugin
