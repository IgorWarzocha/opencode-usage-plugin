/**
 * Formats GitHub Copilot usage snapshots.
 * Handles chat and completion quotas with progress bars and reset times.
 */

import type { UsageSnapshot } from "../../types"
import { formatBar, formatResetSuffixISO, formatMissingSnapshot } from "./shared"

export function formatCopilotSnapshot(snapshot: UsageSnapshot): string[] {
  const copilot = snapshot.copilotQuota
  if (!copilot) return formatMissingSnapshot(snapshot)

  const lines = ["→ [GITHUB] Copilot"]
  const reset = copilot.resetTime ? formatResetSuffixISO(copilot.resetTime) : ""
  const total = copilot.total === -1 ? "∞" : copilot.total.toString()
  
  lines.push(`  ${"Chat:".padEnd(13)} ${formatBar(copilot.percentRemaining)} ${copilot.used}/${total}${reset}`)

  if (copilot.completionsUsed !== undefined && copilot.completionsTotal !== undefined) {
    const pct = copilot.completionsTotal > 0 
      ? Math.round((copilot.completionsUsed / copilot.completionsTotal) * 100) 
      : 0
    lines.push(`  ${"Completions:".padEnd(13)} ${formatBar(pct)} ${copilot.completionsUsed}/${copilot.completionsTotal}`)
  }

  return lines
}
