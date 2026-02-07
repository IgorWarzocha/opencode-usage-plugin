/**
 * providers/openrouter/index.ts
 * Main entry point for the OpenRouter usage provider.
 */

import type { UsageProvider } from "../base"
import type { UsageSnapshot, RateLimitWindow } from "../../types"
import { fetchOpenRouterUsage } from "./fetch"
import type { OpenRouterAuth, OpenRouterAuthResponse } from "./types"

function toRateLimitWindow(data: OpenRouterAuthResponse): RateLimitWindow | null {
  const limit = data.data.limit
  const usage = data.data.usage
  const remaining = data.data.limit_remaining

  if (limit <= 0) return null

  return {
    usedPercent: (usage / limit) * 100,
    windowMinutes: null,
    resetsAt: data.data.limit_reset ? new Date(data.data.limit_reset).getTime() : null,
  }
}

export const OpenRouterProvider: UsageProvider<OpenRouterAuth> = {
  id: "openrouter",
  displayName: "OpenRouter",

  async fetchUsage(auth: OpenRouterAuth): Promise<UsageSnapshot | null> {
    try {
      const data = await fetchOpenRouterUsage(auth)
      const now = Date.now()

      return {
        timestamp: now,
        provider: "openrouter",
        planType: data.data.is_free_tier ? "free" : "plus",
        primary: toRateLimitWindow(data),
        secondary: null,
        codeReview: null,
        credits: {
          hasCredits: true,
          unlimited: data.data.limit === -1,
          balance: data.data.limit === -1 ? "Unlimited" : `$${data.data.limit_remaining.toFixed(2)}`,
        },
        updatedAt: now,
        openrouterQuota: {
          limit: data.data.limit,
          usage: data.data.usage,
          limitRemaining: data.data.limit_remaining,
          usageDaily: data.data.usage_daily,
          usageWeekly: data.data.usage_weekly,
          usageMonthly: data.data.usage_monthly,
          isFreeTier: data.data.is_free_tier,
        },
      }
    } catch (error) {
      console.error("Failed to fetch OpenRouter usage:", error)
      return null
    }
  },
}
