/**
 * Formats OpenRouter usage snapshots.
 */

import type { UsageSnapshot } from "../../types"
import { formatBar, formatMissingSnapshot, formatResetSuffix } from "./shared"

export function formatOpenRouterSnapshot(snapshot: UsageSnapshot): string[] {
  const or = snapshot.openrouterQuota
  if (!or) return formatMissingSnapshot(snapshot)

  const lines = ["→ [OPENROUTER]"]

  if (or.limit === -1) {
    lines.push(`  ${"Credit:".padEnd(13)} Unlimited`)
    lines.push(`  ${"Used:".padEnd(13)} $${or.usage.toFixed(2)}`)
  } else {
    const remainingPct = snapshot.primary ? 100 - snapshot.primary.usedPercent : 100
    const resetSuffix = snapshot.primary ? formatResetSuffix(snapshot.primary.resetsAt) : ""

    lines.push(`  ${"Credit:".padEnd(13)} ${formatBar(remainingPct)} ${remainingPct.toFixed(0)}% left`)
    lines.push(`  ${"Used:".padEnd(13)} $${or.usage.toFixed(2)} / $${or.limit.toFixed(2)}`)
    lines.push(`  ${"Remaining:".padEnd(13)} $${or.limitRemaining.toFixed(2)}${resetSuffix}`)
  }

  return lines
}
