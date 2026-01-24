/**
 * providers/copilot/response.ts
 * Transformations for GitHub Copilot API responses into internal quota formats.
 * Handles both public billing and internal user API shapes.
 */

import type { CopilotQuota } from "../../types.js"

export interface CopilotInternalUserResponse {
  limited_user_quotas?: {
    chat?: number
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
}

export interface BillingUsageItem {
  sku: string
  grossQuantity: number
}

export interface BillingUsageResponse {
  usageItems: BillingUsageItem[]
}

export function toCopilotQuotaFromInternal(data: CopilotInternalUserResponse): CopilotQuota | null {
  // Handle "limited" user format (Free/Pro limited)
  if (data.limited_user_quotas) {
    const remaining = data.limited_user_quotas.chat ?? 0
    const total = 50 // Copilot Free limit
    return {
      used: Math.max(0, total - remaining),
      total: total,
      percentRemaining: Math.round((remaining / total) * 100),
      resetTime: data.limited_user_reset_date || data.quota_reset_date,
    }
  }

  // Handle standard format
  if (data.quota_snapshots?.premium_interactions) {
    const premium = data.quota_snapshots.premium_interactions
    return {
      used: premium.unlimited ? 0 : premium.entitlement - premium.remaining,
      total: premium.unlimited ? -1 : premium.entitlement,
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
