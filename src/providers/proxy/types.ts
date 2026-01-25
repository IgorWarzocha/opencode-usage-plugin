/**
 * Type definitions for the Antigravity proxy provider.
 */

/** Configuration stored in ~/.config/opencode/usage-config.jsonc */
export type ProxyConfig = {
  endpoint: string
  apiKey?: string
  timeout?: number
  providers?: {
    openai?: boolean
    proxy?: boolean
    copilot?: boolean
  }
}

/** Token statistics from the proxy */
export type TokenStats = {
  input_cached?: number
  input_uncached?: number
  input_cache_pct?: number
  output?: number
  prompt_tokens?: number
  completion_tokens?: number
  thinking_tokens?: number
  output_tokens?: number
  prompt_tokens_cache_read?: number
  prompt_tokens_cache_write?: number
  total_tokens?: number
  request_count?: number
  success_count?: number
  failure_count?: number
  approx_cost?: number
}

/** Window-based quota information */
export type WindowQuota = {
  limit?: number
  remaining: number
  reset_at?: number | null
  request_count?: number
  success_count?: number
  failure_count?: number
  total_used?: number
  total_remaining?: number
  total_max?: number
  remaining_pct?: number
}

/** Model group usage information */
export type GroupUsageWindow = {
  [windowName: string]: WindowQuota
}

export type GroupUsage = {
  windows: GroupUsageWindow
  totals: TokenStats
  fair_cycle_exhausted?: boolean
  fair_cycle_reason?: string | null
  cooldown_remaining?: number | null
  cooldown_source?: string | null
  custom_cap?: number | null
}

/** Model usage information */
export type ModelUsage = {
  windows: GroupUsageWindow
  totals: TokenStats
}

/** Tier availability info */
export type TierAvailability = {
  total: number
  available: number
}

/** Tier window info */
export type TierWindow = {
  total_used: number
  total_remaining: number
  total_max: number
  remaining_pct: number
  tier_availability: Record<string, TierAvailability>
}

/** Model group tiers */
export type GroupTiers = {
  [tierName: string]: {
    priority: number
    total: number
  }
}

/** Fair cycle summary */
export type FairCycleSummary = {
  exhausted_count: number
  total_count: number
}

/** Model group aggregation */
export type ModelGroupAggregation = {
  tiers: GroupTiers
  windows: {
    [windowName: string]: TierWindow
  }
  fair_cycle_summary: FairCycleSummary
}

/** Credential information from new API */
export type CredentialData = {
  stable_id: string
  accessor_masked?: string
  full_path: string
  identifier: string
  email?: string | null
  tier?: string
  priority?: number
  active_requests?: number
  status: string
  totals: TokenStats
  model_usage?: Record<string, ModelUsage>
  group_usage?: Record<string, GroupUsage>
  last_used_at?: number
  first_used_at?: number
}

/** Provider information from new API */
export type Provider = {
  provider: string
  credential_count: number
  rotation_mode?: string
  credentials: Record<string, CredentialData>
  quota_groups?: Record<string, ModelGroupAggregation>
}

/** Summary statistics from new API */
export type Summary = {
  total_providers?: number
  total_credentials: number
  active_credentials: number
  exhausted_credentials?: number
  total_requests: number
  tokens: TokenStats
  approx_total_cost: number | null
}

/** Proxy limits response structure from /v1/quota-stats */
export type ProxyResponse = {
  providers: Record<string, Provider>
  summary: Summary
  data_source: string
  timestamp: number
}
