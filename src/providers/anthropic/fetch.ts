import {
  anthropicProfileResponseSchema,
  anthropicUsageResponseSchema,
  oauthUsageHeaders,
  type AnthropicProfileResponse,
  type AnthropicUsageResponse,
} from "./types.js"

const USAGE_ENDPOINT = "https://api.anthropic.com/api/oauth/usage"
const PROFILE_ENDPOINT = "https://api.anthropic.com/api/oauth/profile"
const REQUEST_TIMEOUT_MS = 5000

async function fetchOAuthJson(url: string, token: string): Promise<unknown | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...oauthUsageHeaders,
      },
      signal: controller.signal,
    })

    if (!response.ok) return null
    return await response.json().catch(() => null)
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchAnthropicUsage(token: string): Promise<AnthropicUsageResponse | null> {
  const data = await fetchOAuthJson(USAGE_ENDPOINT, token)
  if (!data) return null
  const parsed = anthropicUsageResponseSchema.safeParse(data)
  if (!parsed.success) return null
  return parsed.data
}

export async function fetchAnthropicProfile(token: string): Promise<AnthropicProfileResponse | null> {
  const data = await fetchOAuthJson(PROFILE_ENDPOINT, token)
  if (!data) return null
  const parsed = anthropicProfileResponseSchema.safeParse(data)
  if (!parsed.success) return null
  return parsed.data
}
