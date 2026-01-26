/**
 * providers/copilot/response.ts
 * Transformations for GitHub Copilot API responses into internal quota formats.
 * Handles both public billing and internal user API shapes.
 */

import type { CopilotQuota } from "../../types.js"

export interface CopilotInternalUserResponse {
  limited_user_quotas?: {
    chat?: number
    completions?: number
  }
  limited_user_reset_date?: string
  quota_reset_date: string
  quota_snapshots?: {
    premium_interactions?: {
      entitlement: number
      percent_remaining: number
      remaining: number
      unlimited: boolean
    }
  }
  monthly_quotas?: {
    chat: number
    completions: number
  }
}

export interface BillingUsageItem {
  sku: string
  grossQuantity: number
}

export interface BillingUsageResponse {
  usageItems: BillingUsageItem[]
}

export function toCopilotQuotaFromInternal(data: CopilotInternalUserResponse): CopilotQuota | null {
  if (data.limited_user_quotas) {
    const chatRemainingRaw = data.limited_user_quotas.chat ?? 0
    const chatTotalRaw = data.monthly_quotas?.chat ?? 0
    
    const chatScale = chatTotalRaw === 500 ? 10 : 1
    const chatRemaining = Math.floor(chatRemainingRaw / chatScale)
    const chatTotal = Math.floor(chatTotalRaw / chatScale)

    const completionsRemainingRaw = data.limited_user_quotas.completions ?? 0
    const completionsTotalRaw = data.monthly_quotas?.completions ?? 2000
    
    const compScale = completionsTotalRaw === 4000 ? 2 : 1
    const completionsRemaining = Math.floor(completionsRemainingRaw / compScale)
    const completionsTotal = Math.floor(completionsTotalRaw / compScale)

    return {
      used: chatRemaining,
      total: chatTotal,
      percentRemaining: chatTotal > 0 ? Math.round((chatRemaining / chatTotal) * 100) : 0,
      resetTime: data.limited_user_reset_date || data.quota_reset_date,
      completionsUsed: completionsRemaining,
      completionsTotal,
    }
  }

  if (data.quota_snapshots?.premium_interactions) {
    const premium = data.quota_snapshots.premium_interactions
    const totalRaw = premium.unlimited ? -1 : premium.entitlement
    const remainingRaw = premium.remaining
    
    const scaleFactor = totalRaw === 500 ? 10 : 1
    const chatRemaining = totalRaw === -1 ? -1 : Math.floor(remainingRaw / scaleFactor)
    const chatTotal = totalRaw === -1 ? -1 : Math.floor(totalRaw / scaleFactor)

    return {
      used: chatRemaining,
      total: chatTotal,
      percentRemaining: Math.round(premium.percent_remaining),
      resetTime: data.quota_reset_date,
    }
  }

  return null
}

export function toCopilotQuotaFromBilling(
  data: BillingUsageResponse,
  limit: number,
): CopilotQuota {
  const items = Array.isArray(data.usageItems) ? data.usageItems : []
  const used = items
    .filter((i) => i.sku === "Copilot Premium Request" || i.sku.includes("Premium"))
    .reduce((sum, i) => sum + (i.grossQuantity || 0), 0)
  const remaining = Math.max(0, limit - used)

  return {
    used,
    total: limit,
    percentRemaining: Math.round((remaining / limit) * 100),
    resetTime: new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1),
    ).toISOString(),
  }
}
