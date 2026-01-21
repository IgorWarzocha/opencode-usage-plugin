/**
 * Implements /usage command handling and config registration.
 * Fetches live usage snapshots and renders a status message.
 */

import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import type { UsageState } from "../state"
import { fetchUsageSnapshots } from "../usage"
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
        description: "Show API usage and rate limits (codex/gh/proxy or all)",
      }
    },

    "command.execute.before": async (input) => {
      if (input.command !== "usage" && input.command !== "usage support") return

      // Extract filter from arguments (e.g., "/usage proxy" -> "proxy")
      const filter = input.arguments?.trim() || undefined

      if (input.command === "usage support" || filter === "support") {
        await sendStatusMessage({
          client: options.client,
          state: options.state,
          sessionID: input.sessionID,
          text: "▣ Support Mirrowel Proxy\n\nSupport our lord and savior: https://ko-fi.com/mirrowel",
        })
        throw new Error("__USAGE_SUPPORT_HANDLED__")
      }

      const snapshots = await fetchUsageSnapshots(filter)
      await renderUsageStatus({
        client: options.client,
        state: options.state,
        sessionID: input.sessionID,
        snapshots,
        filter,
      })
      throw new Error("__USAGE_COMMAND_HANDLED__")
    },
  }
}
