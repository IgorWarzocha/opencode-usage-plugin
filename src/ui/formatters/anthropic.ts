import type { UsageSnapshot } from "../../types"
import { formatBar, formatMissingSnapshot, formatResetSuffixISO } from "./shared"

function toTitleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatExtraUsage(extra: NonNullable<UsageSnapshot["anthropicQuota"]>["extraUsage"]): string[] {
  if (!extra?.isEnabled) return []

  const lines = [
    `  Extra Usage:   ${extra.utilization !== null ? `${extra.utilization.toFixed(0)}% used` : "enabled"}`,
  ]

  if (extra.usedCredits || extra.monthlyLimit) {
    lines.push(`  Credits:       ${extra.usedCredits ?? "-"} / ${extra.monthlyLimit ?? "-"}`)
  }

  return lines
}

export function formatAnthropicSnapshot(snapshot: UsageSnapshot): string[] {
  const quota = snapshot.anthropicQuota
  if (!quota) return formatMissingSnapshot(snapshot)

  const plan = snapshot.planType ? ` (${toTitleCase(snapshot.planType)})` : ""
  const lines = [`→ [ANTHROPIC]${plan}`]

  if (quota.subscription?.rateLimitTier) {
    lines.push(`  Tier:          ${quota.subscription.rateLimitTier}`)
  }

  for (const limit of quota.limits) {
    const leftPercent = Math.max(0, Math.min(100, 100 - limit.utilization))
    lines.push(
      `  ${`${limit.label}:`.padEnd(14)} ${formatBar(leftPercent)} ${leftPercent.toFixed(0)}% left${limit.resetsAt ? formatResetSuffixISO(limit.resetsAt) : ""}`,
    )
  }

  lines.push(...formatExtraUsage(quota.extraUsage))

  if (quota.limits.length === 0 && !quota.extraUsage?.isEnabled) {
    return formatMissingSnapshot(snapshot)
  }

  return lines
}
