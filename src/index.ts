/**
 * Plugin entry point for Usage Tracking.
 * Wires hooks for live usage snapshots.
 */

import type { Plugin } from "@opencode-ai/plugin"
import { commandHooks, sessionHooks, proxyHooks } from "./hooks"
import { createUsageState } from "./state"
import { loadAuths } from "./usage/fetch"
import { loadProxyConfig } from "./providers/proxy/config"

export const UsagePlugin: Plugin = async ({ client }) => {
  const state = createUsageState()

  try {
    const [auths, proxyConfig] = await Promise.all([
      loadAuths().catch(() => ({})),
      loadProxyConfig().catch(() => null),
    ])

    state.availableProviders.codex =
      proxyConfig?.providers?.openai !== undefined
        ? proxyConfig.providers.openai
        : Boolean("codex" in auths && auths["codex"] || "openai" in auths && auths["openai"])

    state.availableProviders.proxy =
      proxyConfig?.providers?.proxy !== undefined ? proxyConfig.providers.proxy : Boolean(proxyConfig?.endpoint)
  } catch {}

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
