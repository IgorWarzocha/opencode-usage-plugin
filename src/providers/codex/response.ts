/**
 * Codex usage response schemas and transformations.
 * Keeps API-specific shapes out of provider logic.
 */

import z from "zod"
import { PlanTypes, type PlanType } from "../../types"

type UsageResponseWindow = {
  used_percent: number
  limit_window_seconds: number
  reset_after_seconds: number
  reset_at: number
}

type UsageResponse = {
  plan_type: string | null
  rate_limit: {
    allowed: boolean
    limit_reached: boolean
    primary_window: UsageResponseWindow | null
    secondary_window: UsageResponseWindow | null
  }
  code_review_rate_limit?: {
    primary_window: UsageResponseWindow | null
  } | null
  credits: {
    has_credits: boolean
    unlimited: boolean
    balance: string | null
  } | null
}

const usageResponseWindowSchema = z.object({
  used_percent: z.number(),
  limit_window_seconds: z.number(),
  reset_after_seconds: z.number(),
  reset_at: z.number(),
})

export const usageResponseSchema = z.object({
  plan_type: z.string().nullable(),
  rate_limit: z.object({
    allowed: z.boolean(),
    limit_reached: z.boolean(),
    primary_window: usageResponseWindowSchema.nullable(),
    secondary_window: usageResponseWindowSchema.nullable(),
  }),
  code_review_rate_limit: z
    .object({
      primary_window: usageResponseWindowSchema.nullable(),
    })
    .nullable()
    .optional(),
  credits: z
    .object({
      has_credits: z.boolean(),
      unlimited: z.boolean(),
      balance: z.string().nullable(),
    })
    .nullable(),
}) satisfies z.ZodType<UsageResponse>

export type ParsedUsageResponse = z.infer<typeof usageResponseSchema>

export function toRateLimitWindow(window: UsageResponseWindow | null) {
  if (!window) return null
  return {
    usedPercent: window.used_percent,
    windowMinutes: Math.round(window.limit_window_seconds / 60),
    resetsAt: window.reset_at,
  }
}

export function toCreditsSnapshot(credits: UsageResponse["credits"]) {
  if (!credits) return null
  return {
    hasCredits: credits.has_credits,
    unlimited: credits.unlimited,
    balance: credits.balance,
  }
}

export function toPlanType(value: UsageResponse["plan_type"]): PlanType | null {
  if (!value) return null
  if (!PlanTypes.includes(value as PlanType)) return null
  return value as PlanType
}
