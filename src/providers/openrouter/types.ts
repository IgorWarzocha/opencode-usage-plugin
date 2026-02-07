/**
 * Type definitions for the OpenRouter provider.
 */

export interface OpenRouterAuth {
  key: string
}

export interface OpenRouterAuthResponse {
  data: {
    label: string
    is_management_key: boolean
    is_provisioning_key: boolean
    limit: number
    limit_reset: string | null
    limit_remaining: number
    include_byok_in_limit: boolean
    usage: number
    usage_daily: number
    usage_weekly: number
    usage_monthly: number
    byok_usage: number
    byok_usage_daily: number
    byok_usage_weekly: number
    byok_usage_monthly: number
    is_free_tier: boolean
    expires_at: string | null
    rate_limit: {
      requests: number
      interval: string
      note: string
    }
  }
}
