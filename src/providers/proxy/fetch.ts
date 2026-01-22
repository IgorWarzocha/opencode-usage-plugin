/**
 * HTTP client for fetching proxy quota stats.
 */

import type { ProxyConfig, ProxyResponse } from "./types"

export async function fetchProxyLimits(
  config: ProxyConfig,
  options?: { refresh?: boolean },
): Promise<ProxyResponse> {
  const { endpoint, apiKey, timeout = 10000 } = config
  const refresh = options?.refresh ?? false

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`
  }

  const baseUrl = endpoint.endsWith("/v1") ? endpoint : `${endpoint}/v1`
  const url = `${baseUrl}/quota-stats`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      method: refresh ? "POST" : "GET",
      headers,
      signal: controller.signal,
      body: refresh ? JSON.stringify({ action: "reload", scope: "all" }) : undefined,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return (await response.json()) as ProxyResponse
  } finally {
    clearTimeout(timeoutId)
  }
}
