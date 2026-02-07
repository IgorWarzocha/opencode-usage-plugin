/**
 * Fetch logic for OpenRouter usage monitoring.
 */

import {
  openRouterAuthResponseSchema,
  type OpenRouterAuth,
  type OpenRouterAuthResponse,
} from "./types"

export async function fetchOpenRouterUsage(auth: OpenRouterAuth): Promise<OpenRouterAuthResponse> {
  const urls = [
    "https://openrouter.ai/api/v1/key",
    "https://openrouter.ai/api/v1/auth/key",
  ]

  let lastError = "Unknown OpenRouter API error"
  for (const url of urls) {
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${auth.key}`,
        "Content-Type": "application/json",
      },
    }).catch(() => null)

    if (!response) {
      lastError = `OpenRouter API failed: network error for ${url}`
      continue
    }
    if (!response.ok) {
      lastError = `OpenRouter API failed: ${response.status} ${await response.text()}`
      continue
    }

    const data = await response.json().catch(() => null)
    if (!data) {
      lastError = "Invalid OpenRouter response: empty JSON body"
      continue
    }
    const parsed = openRouterAuthResponseSchema.safeParse(data)
    if (!parsed.success) {
      lastError = "Invalid OpenRouter response structure"
      continue
    }
    return parsed.data
  }

  throw new Error(lastError)
}
