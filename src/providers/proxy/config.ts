/**
 * Configuration management for the proxy provider.
 */

import type { ProxyConfig } from "./types"

const CONFIG_PATH = `${process.env.HOME}/.config/opencode/usage-config.jsonc`

export async function loadProxyConfig(): Promise<ProxyConfig> {
  const file = Bun.file(CONFIG_PATH)

  if (!(await file.exists())) {
    const content = `/**
 * Usage Plugin Configuration
 */
{
  // Proxy endpoint
  "endpoint": "http://localhost:8000",

  // API key for authentication
  "apiKey": "VerysecretKey",

  // Request timeout in milliseconds
  "timeout": 10000,

  // Provider visibility
  "providers": {
    "openai": true,
    "proxy": true
  }
}
`
    await Bun.write(CONFIG_PATH, content)
    return {
      endpoint: "http://localhost:8000",
      apiKey: "VerysecretKey",
      timeout: 10000,
      providers: {
        openai: true,
        proxy: true,
      },
    }
  }

  try {
    const content = await file.text()
    // Remove comments first (both // and /* */)
    const withoutComments = content.replace(
      /(\".*?\"|\'.*?\')|(\/\/.*|\/\*[\s\S]*?\*\/)/g,
      (m, g1) => g1 ?? ""
    )
    // Remove trailing commas before closing brackets/braces
    const cleanJson = withoutComments.replace(/,(\s*[}\]])/g, "$1")
    const config = JSON.parse(cleanJson) as ProxyConfig

    if (!config.endpoint) {
      throw new Error('Config must contain "endpoint" field')
    }

    return config
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse config: ${message}`)
  }
}
