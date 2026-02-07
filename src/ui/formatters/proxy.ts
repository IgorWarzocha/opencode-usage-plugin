/**
 * Formats Mirrowel Proxy usage snapshots.
 * Handles multi-provider and multi-tier quota reporting with progress bars.
 */

import type { UsageSnapshot } from "../../types"
import { formatBar, formatResetSuffixISO, formatMissingSnapshot } from "./shared"

type ProxyProviderView = NonNullable<UsageSnapshot["proxyQuota"]>["providers"][number]
type ProxyTierView = ProxyProviderView["tiers"][number]
type ProxyGroupView = ProxyTierView["quotaGroups"][number]

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

function formatProxyProvider(provider: ProxyProviderView): string[] {
  const lines: string[] = []
  for (const tier of provider.tiers) {
    if (!tier.quotaGroups?.length) continue

    lines.push(`    ${tier.tier === "paid" ? "Paid" : "Free"}:`)
    lines.push(...formatTierGroups(tier.quotaGroups))
  }
  return lines
}

function formatTierGroups(groups: ProxyGroupView[]): string[] {
  const nameWidth = Math.max(...groups.map(group => group.name.length), 9)
  const quotaWidth = Math.max(...groups.map(group => `${group.remaining}/${group.max}`.length), 7)

  return groups.map(group => {
    const reset = group.resetTime ? formatResetSuffixISO(group.resetTime) : ""
    const quota = `${group.remaining}/${group.max}`.padStart(quotaWidth)
    return `      ${group.name.padEnd(nameWidth)} ${formatBar(group.remainingPct)} ${quota}${reset}`
  })
}
