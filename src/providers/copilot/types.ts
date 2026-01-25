/**
 * providers/copilot/types.ts
 * Defines internal types and constants for the GitHub Copilot provider.
 * Includes auth data shapes and plan limit configurations.
 */

export type CopilotTier = "free" | "pro" | "pro+" | "business" | "enterprise"

export interface CopilotAuthData {
  type: string
  refresh?: string
  access?: string
  expires?: number
}

export const COPILOT_PLAN_LIMITS: Record<CopilotTier, number> = {
  free: 50,
  pro: 300,
  "pro+": 1500,
  business: 300,
  enterprise: 1000,
}
