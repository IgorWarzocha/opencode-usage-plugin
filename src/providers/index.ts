import type { UsageProvider } from "./base"
import { CodexProvider } from "./codex"
import { ProxyProvider } from "./proxy"
import { CopilotProvider } from "./copilot"

export const providers: Record<string, UsageProvider<unknown>> = {
  [CodexProvider.id]: CodexProvider as UsageProvider<unknown>,
  [ProxyProvider.id]: ProxyProvider as UsageProvider<unknown>,
  [CopilotProvider.id]: CopilotProvider as UsageProvider<unknown>,
}

export { CodexProvider } from "./codex"
export { ProxyProvider } from "./proxy"
export { CopilotProvider } from "./copilot"
export type { UsageProvider } from "./base"
