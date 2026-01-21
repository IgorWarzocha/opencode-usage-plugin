/**
 * Loads auth data and fetches live usage snapshots from providers.
 * Supports filtering by provider alias.
 */

import z from "zod"
import type { UsageSnapshot } from "../types"
import { providers } from "../providers"
import { getAuthFilePath } from "../utils"
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

/** Provider aliases for filtering */
export const providerAliases: Record<string, string> = {
  // Codex/OpenAI
  codex: "codex",
  openai: "codex",
  gpt: "codex",
  // Proxy/Antigravity
  proxy: "proxy",
  agy: "proxy",
  antigravity: "proxy",
  gemini: "proxy",
}

export function resolveProviderFilter(filter?: string): string | undefined {
  if (!filter) return undefined
  const normalized = filter.toLowerCase().trim()
  return providerAliases[normalized]
}

export async function fetchUsageSnapshots(filter?: string): Promise<UsageSnapshot[]> {
  const targetProvider = resolveProviderFilter(filter)
  const auths = await loadAuths()
  const entries = resolveProviderAuths(auths, null)
  const snapshots: UsageSnapshot[] = []

  // Fetch from auth-based providers
  const fetches = entries
    .filter((entry) => !targetProvider || entry.providerID === targetProvider)
    .map(async (entry) => {
      const provider = providers[entry.providerID]
      if (!provider?.fetchUsage) return
      const snapshot = await provider.fetchUsage(entry.auth).catch(() => null)
      if (snapshot) snapshots.push(snapshot)
    })

  // Always include proxy if no filter or filter matches proxy
  if (!targetProvider || targetProvider === "proxy") {
    const proxyProvider = providers["proxy"]
    if (proxyProvider?.fetchUsage) {
      fetches.push(
        proxyProvider
          .fetchUsage(undefined)
          .then((snapshot) => {
            if (snapshot) snapshots.push(snapshot)
          })
          .catch(() => {}),
      )
    }
  }

  await Promise.race([Promise.all(fetches), timeout(5000)])
  return snapshots
}

async function loadAuths(): Promise<AuthRecord> {
  const authPath = getAuthFilePath()
  const data = await Bun.file(authPath)
    .json()
    .catch(() => ({}))
  if (!data || typeof data !== "object") return {}
  const parsed = authRecordSchema.safeParse(data)
  if (!parsed.success) return {}
  return parsed.data as AuthRecord
}

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
