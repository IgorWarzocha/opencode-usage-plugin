/**
 * Display formatting utilities for proxy limits.
 */

import type { ProxyResponse, Credential, ModelGroup } from "./types"

// Mapping of API group names to display names
const GROUP_MAPPING: Record<string, string> = {
  "claude": "claude",
  "g3-pro": "g3-pro",
  "g3-flash": "g3-fla",
  "pro": "g3-pro",      // mapping for gemini_cli
  "3-flash": "g3-fla" // mapping for gemini_cli
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

function aggregateCredentialsByTier(credentials: Credential[]): Record<"paid" | "free", Map<string, GroupQuota>> {
  const result = {
    paid: new Map<string, GroupQuota>(),
    free: new Map<string, GroupQuota>(),
  }

  for (const cred of credentials) {
    const tier = normalizeTier(cred.tier)
    const groups = cred.model_groups ?? {}

    for (const [name, group] of Object.entries(groups)) {
      if (!(name in GROUP_MAPPING)) continue
      const mappedName = GROUP_MAPPING[name]!

      const existing = result[tier].get(mappedName)
      if (existing) {
        existing.remaining += group.requests_remaining
        existing.max += group.requests_max
        // Use the furthest reset time for the aggregate view
        if (group.reset_time_iso) {
          if (!existing.resetTime || new Date(group.reset_time_iso) > new Date(existing.resetTime)) {
            existing.resetTime = group.reset_time_iso
          }
        }
      } else {
        result[tier].set(mappedName, {
          remaining: group.requests_remaining,
          max: group.requests_max,
          resetTime: group.reset_time_iso,
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

    const tierData = aggregateCredentialsByTier(provider.credentials ?? [])

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
