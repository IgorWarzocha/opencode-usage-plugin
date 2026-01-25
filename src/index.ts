/**
 * Plugin entry point for Usage Tracking.
 * Wires hooks for live usage snapshots.
 */

import type { Plugin } from "@opencode-ai/plugin"
import { commandHooks, sessionHooks, proxyHooks } from "./hooks"
import { createUsageState } from "./state"
import { loadAuths } from "./usage/fetch"
import { loadUsageConfig } from "./usage/config"
import type { UsageConfig } from "./types"
import type { AuthRecord } from "./usage/registry"

import { existsSync } from "fs"
import { getQuotaConfigPath, getUsageTokenPath } from "./providers/copilot/auth"

export const UsagePlugin: Plugin = async ({ client }) => {
  const state = createUsageState()

  try {
    const [auths, usageConfig] = await Promise.all([
      loadAuths().catch(() => ({} as AuthRecord)),
      loadUsageConfig().catch(() => ({} as UsageConfig)),
    ])

    state.availableProviders.codex =
      usageConfig?.providers?.openai !== undefined
        ? usageConfig.providers.openai
        : Boolean(("codex" in auths && auths["codex"]) || ("openai" in auths && auths["openai"]))

    state.availableProviders.proxy =
      usageConfig?.providers?.proxy !== undefined ? usageConfig.providers.proxy : Boolean(usageConfig?.endpoint)

    const authRecord = auths as Record<string, unknown>
    state.availableProviders.copilot =
      usageConfig?.providers?.copilot !== undefined
        ? usageConfig.providers.copilot
        : Boolean(
            authRecord["github-copilot"] ||
              authRecord["copilot"] ||
              existsSync(getQuotaConfigPath()) ||
              existsSync(getUsageTokenPath()),
          )
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
