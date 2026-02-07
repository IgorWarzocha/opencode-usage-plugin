import type { AnthropicQuota, PlanType } from "../../types.js"
import type { AnthropicProfileResponse, AnthropicUsageResponse, AnthropicUsageWindow } from "./types.js"

const KNOWN_LIMIT_ORDER = [
  "five_hour",
  "seven_day",
  "seven_day_oauth_apps",
  "seven_day_sonnet",
  "seven_day_opus",
  "seven_day_cowork",
  "iguana_necktie",
] as const

const LIMIT_LABELS: Record<string, string> = {
  five_hour: "5-Hour",
  seven_day: "7-Day (All)",
  seven_day_oauth_apps: "7-Day (OAuth Apps)",
  seven_day_sonnet: "7-Day (Sonnet)",
  seven_day_opus: "7-Day (Opus)",
  seven_day_cowork: "7-Day (Co-work)",
  iguana_necktie: "Iguana Necktie",
}

function humanizeKey(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((token) => token[0]?.toUpperCase() + token.slice(1))
    .join(" ")
}

function toPercent(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  return null
}

function isUsageWindow(value: unknown): value is AnthropicUsageWindow {
  if (!value || typeof value !== "object") return false
  return "utilization" in value || "resets_at" in value
}

function getOrderedLimitKeys(raw: Record<string, unknown>): string[] {
  const known = KNOWN_LIMIT_ORDER.filter((k) => k in raw)
  const extras = Object.keys(raw).filter((k) => !KNOWN_LIMIT_ORDER.includes(k as (typeof KNOWN_LIMIT_ORDER)[number]))
  return [...known, ...extras]
}

export function inferAnthropicPlanType(profile: AnthropicProfileResponse | null): PlanType | null {
  const account = profile?.account
  const organization = profile?.organization
  const orgType = (organization?.organization_type || "").toLowerCase()
  const tier = (organization?.rate_limit_tier || "").toLowerCase()

  if (tier.includes("max_20")) return "max_20x"
  if (tier.includes("max_5")) return "max_5x"
  if (orgType.includes("max")) return "max"
  if (orgType.includes("enterprise")) return "enterprise"
  if (orgType.includes("team")) return "team"
  if (orgType.includes("pro")) return "pro"
  if (account?.has_claude_max) return "max"
  if (account?.has_claude_pro) return "pro"
  return null
}

export function buildAnthropicQuota(usage: AnthropicUsageResponse, profile: AnthropicProfileResponse | null): AnthropicQuota {
  const raw = usage as Record<string, unknown>
  const limits: AnthropicQuota["limits"] = []

  for (const key of getOrderedLimitKeys(raw)) {
    if (key === "extra_usage") continue
    const candidate = raw[key]
    if (!isUsageWindow(candidate)) continue

    const utilization = typeof candidate.utilization === "number" ? toPercent(candidate.utilization) : null
    const resetsAt = asString(candidate.resets_at)
    if (utilization === null && resetsAt === null) continue

    limits.push({
      key,
      label: LIMIT_LABELS[key] ?? humanizeKey(key),
      utilization: utilization ?? 0,
      resetsAt,
    })
  }

  const extraRaw = usage.extra_usage as Record<string, unknown> | null | undefined

  return {
    limits,
    extraUsage: extraRaw
      ? {
          isEnabled: extraRaw.is_enabled === true,
          monthlyLimit: asString(extraRaw.monthly_limit),
          usedCredits: asString(extraRaw.used_credits),
          utilization: typeof extraRaw.utilization === "number" ? toPercent(extraRaw.utilization) : null,
        }
      : null,
    subscription: {
      organizationType: profile?.organization?.organization_type || null,
      rateLimitTier: profile?.organization?.rate_limit_tier || null,
      subscriptionStatus: profile?.organization?.subscription_status || null,
      hasClaudeMax: profile?.account?.has_claude_max === true,
      hasClaudePro: profile?.account?.has_claude_pro === true,
    },
  }
}
