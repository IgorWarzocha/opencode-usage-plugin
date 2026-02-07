import type { UsageProvider } from "../base.js"
import type { UsageSnapshot } from "../../types.js"
import { readAnthropicAuth } from "./auth.js"
import { fetchAnthropicProfile, fetchAnthropicUsage } from "./fetch.js"
import { buildAnthropicQuota, inferAnthropicPlanType } from "./parse.js"

export const AnthropicProvider: UsageProvider<void> = {
  id: "anthropic",
  displayName: "Anthropic Claude",
  usageEndpoint: "https://api.anthropic.com/api/oauth/usage",

  async fetchUsage(): Promise<UsageSnapshot | null> {
    const auth = await readAnthropicAuth()
    if (!auth?.access) return null

    const [usage, profile] = await Promise.all([
      fetchAnthropicUsage(auth.access),
      fetchAnthropicProfile(auth.access),
    ])

    if (!usage) return null

    return {
      timestamp: Date.now(),
      updatedAt: Date.now(),
      provider: "anthropic",
      planType: inferAnthropicPlanType(profile),
      primary: null,
      secondary: null,
      codeReview: null,
      credits: null,
      anthropicQuota: buildAnthropicQuota(usage, profile),
    }
  },
}
