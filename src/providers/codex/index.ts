/**
 * OpenAI/Codex usage provider for plan and rate-limit snapshots.
 * Uses the /wham/usage endpoint plus rate-limit headers for fallback.
 */

import type { UsageProvider } from "../base"
import { parseCredits, parseWindow } from "./headers"
import { toCreditsSnapshot, toPlanType, toRateLimitWindow, usageResponseSchema } from "./response"

type CodexAuth = {
  access?: string
  accountId?: string
}

export const CodexProvider: UsageProvider<CodexAuth> = {
  id: "codex",
  displayName: "OpenAI",
  usageEndpoint: "https://chatgpt.com/backend-api/wham/usage",

  parseRateLimitHeaders: (headers) => {
    const parsedHeaders = new Headers(headers)
    const primary = parseWindow(parsedHeaders, "primary")
    const secondary = parseWindow(parsedHeaders, "secondary")
    const credits = parseCredits(parsedHeaders)
    if (!primary && !secondary && !credits) return null
    return {
      timestamp: Date.now(),
      updatedAt: Date.now(),
      provider: "codex",
      planType: null,
      primary,
      secondary,
      codeReview: null,
      credits,
    }
  },

  fetchUsage: async (auth) => {
    const accessToken = auth.access
    if (!accessToken) return null
    const response = await fetch("https://chatgpt.com/backend-api/wham/usage", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(auth.accountId ? { "ChatGPT-Account-Id": auth.accountId } : {}),
      },
    }).catch(() => null)
    if (!response?.ok) return null
    const data = await response.json().catch(() => null)
    if (!data) return null
    const parsed = usageResponseSchema.safeParse(data)
    if (!parsed.success) return null

    const rateLimit = parsed.data.rate_limit
    const primary = toRateLimitWindow(rateLimit.primary_window)
    const secondary = toRateLimitWindow(rateLimit.secondary_window)
    const credits = toCreditsSnapshot(parsed.data.credits)
    const codeReview = parsed.data.code_review_rate_limit?.primary_window
      ? toRateLimitWindow(parsed.data.code_review_rate_limit.primary_window)
      : null
    const planType = toPlanType(parsed.data.plan_type)

    return {
      timestamp: Date.now(),
      updatedAt: Date.now(),
      provider: "codex",
      planType,
      primary,
      secondary,
      codeReview,
      credits,
    }
  },
}

export type { CodexAuth }
