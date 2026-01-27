/**
 * Formats Mirrowel Proxy usage snapshots.
 * Handles multi-provider and multi-tier quota reporting with progress bars.
 */

import type { UsageSnapshot } from "../../types"
import { formatBar, formatResetSuffixISO, formatMissingSnapshot } from "./shared"

export function formatProxySnapshot(snapshot: UsageSnapshot): string[] {
  const proxy = snapshot.proxyQuota
  if (!proxy?.providers?.length) return formatMissingSnapshot(snapshot)

  const lines = ["→ [Google] Mirrowel Proxy"]

  for (const provider of proxy.providers) {
    const providerLines = formatProxyProvider(provider)
    if (providerLines.length) {
      lines.push("", `  ${provider.name}:`, ...providerLines)
    }
  }

  return lines
}

function formatProxyProvider(provider: any): string[] {
  const lines: string[] = []
  for (const tier of provider.tiers) {
    if (!tier.quotaGroups?.length) continue
    
    lines.push(`    ${tier.tier === "paid" ? "Paid" : "Free"}:`)
    for (const group of tier.quotaGroups) {
      const reset = group.resetTime ? formatResetSuffixISO(group.resetTime) : ""
      lines.push(`      ${group.name.padEnd(9)} ${formatBar(group.remainingPct)} ${group.remaining}/${group.max}${reset}`)
    }
  }
  return lines
}
