/**
 * Antigravity Proxy provider for usage tracking.
 * Fetches quota stats from a local/remote proxy server.
 */

import type { UsageProvider } from "../base"
import type { UsageSnapshot, ProxyQuota, ProxyProviderInfo, ProxyQuotaGroup, ProxyTierInfo, UsageConfig } from "../../types"
import { loadUsageConfig } from "../../usage/config"
import { fetchProxyLimits } from "./fetch"
import type { ProxyResponse, Provider, GroupUsage, ModelGroupAggregation } from "./types"

export type { ProxyResponse } from "./types"
export { fetchProxyLimits } from "./fetch"
export { formatProxyLimits } from "./format"

/** Default mapping for backward compatibility when no modelGroups config is present */
const DEFAULT_GROUP_MAPPING: Record<string, string> = {
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

/**
 * Resolve the display name for a model group based on config.
 * Returns null if the group should be filtered out.
 */
export function resolveDisplayName(
  groupName: string,
  config: UsageConfig | null,
): string | null {
  const modelGroupsConfig = config?.modelGroups

  // No config section → backward compat: use hardcoded whitelist
  if (!modelGroupsConfig) {
    return groupName in DEFAULT_GROUP_MAPPING
      ? DEFAULT_GROUP_MAPPING[groupName]!
      : null // filter out
  }

  const showAll = modelGroupsConfig.showAll ?? true // Default to auto-discovery
  const displayNames = modelGroupsConfig.displayNames ?? {}

  if (showAll) {
    // Auto-discovery mode: show all, apply overrides
    return displayNames[groupName] ?? groupName
  } else {
    // Whitelist mode: only show configured groups
    return groupName in displayNames ? displayNames[groupName]! : null
  }
}

function normalizeTier(tier?: string): "paid" | "free" {
  if (!tier) return "free"
  const t = tier.toLowerCase()
  if (t === "paid" || t === "pro" || t === "premium" || t === "individual" || t.includes("paid")) return "paid"
  return "free"
}

function pickPreferredResetTime(current?: string | null, incoming?: string | null): string | null {
  if (!incoming) return current ?? null
  if (!current) return incoming

  const now = Date.now()
  const currentTs = new Date(current).getTime()
  const incomingTs = new Date(incoming).getTime()

  const currentFuture = currentTs > now
  const incomingFuture = incomingTs > now

  if (currentFuture && incomingFuture) {
    return incomingTs < currentTs ? incoming : current
  }

  if (incomingFuture) return incoming
  if (currentFuture) return current

  return incomingTs > currentTs ? incoming : current
}

function parseQuotaGroupsFromAggregation(
  quotaGroups: Record<string, ModelGroupAggregation> | undefined,
  config: UsageConfig | null,
): ProxyTierInfo[] {
  if (!quotaGroups) return []

  const tiers: Record<"paid" | "free", Map<string, ProxyQuotaGroup>> = {
    paid: new Map(),
    free: new Map(),
  }

  for (const [groupName, groupData] of Object.entries(quotaGroups)) {
    const displayName = resolveDisplayName(groupName, config)
    if (displayName === null) continue

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
    const max = window.total_max ?? window.total_remaining
    const remaining = window.total_remaining
    const remainingPct =
      typeof window.remaining_pct === "number"
        ? Math.round(window.remaining_pct)
        : max > 0
          ? Math.round((remaining / max) * 100)
          : 0

    tiers.paid.set(displayName, {
      name: displayName,
      remaining,
      max,
      remainingPct,
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
  config: UsageConfig | null,
): ProxyQuotaGroup[] {
  if (!groupUsage) return []

  const result: Map<string, ProxyQuotaGroup> = new Map()

  for (const [groupName, groupData] of Object.entries(groupUsage)) {
    // Apply config-based filtering and display name resolution
    const displayName = resolveDisplayName(groupName, config)
    if (displayName === null) continue

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

    result.set(displayName, {
      name: displayName,
      remaining: bestWindow.remaining,
      max: bestWindow.limit || bestWindow.remaining,
      remainingPct: bestWindow.limit ? Math.round((bestWindow.remaining / bestWindow.limit) * 100) : 0,
      resetTime: bestWindow.reset_at ? new Date(bestWindow.reset_at * 1000).toISOString() : null,
    })
  }

  return Array.from(result.values())
}

function aggregateByProvider(provider: Provider, config: UsageConfig | null): ProxyTierInfo[] {
  const aggregated =
    provider.quota_groups && Object.keys(provider.quota_groups).length > 0
      ? parseQuotaGroupsFromAggregation(provider.quota_groups, config)
      : []

  // Fallback to manual aggregation of credentials
  const tiers: Record<"paid" | "free", Map<string, ProxyQuotaGroup>> = {
    paid: new Map(),
    free: new Map(),
  }

  if (provider.credentials) {
    for (const cred of Object.values(provider.credentials)) {
      const tier = normalizeTier(cred.tier)
      const groups = parseQuotaGroupsFromCredential(cred.group_usage, config)

      for (const group of groups) {
        const existing = tiers[tier].get(group.name)
        if (existing) {
          existing.remaining += group.remaining
          existing.max += group.max
          existing.resetTime = pickPreferredResetTime(existing.resetTime, group.resetTime)
        } else {
          tiers[tier].set(group.name, { ...group })
        }
      }
    }
  }

  if (aggregated.length > 0) {
    const getTierGroupKey = (tier: "paid" | "free", groupName: string) => `${tier}::${groupName}`
    const resetLookup = new Map<string, string | null>()
    for (const [tierName, tierInfo] of Object.entries(tiers) as Array<["paid" | "free", Map<string, ProxyQuotaGroup>]>) {
      for (const group of tierInfo.values()) {
        const key = getTierGroupKey(tierName, group.name)
        resetLookup.set(key, pickPreferredResetTime(resetLookup.get(key), group.resetTime))
      }
    }

    for (const tier of aggregated) {
      for (const group of tier.quotaGroups) {
        const key = getTierGroupKey(tier.tier, group.name)
        group.resetTime = pickPreferredResetTime(group.resetTime, resetLookup.get(key))
      }
    }

    return aggregated
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

function parseProviders(data: ProxyResponse, config: UsageConfig | null): ProxyProviderInfo[] {
  if (!data.providers) return []

  return Object.entries(data.providers).map(([name, provider]) => {
    return {
      name,
      tiers: aggregateByProvider(provider, config),
    }
  })
}

function parseProxyQuota(data: ProxyResponse, config: UsageConfig | null): ProxyQuota {
  const summary = data.summary
  return {
    providers: parseProviders(data, config),
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
        proxyQuota: parseProxyQuota(data, config),
        updatedAt: Date.now(),
      }
    } catch {
      return null
    }
  },
}
