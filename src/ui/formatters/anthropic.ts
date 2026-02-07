import type { UsageSnapshot } from "../../types"
import { formatBar, formatMissingSnapshot, formatResetSuffixISO } from "./shared"

function toTitleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatTierLabel(tier: string | null | undefined): string | null {
  if (!tier) return null

  const known: Record<string, string> = {
    default_claude_ai: "Claude Pro",
    default_claude_max_5x: "Claude Max 5x",
    default_claude_max_20x: "Claude Max 20x",
  }

  if (known[tier]) return known[tier]

  if (tier.startsWith("default_claude_")) {
    return toTitleCase(tier.replace(/^default_claude_/, "Claude "))
  }

  return toTitleCase(tier)
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

function shouldShowTier(planType: UsageSnapshot["planType"], tierLabel: string | null): boolean {
  if (!tierLabel) return false
  if (!planType) return true

  const plan = planType.toLowerCase()
  const tier = tierLabel.toLowerCase()

  if (plan === "pro" && tier.includes("pro")) return false
  if (plan === "max" && tier.includes("max")) return false
  if (plan === "max_5x" && tier.includes("max") && tier.includes("5x")) return false
  if (plan === "max_20x" && tier.includes("max") && tier.includes("20x")) return false
  if (plan === "team" && tier.includes("team")) return false
  if (plan === "enterprise" && tier.includes("enterprise")) return false

  return true
}

export function formatAnthropicSnapshot(snapshot: UsageSnapshot): string[] {
  const quota = snapshot.anthropicQuota
  if (!quota) return formatMissingSnapshot(snapshot)

  const plan = snapshot.planType ? ` (${toTitleCase(snapshot.planType)})` : ""
  const lines = [`→ [ANTHROPIC]${plan}`]

  const tierLabel = formatTierLabel(quota.subscription?.rateLimitTier)
  if (shouldShowTier(snapshot.planType, tierLabel)) {
    lines.push(`  Tier:          ${tierLabel}`)
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
