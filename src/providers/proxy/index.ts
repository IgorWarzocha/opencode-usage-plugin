/**
 * Antigravity Proxy provider for usage tracking.
 * Fetches quota stats from a local/remote proxy server.
 */

import type { UsageProvider } from "../base"
import type { UsageSnapshot, ProxyQuota, ProxyProviderInfo, ProxyQuotaGroup, ProxyTierInfo, UsageConfig } from "../../types"
import { loadUsageConfig } from "../../usage/config"
import { fetchProxyLimits } from "./fetch"
import type { ProxyResponse, Provider, CredentialData, GroupUsage } from "./types"

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
function resolveDisplayName(
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

export const ProxyProvider: UsageProvider = {
  id: "proxy",
  displayName: "Mirrowel Proxy",

  async fetchUsage(): Promise<UsageSnapshot | null> {
    try {
      const config = await loadUsageConfig()
      const data = await fetchProxyLimits(config)

      return {
        timestamp: data.timestamp * 1000,
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
