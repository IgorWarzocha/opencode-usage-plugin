/**
 * Core type definitions for the Usage Tracking Plugin.
 */

export const PlanTypes = [
  "guest",
  "free",
  "go",
  "plus",
  "pro",
  "free_workspace",
  "team",
  "business",
  "education",
  "quorum",
  "k12",
  "enterprise",
  "edu",
] as const

export type PlanType = (typeof PlanTypes)[number]

export interface RateLimitWindow {
  usedPercent: number
  windowMinutes: number | null
  resetsAt: number | null
}

export interface CreditsSnapshot {
  hasCredits: boolean
  unlimited: boolean
  balance: string | null
}

// Proxy quota group info
export interface ProxyQuotaGroup {
  name: string
  remaining: number
  max: number
  remainingPct: number
  resetTime?: string | null
}

// Proxy tier info (paid vs free)
export interface ProxyTierInfo {
  tier: "paid" | "free"
  quotaGroups: ProxyQuotaGroup[]
}

// Proxy provider info
export interface ProxyProviderInfo {
  name: string
  tiers: ProxyTierInfo[]
}

// Proxy quota info from Antigravity proxy
export interface ProxyQuota {
  providers: ProxyProviderInfo[]
  totalCredentials: number
  activeCredentials: number
  dataSource: string
}

export interface UsageSnapshot {
  timestamp: number
  provider: string
  planType: PlanType | null
  primary: RateLimitWindow | null
  secondary: RateLimitWindow | null
  codeReview: RateLimitWindow | null
  credits: CreditsSnapshot | null
  // Proxy specific fields
  proxyQuota?: ProxyQuota
  updatedAt: number
}

export interface UsageEntry {
  id: string
  timestamp: number
  provider: string
  model: string
  sessionID: string
  agent?: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
  cost?: number
  requestID?: string
  statusCode?: number
  latency?: number
}

export interface TokenUsage {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}
