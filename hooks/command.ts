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
        description: "Show API usage and rate limits (codex/proxy or all)",
      }
    },

    "command.execute.before": async (input) => {
      // 1. Silently reject anything that is not the usage command
      if (input.command !== "usage") return

      const args = input.arguments?.trim() || ""

      // 2. Special case: support subcommand
      if (args === "support") {
        await sendStatusMessage({
          client: options.client,
          state: options.state,
          sessionID: input.sessionID,
          text: "▣ Support Mirrowel Proxy\n\nSupport our lord and savior: https://ko-fi.com/mirrowel",
        })
        throw new Error("__USAGE_SUPPORT_HANDLED__")
      }

      // 3. Resolve filter and handle supported/unsupported syntaxes
      // If arguments are provided but don't match a provider alias, we treat it
      // as an unsupported syntax and fall back to displaying everything.
      const filter = args || undefined
      const targetProvider = resolveProviderFilter(filter)
      
      const effectiveFilter = targetProvider ? filter : undefined

      const snapshots = await fetchUsageSnapshots(effectiveFilter)
      
      await renderUsageStatus({
        client: options.client,
        state: options.state,
        sessionID: input.sessionID,
        snapshots,
        filter: effectiveFilter,
      })
      
      throw new Error("__USAGE_COMMAND_HANDLED__")
    },
  }
}
