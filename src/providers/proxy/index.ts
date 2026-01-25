/**
 * Antigravity Proxy provider for usage tracking.
 * Fetches quota stats from a local/remote proxy server.
 */

import type { UsageProvider } from "../base"
import type { UsageSnapshot, ProxyQuota, ProxyProviderInfo, ProxyQuotaGroup, ProxyTierInfo } from "../../types"
import { loadUsageConfig } from "../../usage/config"
import { fetchProxyLimits } from "./fetch"
import type { ProxyResponse, Provider, CredentialData, GroupUsage } from "./types"

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

// Display name ordering priority
const GROUP_ORDER: string[] = ["claude", "g3-pro", "g3-flash", "25-flash", "25-lite"]

function sortQuotaGroups(groups: ProxyQuotaGroup[]): ProxyQuotaGroup[] {
  return groups.sort((a, b) => {
    const aIndex = GROUP_ORDER.indexOf(a.name)
    const bIndex = GROUP_ORDER.indexOf(b.name)
    // Both in priority list: sort by index
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
    // Only a in priority list: a comes first
    if (aIndex !== -1) return -1
    // Only b in priority list: b comes first
    if (bIndex !== -1) return 1
    // Neither in priority list: alphabetical
    return a.name.localeCompare(b.name)
  })
}

function normalizeTier(tier?: string): "paid" | "free" {
  if (!tier) return "free"
  return tier.includes("free") ? "free" : "paid"
}

/**
 * Extract quota groups from group_usage data
 * New API structure: group_usage[groupName].windows[windowName]
 */
function parseQuotaGroupsFromCredential(
  groupUsage: Record<string, GroupUsage> | undefined,
): ProxyQuotaGroup[] {
  if (!groupUsage) return []

  const result: Map<string, ProxyQuotaGroup> = new Map()

  for (const [groupName, groupData] of Object.entries(groupUsage)) {
    const mappedName = GROUP_MAPPING[groupName]
    if (!mappedName) continue

    // Find the window with the best data (prefer daily, then 5h, then any)
    const windows = groupData.windows || {}
    let bestWindow: { limit?: number; remaining: number; reset_at?: number | null } | null = null

    // Priority order for windows
    const windowPriority = ["daily", "5h", "1h", "15m"]
    for (const windowName of windowPriority) {
      if (windows[windowName]) {
        bestWindow = windows[windowName]
        break
      }
    }

    // Fallback to any available window
    if (!bestWindow && Object.keys(windows).length > 0) {
      bestWindow = Object.values(windows)[0]
    }

    if (!bestWindow) continue

    const existing = result.get(mappedName)
    if (existing) {
      existing.remaining += bestWindow.remaining
      existing.max += bestWindow.limit || 0
      // Use the latest reset time
      if (bestWindow.reset_at) {
        const newResetTime = new Date(bestWindow.reset_at * 1000).toISOString()
        if (!existing.resetTime || new Date(newResetTime) > new Date(existing.resetTime)) {
          existing.resetTime = newResetTime
        }
      }
    } else {
      result.set(mappedName, {
        name: mappedName,
        remaining: bestWindow.remaining,
        max: bestWindow.limit || bestWindow.remaining,
        remainingPct: bestWindow.limit ? Math.round((bestWindow.remaining / bestWindow.limit) * 100) : 0,
        resetTime: bestWindow.reset_at ? new Date(bestWindow.reset_at * 1000).toISOString() : null,
      })
    }
  }

  return Array.from(result.values())
}

function aggregateByTier(credentials: CredentialData[]): ProxyTierInfo[] {
  const tiers: Record<"paid" | "free", Map<string, ProxyQuotaGroup>> = {
    paid: new Map(),
    free: new Map(),
  }

  for (const cred of credentials) {
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
    // Convert credentials object to array
    const credentialsArray = Object.values(provider.credentials || {})

    return {
      name,
      tiers: aggregateByTier(credentialsArray),
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
        proxyQuota: parseProxyQuota(data),
        updatedAt: Date.now(),
      }
    } catch {
      return null
    }
  },
}
