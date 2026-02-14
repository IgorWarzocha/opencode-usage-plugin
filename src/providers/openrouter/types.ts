/**
 * Type definitions for the OpenRouter provider.
 */

import z from "zod"

export interface OpenRouterAuth {
  key: string
  keyName?: string
}

export const openRouterAuthResponseSchema = z.object({
  data: z.object({
    label: z.string().optional(),
    is_management_key: z.boolean().optional(),
    is_provisioning_key: z.boolean().optional(),
    limit: z.number().nullable(),
    limit_reset: z.string().nullable().optional(),
    limit_remaining: z.number().nullable(),
    include_byok_in_limit: z.boolean().optional(),
    usage: z.number(),
    usage_daily: z.number().optional().default(0),
    usage_weekly: z.number().optional().default(0),
    usage_monthly: z.number().optional().default(0),
    byok_usage: z.number().optional(),
    byok_usage_daily: z.number().optional(),
    byok_usage_weekly: z.number().optional(),
    byok_usage_monthly: z.number().optional(),
    is_free_tier: z.boolean().optional().default(false),
    expires_at: z.string().nullable().optional(),
    rate_limit: z
      .object({
        requests: z.number().optional(),
        interval: z.string().optional(),
        note: z.string().optional(),
      })
      .optional(),
  }),
})

export type OpenRouterAuthResponse = z.infer<typeof openRouterAuthResponseSchema>
