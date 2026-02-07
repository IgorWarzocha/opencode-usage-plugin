/**
 * Keeps the active session context for usage notifications.
 * Stored in a mutable object so hooks can share updates.
 */

export type UsageState = {
  sessionID: string | null
  agent?: string
  model?: { providerID: string; modelID: string }
  availableProviders: {
    codex: boolean
    proxy: boolean
    copilot: boolean
    anthropic: boolean
  }
}

export function createUsageState(): UsageState {
  return {
    sessionID: null,
    availableProviders: {
      codex: false,
      proxy: false,
      copilot: false,
      anthropic: false,
    },
  }
}
