/**
 * Implements /usage command handling and config registration.
 * Fetches live usage snapshots and renders a status message.
 */

import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import type { UsageState } from "../state"
import { fetchUsageSnapshots, resolveProviderFilter } from "../usage"
import { renderUsageStatus, sendStatusMessage } from "../ui"

type UsageClient = PluginInput["client"]

type CommandConfig = {
  template: string
  description: string
}

type UsageConfig = {
  command?: Record<string, CommandConfig>
}

export function commandHooks(options: {
  client: UsageClient
  state: UsageState
}): Pick<Hooks, "command.execute.before" | "config"> {
  return {
    config: async (input) => {
      const config = input as UsageConfig
      config.command ??= {}
      config.command["usage"] = {
        template: "/usage",
        description: "Show API usage and rate limits (anthropic/codex/proxy/copilot/zai)",
      }
    },

    "command.execute.before": async (input) => {
      if (input.command !== "usage") return

      const args = input.arguments?.trim() || ""

      if (args === "support") {
        await sendStatusMessage({
          client: options.client,
          state: options.state,
          sessionID: input.sessionID,
          text: "▣ Support Mirrowel Proxy\n\nSupport our lord and savior: https://ko-fi.com/mirrowel",
        })
        throw new Error("__USAGE_SUPPORT_HANDLED__")
      }

      const filter = args || undefined
      const targetProvider = resolveProviderFilter(filter)

      let effectiveFilter = targetProvider ? filter : undefined

      const snapshots = await fetchUsageSnapshots(effectiveFilter)

      const filteredSnapshots = snapshots.filter(s => {
        if (targetProvider) return true
        if (s.provider === "codex") return options.state.availableProviders.codex
        if (s.provider === "anthropic") return options.state.availableProviders.anthropic
        if (s.provider === "proxy") return options.state.availableProviders.proxy
        if (s.provider === "copilot") return options.state.availableProviders.copilot
        return true
      })

      await renderUsageStatus({
        client: options.client,
        state: options.state,
        sessionID: input.sessionID,
        snapshots: filteredSnapshots,
        filter: effectiveFilter,
      })

      throw new Error("__USAGE_COMMAND_HANDLED__")
    },
  }
}
