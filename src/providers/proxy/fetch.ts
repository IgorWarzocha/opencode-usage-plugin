/**
 * HTTP client for fetching proxy quota stats.
 */

import type { ProxyResponse } from "./types"
import type { UsageConfig } from "../../types"

export async function fetchProxyLimits(config: UsageConfig): Promise<ProxyResponse> {
  const { endpoint, apiKey, timeout = 10000 } = config

  if (!endpoint) {
    throw new Error("Proxy endpoint not configured")
  }

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
      method: "GET",
      headers,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return (await response.json()) as ProxyResponse
  } finally {
    clearTimeout(timeoutId)
  }
}
