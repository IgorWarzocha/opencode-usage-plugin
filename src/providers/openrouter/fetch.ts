/**
 * Fetch logic for OpenRouter usage monitoring.
 */

import type { OpenRouterAuth, OpenRouterAuthResponse } from "./types"

export async function fetchOpenRouterUsage(auth: OpenRouterAuth): Promise<OpenRouterAuthResponse> {
  const url = "https://openrouter.ai/api/v1/auth/key"

  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${auth.key}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(`OpenRouter API failed: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  if (data?.data == null || typeof data.data.limit !== 'number' || typeof data.data.usage !== 'number') {
    throw new Error('Invalid OpenRouter response structure')
  }
  return data as OpenRouterAuthResponse
}
