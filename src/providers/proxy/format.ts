/**
 * Display formatting utilities for proxy limits.
 */

import type { ProxyResponse, CredentialData, GroupUsage } from "./types"

const GROUP_MAPPING: Record<string, string> = {
  "claude": "claude",
  "g3-pro": "g3-pro",
  "g3-flash": "g3-fla",
  "pro": "g3-pro",
  "3-flash": "g3-fla"
}

function formatBar(remainingPercent: number): string {
  const clamped = Math.max(0, Math.min(100, remainingPercent))
  const size = 20
  const filled = Math.round((clamped / 100) * size)
  const empty = size - filled
  return `[${"=".repeat(filled)}${".".repeat(empty)}]`
}

function normalizeTier(tier?: string): "paid" | "free" {
  if (!tier) return "free"
  return tier.includes("free") ? "free" : "paid"
}

function formatResetTime(isoString: string | null): string {
  if (!isoString) return ""
  try {
    const resetAt = new Date(isoString).getTime() / 1000
    const now = Math.floor(Date.now() / 1000)
    const diff = resetAt - now
    if (diff <= 0) return ""
    if (diff < 60) return ` (resets in ${diff}s)`
    if (diff < 3600) return ` (resets in ${Math.ceil(diff / 60)}m)`
    if (diff < 86400) return ` (resets in ${Math.round(diff / 3600)}h)`
    return ` (resets in ${Math.round(diff / 86400)}d)`
  } catch {
    return ""
  }
}

type GroupQuota = {
  remaining: number
  max: number
  resetTime: string | null
}

function aggregateCredentialsByTier(credentials: CredentialData[]): Record<"paid" | "free", Map<string, GroupQuota>> {
  const result = {
    paid: new Map<string, GroupQuota>(),
    free: new Map<string, GroupQuota>(),
  }

  for (const cred of credentials) {
    const tier = normalizeTier(cred.tier)
    const groupUsage = cred.group_usage ?? {}

    for (const [name, groupData] of Object.entries(groupUsage)) {
      if (!(name in GROUP_MAPPING)) continue
      const mappedName = GROUP_MAPPING[name]!

      // Find the best window from group_usage
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

      const existing = result[tier].get(mappedName)
      if (existing) {
        existing.remaining += bestWindow.remaining
        existing.max += bestWindow.limit || 0
        if (bestWindow.reset_at) {
          const newResetTime = new Date(bestWindow.reset_at * 1000).toISOString()
          if (!existing.resetTime || new Date(newResetTime) > new Date(existing.resetTime)) {
            existing.resetTime = newResetTime
          }
        }
      } else {
        result[tier].set(mappedName, {
          remaining: bestWindow.remaining,
          max: bestWindow.limit || bestWindow.remaining,
          resetTime: bestWindow.reset_at ? new Date(bestWindow.reset_at * 1000).toISOString() : null,
        })
      }
    }
  }

  return result
}

export function formatProxyLimits(data: ProxyResponse): string {
  const lines: string[] = []

  lines.push("[Google] Mirrowel Proxy")
  lines.push("")

  if (!data.providers || Object.keys(data.providers).length === 0) {
    lines.push("No provider data available")
    return lines.join("\n")
  }

  for (const [providerName, provider] of Object.entries(data.providers)) {
    lines.push(`${providerName}:`)

    const credentialsArray = Object.values(provider.credentials ?? {})
    const tierData = aggregateCredentialsByTier(credentialsArray)

    for (const [tierName, quotas] of Object.entries(tierData)) {
      if (quotas.size === 0) continue

      const tierLabel = tierName === "paid" ? "Paid" : "Free"
      lines.push(`  ${tierLabel}:`)

      for (const [groupName, quota] of quotas) {
        const remainingPct = quota.max > 0 ? (quota.remaining / quota.max) * 100 : 0
        const resetSuffix = quota.remaining === 0 ? formatResetTime(quota.resetTime) : ""
        lines.push(`    ${groupName}: ${formatBar(remainingPct)} ${quota.remaining}/${quota.max}${resetSuffix}`)
      }
    }

    lines.push("")
  }

  return lines.join("\n")
}
