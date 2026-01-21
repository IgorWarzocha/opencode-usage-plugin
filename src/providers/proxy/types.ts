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
  }
}

/** Token statistics from the proxy */
export type TokenStats = {
  input_cached: number
  input_uncached: number
  input_cache_pct: number
  output: number
}

/** Quota group aggregation */
export type QuotaGroup = {
  avg_remaining_pct: number
  credentials_exhausted: number
  credentials_total: number
  models: string[]
  tiers: Record<string, { active: number; priority: number; total: number }>
  total_remaining_pct: number
  total_requests_max: number
  total_requests_remaining: number
  total_requests_used: number
}

/** Model quota information */
export type ModelQuota = {
  requests: number
  request_count: number
  success_count: number
  failure_count: number
  prompt_tokens: number
  prompt_tokens_cached: number
  completion_tokens: number
  approx_cost: number
  window_start_ts: number | null
  quota_reset_ts: number | null
  baseline_remaining_fraction: number | null
  baseline_fetched_at: number | null
  quota_max_requests: number
  quota_display: string
}

/** Model group information */
export type ModelGroup = {
  confidence: string
  display: string
  is_exhausted: boolean
  models: string[]
  remaining_pct: number
  requests_max: number
  requests_remaining: number
  requests_used: number
  reset_time_iso: string | null
}

/** Credential information */
export type Credential = {
  identifier: string
  full_path: string
  status: string
  last_used_ts: number
  tier?: string
  requests: number
  tokens: TokenStats
  approx_cost: number | null
  global: {
    requests: number
    tokens: TokenStats
    approx_cost: number | null
  }
  models: Record<string, ModelQuota>
  model_groups?: Record<string, ModelGroup>
}

/** Provider information */
export type Provider = {
  credential_count: number
  active_count: number
  on_cooldown_count: number
  exhausted_count: number
  total_requests: number
  tokens: TokenStats
  approx_cost: number | null
  credentials: Credential[]
  quota_groups?: Record<string, QuotaGroup>
  global?: {
    approx_cost: number | null
    tokens: TokenStats
    total_requests: number
  }
}

/** Summary statistics */
export type Summary = {
  total_providers: number
  total_credentials: number
  active_credentials?: number
  exhausted_credentials?: number
  total_requests: number
  tokens: TokenStats
  approx_total_cost: number | null
}

/** Proxy limits response structure from /v1/quota-stats */
export type ProxyResponse = {
  providers: Record<string, Provider>
  summary: Summary
  global_summary?: Summary
  data_source: string
  timestamp: number
}
