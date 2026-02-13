/**
 * Formats Z.ai GLM Coding Plan usage snapshots.
 */

import type { UsageSnapshot } from "../../types"
import { formatBar, formatMissingSnapshot, formatResetSuffix } from "./shared"

export function formatZaiSnapshot(snapshot: UsageSnapshot): string[] {
  const zai = snapshot.zaiQuota
  if (!zai?.limits?.length) return formatMissingSnapshot(snapshot)

  const lines = ["→ [Z.ai] GLM Coding Plan"]

  for (const limit of zai.limits) {
    const isTokens = limit.type === "TOKENS_LIMIT"
    const label = isTokens ? "5 Hours Quota" : "Total Monthly Web Search / Reader / Zread Quota"
    
    const remainingPct = 100 - limit.percentage
    const reset = isTokens 
      ? (limit.nextResetTime ? formatResetSuffix(limit.nextResetTime) : "")
      : " (resets on the 1st)"
    
    lines.push(`  ${label}`)
    lines.push(`  ${formatBar(remainingPct)} ${remainingPct.toFixed(0)}% left${reset}`)
    
    const unit = isTokens ? "Tokens" : "Times"
    const current = (limit.currentValue ?? 0).toLocaleString()
    const total = (limit.usage ?? 0).toLocaleString()
    lines.push(`  Used: ${current} / ${total} ${unit}`)
    lines.push("")
  }

  if (zai.modelUsage) {
    lines.push(`  24h Activity:`)
    const tokens = (zai.modelUsage.totalTokensUsage ?? 0).toLocaleString()
    const calls = (zai.modelUsage.totalModelCallCount ?? 0).toLocaleString()
    lines.push(`    Tokens:       ${tokens}`)
    lines.push(`    Calls:        ${calls}`)
  }

  return lines
}
