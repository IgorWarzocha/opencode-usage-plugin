/**
 * Z.ai GLM Coding Plan provider.
 */

import type { UsageProvider } from "../base"
import type { UsageSnapshot } from "../../types"
import { fetchZaiUsage } from "./fetch"
import type { ZaiAuth } from "./types"

export const ZaiProvider: UsageProvider<ZaiAuth> = {
  id: "zai-coding-plan",
  displayName: "Z.ai GLM Coding Plan",

  async fetchUsage(auth: ZaiAuth): Promise<UsageSnapshot | null> {
    try {
      const data = await fetchZaiUsage(auth)

      return {
        timestamp: Date.now(),
        provider: "zai-coding-plan",
        planType: null, // Don't assume pro, let quota numbers show tier
        primary: null,
        secondary: null,
        codeReview: null,
        credits: null,
        zaiQuota: {
          limits: data.quota.limits.map(l => ({
            type: l.type,
            usage: l.usage,
            currentValue: l.currentValue,
            remaining: l.remaining,
            percentage: l.percentage,
            nextResetTime: l.nextResetTime,
            usageDetails: l.usageDetails
          })),
          modelUsage: data.model?.totalUsage,
          toolUsage: data.tool?.totalUsage
        },
        updatedAt: Date.now(),
      }
    } catch (e) {
      return null
    }
  },
}
