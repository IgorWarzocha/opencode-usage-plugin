import type { UsageProvider } from "./base"
import { CodexProvider } from "./codex"
import { ProxyProvider } from "./proxy"
import { CopilotProvider } from "./copilot"
import { ZaiProvider } from "./zai"
import { AnthropicProvider } from "./anthropic"

export const providers: Record<string, UsageProvider<unknown>> = {
  [CodexProvider.id]: CodexProvider as UsageProvider<unknown>,
  [ProxyProvider.id]: ProxyProvider as UsageProvider<unknown>,
  [CopilotProvider.id]: CopilotProvider as UsageProvider<unknown>,
  [ZaiProvider.id]: ZaiProvider as UsageProvider<unknown>,
  [AnthropicProvider.id]: AnthropicProvider as UsageProvider<unknown>,
}

export { CodexProvider } from "./codex"
export { ProxyProvider } from "./proxy"
export { CopilotProvider } from "./copilot"
export { ZaiProvider } from "./zai"
export { AnthropicProvider } from "./anthropic"
export type { UsageProvider } from "./base"
