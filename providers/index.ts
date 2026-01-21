/**
 * Barrel exports for usage providers.
 * Centralizes provider registration for fetchers.
 */

import type { UsageProvider } from "./base"
import { CodexProvider } from "./codex"
import { CopilotProvider } from "./copilot"
import { ProxyProvider } from "./proxy"

export const providers: Record<string, UsageProvider<unknown>> = {
  [CodexProvider.id]: CodexProvider as UsageProvider<unknown>,
  [CopilotProvider.id]: CopilotProvider as UsageProvider<unknown>,
  [ProxyProvider.id]: ProxyProvider as UsageProvider<unknown>,
}

export { CodexProvider } from "./codex"
export { CopilotProvider } from "./copilot"
export { ProxyProvider } from "./proxy"
export type { UsageProvider } from "./base"
