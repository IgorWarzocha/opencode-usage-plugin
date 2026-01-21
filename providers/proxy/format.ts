/**
 * Display formatting utilities for proxy limits.
 */

import type { ProxyResponse, Credential } from "./types"

// Mapping of API group names to display names
const GROUP_MAPPING: Record<string, string> = {
  "claude": "claude",
  "g3-pro": "g3-pro",
  "g3-flash": "g3-fla",
  "pro": "g3-pro",      // mapping for gemini_cli
  "3-flash": "g3-fla" // mapping for gemini_cli
}

function formatBar(usedPercent: number): string {
  const clamped = Math.max(0, Math.min(100, usedPercent))
  const size = 20
  const filled = Math.round((clamped / 100) * size)
  const empty = size - filled
  return `[${"=".repeat(filled)}${".".repeat(empty)}]`
}

function normalizeTier(tier?: string): "paid" | "free" {
  if (!tier) return "free"
  return tier.includes("free") ? "free" : "paid"
}

type TierQuotas = Map<string, { remaining: number; max: number }>

function aggregateCredentialsByTier(credentials: Credential[]): { paid: TierQuotas; free: TierQuotas } {
  const result = {
    paid: new Map<string, { remaining: number; max: number }>(),
    free: new Map<string, { remaining: number; max: number }>(),
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
        existing.max += group.max
      } else {
        result[tier].set(mappedName, {
          remaining: group.requests_remaining,
          max: group.requests_max,
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
        lines.push(`    ${groupName}: ${formatBar(remainingPct)} ${quota.remaining}/${quota.max}`)
      }
    }

    lines.push("")
  }

  return lines.join("\n")
}
