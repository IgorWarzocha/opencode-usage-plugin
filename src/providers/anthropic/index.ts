import type { UsageProvider } from "../base.js"
import type { UsageSnapshot, AnthropicQuota, PlanType } from "../../types.js"
import { readAnthropicAuth } from "./auth.js"
import type { AnthropicProfileResponse, AnthropicUsageResponse } from "./types.js"

const ANTHROPIC_API_BASE = "https://api.anthropic.com/api"
const USAGE_URL = `${ANTHROPIC_API_BASE}/oauth/usage`
const PROFILE_URL = `${ANTHROPIC_API_BASE}/oauth/profile`
const BETA_HEADER = "oauth-2025-04-20"
const USER_AGENT = "claude-code/2.0.32"

export const AnthropicProvider: UsageProvider<void> = {
  id: "anthropic",
  displayName: "Anthropic",

  async fetchUsage(): Promise<UsageSnapshot | null> {
    const auth = await readAnthropicAuth()
    if (!auth?.access) return null

    const now = Date.now()
    try {
      const [profileRes, usageRes] = await Promise.all([
        fetch(PROFILE_URL, {
          headers: {
            "Authorization": `Bearer ${auth.access}`,
            "anthropic-beta": BETA_HEADER,
            "User-Agent": USER_AGENT,
            "Accept": "application/json"
          }
        }),
        fetch(USAGE_URL, {
          headers: {
            "Authorization": `Bearer ${auth.access}`,
            "anthropic-beta": BETA_HEADER,
            "User-Agent": USER_AGENT,
            "Accept": "application/json"
          }
        })
      ])

      if (!profileRes.ok || !usageRes.ok) {
        console.error(`Anthropic API error: profile=${profileRes.status}, usage=${usageRes.status}`)
        return null
      }

      const profile = (await profileRes.json()) as AnthropicProfileResponse
      const usage = (await usageRes.json()) as AnthropicUsageResponse

      let planType: PlanType = "free"
      if (profile.account.has_claude_max || profile.organization.organization_type === "claude_max") {
        planType = "max"
      } else if (profile.account.has_claude_pro || profile.organization.organization_type === "claude_pro") {
        planType = "pro"
      }

      const anthropicQuota: AnthropicQuota = {
        subscriptionType: planType,
        fiveHour: usage.five_hour ? {
          utilization: usage.five_hour.utilization,
          resetsAt: usage.five_hour.resets_at
        } : undefined,
        sevenDay: usage.seven_day ? {
          utilization: usage.seven_day.utilization,
          resetsAt: usage.seven_day.resets_at
        } : undefined
      }

      return {
        timestamp: now,
        provider: "anthropic",
        planType,
        primary: null,
        secondary: null,
        codeReview: null,
        credits: usage.extra_usage?.is_enabled ? {
          hasCredits: true,
          unlimited: false,
          balance: usage.extra_usage.used_credits !== null ? `${usage.extra_usage.used_credits}` : null
        } : null,
        anthropicQuota,
        updatedAt: now
      }
    } catch (e) {
      console.error("Failed to fetch Anthropic usage:", e)
      return null
    }
  }
}
