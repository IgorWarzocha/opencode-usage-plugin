import z from "zod"

export interface AnthropicAuthData {
  access: string
  refresh?: string
  expires?: number
}

export const oauthUsageHeaders = {
  "anthropic-beta": "oauth-2025-04-20",
  "anthropic-dangerous-direct-browser-access": "true",
  "x-app": "cli",
  "user-agent": "claude-cli/2.1.2 (external, cli)",
} as const

const usageWindowSchema = z.object({
  utilization: z.number().nullable().optional(),
  resets_at: z.string().nullable().optional(),
}).passthrough()

const extraUsageSchema = z.object({
  is_enabled: z.boolean().optional().nullable(),
  monthly_limit: z.union([z.number(), z.string()]).optional().nullable(),
  used_credits: z.union([z.number(), z.string()]).optional().nullable(),
  utilization: z.number().optional().nullable(),
}).passthrough()

export const anthropicUsageResponseSchema = z.object({
  five_hour: usageWindowSchema.optional().nullable(),
  seven_day: usageWindowSchema.optional().nullable(),
  seven_day_oauth_apps: usageWindowSchema.optional().nullable(),
  seven_day_opus: usageWindowSchema.optional().nullable(),
  seven_day_sonnet: usageWindowSchema.optional().nullable(),
  seven_day_cowork: usageWindowSchema.optional().nullable(),
  iguana_necktie: usageWindowSchema.optional().nullable(),
  extra_usage: extraUsageSchema.optional().nullable(),
}).passthrough()

export const anthropicProfileResponseSchema = z.object({
  account: z
    .object({
      has_claude_max: z.boolean().optional(),
      has_claude_pro: z.boolean().optional(),
    })
    .passthrough()
    .optional(),
  organization: z
    .object({
      organization_type: z.string().optional().nullable(),
      rate_limit_tier: z.string().optional().nullable(),
      subscription_status: z.string().optional().nullable(),
    })
    .passthrough()
    .optional(),
}).passthrough()

export type AnthropicUsageResponse = z.infer<typeof anthropicUsageResponseSchema>
export type AnthropicProfileResponse = z.infer<typeof anthropicProfileResponseSchema>
export type AnthropicUsageWindow = z.infer<typeof usageWindowSchema>
