/**
 * Captures active session context for usage notifications.
 * Updates the shared state on every chat parameter update.
 */

import type { Hooks } from "@opencode-ai/plugin"
import type { UsageState } from "../state"

export function sessionHooks(state: UsageState): Pick<Hooks, "chat.params"> {
  return {
    "chat.params": async (input) => {
      state.sessionID = input.sessionID
      state.agent = input.agent
      state.model = {
        providerID: input.model.providerID,
        modelID: input.model.id,
      }
    },
  }
}
