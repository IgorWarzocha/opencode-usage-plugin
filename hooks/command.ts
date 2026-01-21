/**
 * Implements /usage command handling and config registration.
 * Fetches live usage snapshots and renders a status message.
 */

import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import type { UsageState } from "../state"
import { fetchUsageSnapshots } from "../usage"
import { renderUsageStatus } from "../ui"

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
        description: "Show API usage and rate limits",
      }
    },

    "command.execute.before": async (input) => {
      if (input.command !== "usage") return
      const snapshots = await fetchUsageSnapshots()
      await renderUsageStatus({
        client: options.client,
        state: options.state,
        sessionID: input.sessionID,
        snapshots,
      })
      throw new Error("__USAGE_COMMAND_HANDLED__")
    },
  }
}
