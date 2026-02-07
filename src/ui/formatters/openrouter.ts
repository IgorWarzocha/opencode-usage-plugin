/**
 * Formats OpenRouter usage snapshots.
 */

import type { UsageSnapshot } from "../../types"
import { formatBar, formatMissingSnapshot, formatResetSuffix } from "./shared"

export function formatOpenRouterSnapshot(snapshot: UsageSnapshot): string[] {
  if (snapshot.isMissing) return formatMissingSnapshot(snapshot)
  const or = snapshot.openrouterQuota
  if (!or) return formatMissingSnapshot(snapshot)

  const LABEL_WIDTH = 12
  const lines = ["→ [OPENROUTER]"]

  const padLabel = (label: string) => (label + ":").padEnd(LABEL_WIDTH)

  if (or.limit === -1) {
    lines.push(`  ${padLabel("Credit")} Unlimited`)
    lines.push(`  ${padLabel("Used")} $${or.usage.toFixed(2)}`)
  } else {
    // Robustly handle missing primary or limit=0 cases
    const primary = snapshot.primary
    const remainingPct = primary ? Math.max(0, 100 - primary.usedPercent) : 0
    const resetSuffix = primary ? formatResetSuffix(primary.resetsAt) : ""

    lines.push(`  ${padLabel("Credit")} ${formatBar(remainingPct)} ${remainingPct.toFixed(0)}% left`)
    lines.push(`  ${padLabel("Used")} $${or.usage.toFixed(2)} / $${or.limit.toFixed(2)}`)
    lines.push(`  ${padLabel("Remaining")} $${or.limitRemaining.toFixed(2)}${resetSuffix}`)

    if (snapshot.missingReason && or.limit === 0) {
      lines.push(`  Note: ${snapshot.missingReason}`)
    }
  }

  return lines
}
