/**
 * Antigravity Proxy provider for usage tracking.
 * Fetches quota stats from a local/remote proxy server.
 */

import type { UsageProvider } from "../base"
import type { UsageSnapshot, ProxyQuota, ProxyProviderInfo, ProxyQuotaGroup, ProxyTierInfo } from "../../types"
import { loadProxyConfig } from "./config"
import { fetchProxyLimits } from "./fetch"
import type { ProxyResponse, Provider, Credential, ModelGroup } from "./types"

export type { ProxyConfig, ProxyResponse } from "./types"
export { loadProxyConfig } from "./config"
export { fetchProxyLimits } from "./fetch"
export { formatProxyLimits } from "./format"

// Mapping of API group names to display names
const GROUP_MAPPING: Record<string, string> = {
  "claude": "claude",
  "g3-pro": "g3-pro",
  "g3-flash": "g3-fla",
  "pro": "g3-pro",      // mapping for gemini_cli
  "3-flash": "g3-fla" // mapping for gemini_cli
}

function normalizeTier(tier?: string): "paid" | "free" {
  if (!tier) return "free"
  return tier.includes("free") ? "free" : "paid"
}

function parseQuotaGroupsFromCredential(
  modelGroups: Record<string, ModelGroup> | undefined,
): ProxyQuotaGroup[] {
  if (!modelGroups) return []
  return Object.entries(modelGroups)
    .filter(([name]) => name in GROUP_MAPPING)
    .map(([name, group]) => {
      // API's remaining_pct is actually used_pct. Calculate real remaining pct.
      const realRemainingPct = group.requests_max > 0 
        ? Math.round((group.requests_remaining / group.requests_max) * 100) 
        : 0
      
      return {
        name: GROUP_MAPPING[name]!,
        remaining: group.requests_remaining,
        max: group.requests_max,
        remainingPct: realRemainingPct,
      }
    })
}

function aggregateByTier(credentials: Credential[]): ProxyTierInfo[] {
  const tiers: Record<"paid" | "free", Map<string, ProxyQuotaGroup>> = {
    paid: new Map(),
    free: new Map(),
  }

  for (const cred of credentials) {
    const tier = normalizeTier(cred.tier)
    const groups = parseQuotaGroupsFromCredential(cred.model_groups)

    for (const group of groups) {
      const existing = tiers[tier].get(group.name)
      if (existing) {
        existing.remaining += group.remaining
        existing.max += group.max
      } else {
        tiers[tier].set(group.name, { ...group })
      }
    }
  }

  // Recalculate percentages
  for (const tierGroups of Object.values(tiers)) {
    for (const group of tierGroups.values()) {
      group.remainingPct = group.max > 0 ? Math.round((group.remaining / group.max) * 100) : 0
    }
  }

  const result: ProxyTierInfo[] = []
  if (tiers.paid.size > 0) {
    result.push({ tier: "paid", quotaGroups: Array.from(tiers.paid.values()) })
  }
  if (tiers.free.size > 0) {
    result.push({ tier: "free", quotaGroups: Array.from(tiers.free.values()) })
  }
  return result
}

function parseProviders(data: ProxyResponse): ProxyProviderInfo[] {
  if (!data.providers) return []
  return Object.entries(data.providers).map(([name, provider]) => ({
    name,
    tiers: aggregateByTier(provider.credentials ?? []),
  }))
}

function parseProxyQuota(data: ProxyResponse): ProxyQuota {
  const summary = data.global_summary ?? data.summary
  return {
    providers: parseProviders(data),
    totalCredentials: summary?.total_credentials ?? 0,
    activeCredentials: summary?.active_credentials ?? 0,
    dataSource: data.data_source,
  }
}

export const ProxyProvider: UsageProvider = {
  id: "proxy",
  displayName: "Mirrowel Proxy",

  async fetchUsage(): Promise<UsageSnapshot | null> {
    try {
      const config = await loadProxyConfig()
      const data = await fetchProxyLimits(config)

      return {
        timestamp: data.timestamp * 1000,
        provider: "proxy",
        planType: null,
        primary: null,
        secondary: null,
        codeReview: null,
        credits: null,
        proxyQuota: parseProxyQuota(data),
        updatedAt: Date.now(),
      }
    } catch {
      return null
    }
  },
}
