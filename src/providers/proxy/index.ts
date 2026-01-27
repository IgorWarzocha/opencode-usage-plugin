/**
 * Antigravity Proxy provider for usage tracking.
 * Fetches quota stats from a local/remote proxy server.
 */

import type { UsageProvider } from "../base"
import type { UsageSnapshot, ProxyQuota, ProxyProviderInfo, ProxyQuotaGroup, ProxyTierInfo } from "../../types"
import { loadUsageConfig } from "../../usage/config"
import { fetchProxyLimits } from "./fetch"
import type { ProxyResponse, Provider, GroupUsage, ModelGroupAggregation } from "./types"

export type { ProxyResponse } from "./types"
export { fetchProxyLimits } from "./fetch"
export { formatProxyLimits } from "./format"

const GROUP_MAPPING: Record<string, string> = {
  "claude": "claude",
  "g3-pro": "g3-pro",
  "g3-flash": "g3-flash",
  "g25-flash": "25-flash",
  "g25-lite": "25-lite",
  "pro": "g3-pro",
  "3-flash": "g3-flash",
  "25-flash": "25-flash",
  "25-lite": "25-lite"
}

const GROUP_ORDER: string[] = ["claude", "g3-pro", "g3-flash", "25-flash", "25-lite"]

function sortQuotaGroups(groups: ProxyQuotaGroup[]): ProxyQuotaGroup[] {
  return groups.sort((a, b) => {
    const aIndex = GROUP_ORDER.indexOf(a.name)
    const bIndex = GROUP_ORDER.indexOf(b.name)
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
    return a.name.localeCompare(b.name)
  })
}

function normalizeTier(tier?: string): "paid" | "free" {
  if (!tier) return "free"
  const t = tier.toLowerCase()
  if (t === "paid" || t === "pro" || t === "premium" || t === "individual" || t.includes("paid")) return "paid"
  return "free"
}

function parseQuotaGroupsFromAggregation(
  quotaGroups: Record<string, ModelGroupAggregation> | undefined,
): ProxyTierInfo[] {
  if (!quotaGroups) return []

  const tiers: Record<"paid" | "free", Map<string, ProxyQuotaGroup>> = {
    paid: new Map(),
    free: new Map(),
  }

  for (const [groupName, groupData] of Object.entries(quotaGroups)) {
    const mappedName = GROUP_MAPPING[groupName]
    if (!mappedName) continue

    const windows = groupData.windows || {}
    const windowPriority = ["daily", "5h", "1h", "15m"]
    
    let bestWindowName: string | null = null
    for (const windowName of windowPriority) {
      if (windows[windowName]) {
        bestWindowName = windowName
        break
      }
    }

    if (!bestWindowName && Object.keys(windows).length > 0) {
      bestWindowName = Object.keys(windows)[0]
    }

    if (!bestWindowName) continue
    const window = windows[bestWindowName]

    // Since these are already aggregated by provider, we split by tier if possible.
    // However, the aggregate API provides tier-agnostic totals. 
    // For now, we put them into "paid" as the default high-level view.
    tiers.paid.set(mappedName, {
      name: mappedName,
      remaining: window.total_remaining,
      max: window.total_max,
      remainingPct: Math.round(window.remaining_pct),
      resetTime: null, // Aggregated windows don't have a single reset_at
    })
  }

  const result: ProxyTierInfo[] = []
  if (tiers.paid.size > 0) {
    result.push({ tier: "paid", quotaGroups: sortQuotaGroups(Array.from(tiers.paid.values())) })
  }
  return result
}

function parseQuotaGroupsFromCredential(
  groupUsage: Record<string, GroupUsage> | undefined,
): ProxyQuotaGroup[] {
  if (!groupUsage) return []

  const result: Map<string, ProxyQuotaGroup> = new Map()

  for (const [groupName, groupData] of Object.entries(groupUsage)) {
    const mappedName = GROUP_MAPPING[groupName]
    if (!mappedName) continue

    const windows = groupData.windows || {}
    let bestWindow: { limit?: number; remaining: number; reset_at?: number | null } | null = null

    const windowPriority = ["daily", "5h", "1h", "15m"]
    for (const windowName of windowPriority) {
      if (windows[windowName]) {
        bestWindow = windows[windowName]
        break
      }
    }

    if (!bestWindow && Object.keys(windows).length > 0) {
      bestWindow = Object.values(windows)[0]
    }

    if (!bestWindow) continue

    result.set(mappedName, {
      name: mappedName,
      remaining: bestWindow.remaining,
      max: bestWindow.limit || bestWindow.remaining,
      remainingPct: bestWindow.limit ? Math.round((bestWindow.remaining / bestWindow.limit) * 100) : 0,
      resetTime: bestWindow.reset_at ? new Date(bestWindow.reset_at * 1000).toISOString() : null,
    })
  }

  return Array.from(result.values())
}

function aggregateByProvider(provider: Provider): ProxyTierInfo[] {
  // Try aggregated quota groups first
  if (provider.quota_groups && Object.keys(provider.quota_groups).length > 0) {
    return parseQuotaGroupsFromAggregation(provider.quota_groups)
  }

  // Fallback to manual aggregation of credentials
  const tiers: Record<"paid" | "free", Map<string, ProxyQuotaGroup>> = {
    paid: new Map(),
    free: new Map(),
  }

  if (provider.credentials) {
    for (const cred of Object.values(provider.credentials)) {
      const tier = normalizeTier(cred.tier)
      const groups = parseQuotaGroupsFromCredential(cred.group_usage)

      for (const group of groups) {
        const existing = tiers[tier].get(group.name)
        if (existing) {
          existing.remaining += group.remaining
          existing.max += group.max
          if (group.resetTime && (!existing.resetTime || new Date(group.resetTime) > new Date(existing.resetTime))) {
            existing.resetTime = group.resetTime
          }
        } else {
          tiers[tier].set(group.name, { ...group })
        }
      }
    }
  }

  for (const tierGroups of Object.values(tiers)) {
    for (const group of tierGroups.values()) {
      group.remainingPct = group.max > 0 ? Math.round((group.remaining / group.max) * 100) : 0
    }
  }

  const result: ProxyTierInfo[] = []
  if (tiers.paid.size > 0) {
    result.push({ tier: "paid", quotaGroups: sortQuotaGroups(Array.from(tiers.paid.values())) })
  }
  if (tiers.free.size > 0) {
    result.push({ tier: "free", quotaGroups: sortQuotaGroups(Array.from(tiers.free.values())) })
  }
  return result
}

function parseProviders(data: ProxyResponse): ProxyProviderInfo[] {
  if (!data.providers) return []

  return Object.entries(data.providers).map(([name, provider]) => {
    return {
      name,
      tiers: aggregateByProvider(provider),
    }
  })
}

function parseProxyQuota(data: ProxyResponse): ProxyQuota {
  const summary = data.summary
  return {
    providers: parseProviders(data),
    totalCredentials: summary?.total_credentials ?? 0,
    activeCredentials: summary?.active_credentials ?? 0,
    dataSource: data.data_source,
  }
}

export const ProxyProvider: UsageProvider<void> = {
  id: "proxy",
  displayName: "Mirrowel Proxy",

  async fetchUsage(): Promise<UsageSnapshot | null> {
    try {
      const config = await loadUsageConfig()
      const data = await fetchProxyLimits(config)

      return {
        timestamp: (data.timestamp || Date.now() / 1000) * 1000,
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
