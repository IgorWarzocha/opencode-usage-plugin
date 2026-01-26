/**
 * Loads auth data and fetches live usage snapshots from providers.
 * Supports filtering by provider alias.
 */

import z from "zod"
import type { UsageSnapshot } from "../types"
import { providers } from "../providers"
import { loadUsageConfig } from "./config"
import { getPossibleAuthPaths } from "../utils"
import type { AuthRecord } from "./registry"
import { resolveProviderAuths } from "./registry"

const authEntrySchema = z
  .object({
    type: z.string().optional(),
    access: z.string().optional(),
    refresh: z.string().optional(),
    enterpriseUrl: z.string().optional(),
    accountId: z.string().optional(),
  })
  .passthrough()

const authRecordSchema = z.record(z.string(), authEntrySchema)

export const providerAliases: Record<string, string> = {
  codex: "codex",
  openai: "codex",
  gpt: "codex",
  proxy: "proxy",
  agy: "proxy",
  antigravity: "proxy",
  gemini: "proxy",
  copilot: "copilot",
  gh: "copilot",
  github: "copilot",
}

export function resolveProviderFilter(filter?: string): string | undefined {
  if (!filter) return undefined
  const normalized = filter.toLowerCase().trim()
  return providerAliases[normalized]
}

export async function fetchUsageSnapshots(filter?: string): Promise<UsageSnapshot[]> {
  const targetProvider = resolveProviderFilter(filter)
  const usageConfig = await loadUsageConfig().catch(() => null)
  const providerToggles = usageConfig?.providers ?? {}
  const isProviderEnabled = (id: string): boolean => {
    if (id === "codex") return providerToggles.openai !== false
    if (id === "proxy") return providerToggles.proxy !== false
    if (id === "copilot") return providerToggles.copilot !== false
    return true
  }
  const auths = await loadAuths()
  const entries = resolveProviderAuths(auths, null)
  const snapshots: UsageSnapshot[] = []

  const fetches = entries
    .filter((entry) => !targetProvider || entry.providerID === targetProvider)
    .filter((entry) => isProviderEnabled(entry.providerID))
    .map(async (entry) => {
      const provider = providers[entry.providerID]
      if (!provider?.fetchUsage) return
      const snapshot = await provider.fetchUsage(entry.auth).catch(() => null)
      if (snapshot) snapshots.push(snapshot)
    })

  const specialProviders = ["proxy", "copilot"]
  for (const id of specialProviders) {
    if ((!targetProvider || targetProvider === id) && isProviderEnabled(id)) {
      const provider = providers[id]
      if (provider?.fetchUsage) {
        fetches.push(
          provider
            .fetchUsage(undefined)
            .then((snapshot) => {
              if (snapshot) snapshots.push(snapshot)
            })
            .catch(() => {}),
        )
      }
    }
  }

  await Promise.race([Promise.all(fetches), timeout(5000)])
  return snapshots
}

/**
 * Loads auth data from the first available auth file.
 * Merges data from all found files on macOS where multiple locations may exist.
 * Also handles .codex/auth.json as a fallback for OpenAI/Codex tokens.
 */
export async function loadAuths(): Promise<AuthRecord> {
  const possiblePaths = getPossibleAuthPaths()
  const mergedAuth: AuthRecord = {}

  // Try to load and merge from all possible paths
  for (const authPath of possiblePaths) {
    try {
      const data = await Bun.file(authPath).json()
      if (data && typeof data === "object") {
        // Special handling for .codex/auth.json format
        if (authPath.includes(".codex")) {
          const codexAuth = transformCodexAuth(data)
          if (codexAuth) {
            Object.assign(mergedAuth, codexAuth)
          }
          continue
        }

        const parsed = authRecordSchema.safeParse(data)
        if (parsed.success) {
          // Merge auth entries (later paths override earlier ones)
          Object.assign(mergedAuth, parsed.data)
        }
      }
    } catch {
      // File doesn't exist or is invalid, continue to next path
      continue
    }
  }

  return mergedAuth
}

/**
 * Transforms .codex/auth.json format to standard auth record format.
 * .codex/auth.json: { tokens: { access_token, account_id, refresh_token } }
 * Standard format: { openai: { access, accountId, refresh, type: "oauth" } }
 */
function transformCodexAuth(data: unknown): AuthRecord | null {
  if (!data || typeof data !== "object") return null

  // Check for .codex format: { tokens: { access_token, account_id, ... } }
  const tokens = (data as { tokens?: { access_token?: string; account_id?: string; refresh_token?: string } }).tokens
  if (!tokens || typeof tokens !== "object") return null

  const { access_token, account_id, refresh_token } = tokens
  if (!access_token) return null

  return {
    openai: {
      type: "oauth",
      access: access_token,
      accountId: account_id,
      refresh: refresh_token,
    },
  }
}

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
