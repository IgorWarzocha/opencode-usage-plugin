/**
 * Resolves provider auth entries for usage snapshots.
 */

import type { CodexAuth } from "../providers/codex"
import type { CopilotAuthData } from "../providers/copilot/types"
import type { ZaiAuth } from "../providers/zai/types"
import type { OpenRouterAuth } from "../providers/openrouter/types"
import type { UsageConfig } from "../types"

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
  | { providerID: "codex"; entryID: string; auth: CodexAuth }
  | { providerID: "copilot"; entryID: string; auth: CopilotAuthData }
  | { providerID: "zai-coding-plan"; entryID: string; auth: ZaiAuth }
  | { providerID: "openrouter"; entryID: string; auth: OpenRouterAuth }

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
    entries.push({ providerID: descriptor.id, entryID: descriptor.id, auth: built } as ProviderAuthEntry)
  }

  return entries
}

export function resolveProviderAuthsWithConfig(
  auths: AuthRecord,
  usageToken: string | null,
  config: UsageConfig | null,
): ProviderAuthEntry[] {
  const baseEntries = resolveProviderAuths(auths, usageToken).filter(e => e.providerID !== "openrouter")
  const openRouterEntries = resolveOpenRouterAuths(auths, config)
  return [...baseEntries, ...openRouterEntries]
}

function resolveOpenRouterAuths(auths: AuthRecord, config: UsageConfig | null): ProviderAuthEntry[] {
  const entries: ProviderAuthEntry[] = []
  const seenKeys = new Set<string>()

  const configuredKeys = Array.isArray(config?.openrouterKeys) ? config.openrouterKeys : []
  for (const configured of configuredKeys) {
    const key = configured?.key?.trim()
    if (!key || seenKeys.has(key)) continue
    const rawName = configured?.name?.trim()
    const name = rawName || `key-${entries.length + 1}`
    if (configured.enabled === false) continue
    seenKeys.add(key)
    entries.push({
      providerID: "openrouter",
      entryID: `openrouter:${name}`,
      auth: { key, keyName: name },
    })
  }

  for (const authKey of ["openrouter", "or"]) {
    const auth = auths[authKey]
    const key = (auth?.key || auth?.access || "").trim()
    if (!key || seenKeys.has(key)) continue
    seenKeys.add(key)
    entries.push({
      providerID: "openrouter",
      entryID: "openrouter",
      auth: { key, keyName: "default" },
    })
    break
  }

  return entries
}
