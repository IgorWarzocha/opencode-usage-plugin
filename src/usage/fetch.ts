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
  
  const coreProviders = ["codex", "proxy", "copilot"]
  const fetchedProviders = new Set<string>()

  const fetches = entries
    .filter((entry) => !targetProvider || entry.providerID === targetProvider)
    .filter((entry) => isProviderEnabled(entry.providerID))
    .map(async (entry) => {
      const provider = providers[entry.providerID]
      if (!provider?.fetchUsage) return
      try {
        const snapshot = await provider.fetchUsage(entry.auth)
        if (snapshot) {
          snapshots.push(snapshot)
          fetchedProviders.add(entry.providerID)
        }
      } catch {
      }
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
              if (snapshot) {
                snapshots.push(snapshot)
                fetchedProviders.add(id)
              }
            })
            .catch(() => {}),
        )
      }
    }
  }

  await Promise.race([Promise.all(fetches), timeout(5000)])

  for (const id of coreProviders) {
    if (isProviderEnabled(id) && !fetchedProviders.has(id)) {
      if (!targetProvider || targetProvider === id) {
        snapshots.push({
          timestamp: Date.now(),
          provider: id,
          planType: null,
          primary: null,
          secondary: null,
          codeReview: null,
          credits: null,
          updatedAt: Date.now(),
          isMissing: true,
        })
      }
    }
  }

  return snapshots
}

export async function loadAuths(): Promise<AuthRecord> {
  const possiblePaths = getPossibleAuthPaths()
  const mergedAuth: AuthRecord = {}

  for (const authPath of possiblePaths.reverse()) {
    try {
      const file = Bun.file(authPath)
      if (!(await file.exists())) continue
      
      const data = await file.json()
      if (data && typeof data === "object") {
        if (authPath.includes(".codex")) {
          const codexAuth = transformCodexAuth(data)
          if (codexAuth) {
            Object.assign(mergedAuth, codexAuth)
          }
          continue
        }

        const parsed = authRecordSchema.safeParse(data)
        if (parsed.success) {
          Object.assign(mergedAuth, parsed.data)
        }
      }
    } catch {
      continue
    }
  }

  return mergedAuth
}

function transformCodexAuth(data: unknown): AuthRecord | null {
  const codexAuthSchema = z.object({
    tokens: z.object({
      access_token: z.string(),
      account_id: z.string().optional(),
      refresh_token: z.string().optional(),
    }),
  })

  const parsed = codexAuthSchema.safeParse(data)
  if (!parsed.success) return null

  const { access_token, account_id, refresh_token } = parsed.data.tokens

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
