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

  // limit of -1 means unlimited
  if (limit < 0) return null

  // Ensure usedPercent doesn't exceed 100 in the window object, 
  // although the bar formatter handles it, it's better to be safe.
  // If limit is 0, we treat it as 100% used.
  const usedPercent = limit === 0 ? 100 : Math.min(100, (usage / limit) * 100)

  return {
    usedPercent,
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

      const snapshot: UsageSnapshot = {
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

      if (data.data.limit === 0) {
        snapshot.missingReason = "No quota assigned or credit limit reached"
      }

      return snapshot
    } catch (error) {
      return {
        timestamp: Date.now(),
        provider: "openrouter",
        planType: null,
        primary: null,
        secondary: null,
        codeReview: null,
        credits: null,
        updatedAt: Date.now(),
        isMissing: true,
        missingReason: error instanceof Error ? error.message : "Unknown error",
      }
    }
  },
}
