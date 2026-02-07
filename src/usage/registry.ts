/**
 * Resolves provider auth entries for usage snapshots.
 */

import type { CodexAuth } from "../providers/codex"
import type { CopilotAuthData } from "../providers/copilot/types"
import type { ZaiAuth } from "../providers/zai/types"
import type { OpenRouterAuth } from "../providers/openrouter/types"

export type AuthEntry = {
  type?: string
  access?: string
  refresh?: string
  enterpriseUrl?: string
  accountId?: string
  key?: string
}

export type AuthRecord = Record<string, AuthEntry>

type ProviderAuthEntry =
  | { providerID: "codex"; auth: CodexAuth }
  | { providerID: "copilot"; auth: CopilotAuthData }
  | { providerID: "zai-coding-plan"; auth: ZaiAuth }
  | { providerID: "openrouter"; auth: OpenRouterAuth }

type ProviderDescriptor = {
  id: ProviderAuthEntry["providerID"]
  authKeys: string[]
  requiresOAuth: boolean
  buildAuth: (entry: AuthEntry, usageToken: string | null) => ProviderAuthEntry["auth"]
}

const providerDescriptors: ProviderDescriptor[] = [
  {
    id: "codex",
    authKeys: ["codex", "openai"],
    requiresOAuth: true,
    buildAuth: (entry) => ({
      access: entry.access || entry.key,
      accountId: entry.accountId,
    }),
  },
  {
    id: "copilot",
    authKeys: ["copilot", "github-copilot"],
    requiresOAuth: true,
    buildAuth: (entry) => ({
      access: entry.access,
      refresh: entry.refresh,
    }),
  },
  {
    id: "zai-coding-plan",
    authKeys: ["zai-coding-plan", "zai", "glm"],
    requiresOAuth: false,
    buildAuth: (entry) => ({
      key: entry.key || entry.access || "",
    }),
  },
  {
    id: "openrouter",
    authKeys: ["openrouter", "or"],
    requiresOAuth: false,
    buildAuth: (entry) => ({
      key: entry.key || entry.access || "",
    }),
  },
]

export function resolveProviderAuths(auths: AuthRecord, usageToken: string | null): ProviderAuthEntry[] {
  const entries: ProviderAuthEntry[] = []

  for (const descriptor of providerDescriptors) {
    const matched = descriptor.authKeys.find((key) => Boolean(auths[key]))
    if (!matched) continue
    const auth = auths[matched]
    if (!auth) continue
    if (descriptor.requiresOAuth && auth.type && auth.type !== "oauth" && auth.type !== "token") continue
    const built = descriptor.buildAuth(auth, usageToken)
    entries.push({ providerID: descriptor.id, auth: built } as ProviderAuthEntry)
  }

  return entries
}
