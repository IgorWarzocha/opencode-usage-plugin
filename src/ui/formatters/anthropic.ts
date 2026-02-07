/**
 * Formats Anthropic usage snapshots.
 * Handles 5-hour and 7-day subscription utilization.
 */

import type { UsageSnapshot } from "../../types"
import { formatBar, formatResetSuffixISO, formatMissingSnapshot } from "./shared"

export function formatAnthropicSnapshot(snapshot: UsageSnapshot): string[] {
  const anthropic = snapshot.anthropicQuota
  if (!anthropic) return formatMissingSnapshot(snapshot)

  const plan = snapshot.planType 
    ? ` (${snapshot.planType.toUpperCase()})` 
    : ""
  const lines = [`→ [ANTHROPIC]${plan}`]

  if (anthropic.fiveHour) {
    const reset = anthropic.fiveHour.resetsAt ? formatResetSuffixISO(anthropic.fiveHour.resetsAt) : ""
    const pctRemaining = 100 - anthropic.fiveHour.utilization
    lines.push(`  ${"5-Hour:".padEnd(13)} ${formatBar(pctRemaining)} ${anthropic.fiveHour.utilization}% used${reset}`)
  }

  if (anthropic.sevenDay) {
    const reset = anthropic.sevenDay.resetsAt ? formatResetSuffixISO(anthropic.sevenDay.resetsAt) : ""
    const pctRemaining = 100 - anthropic.sevenDay.utilization
    lines.push(`  ${"7-Day:".padEnd(13)} ${formatBar(pctRemaining)} ${anthropic.sevenDay.utilization}% used${reset}`)
  }

  if (snapshot.credits?.hasCredits) {
    lines.push(`  ${"Credits:".padEnd(13)} ${snapshot.credits.balance}`)
  }

  return lines
}
