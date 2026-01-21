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
 * 
 * This file configures the connection to the Antigravity/Mirrowel proxy server
 * and other usage tracking settings.
 */
{
  // The base URL of the proxy server (required)
  "endpoint": "http://localhost:8000",

  // Optional API key for authentication
  "apiKey": "VerysecretKey",

  // Request timeout in milliseconds (default: 10000)
  "timeout": 10000
}
`
    await Bun.write(CONFIG_PATH, content)
    // Return defaults immediately instead of throwing, so the plugin works first time
    return {
      endpoint: "http://localhost:8000",
      apiKey: "VerysecretKey",
      timeout: 10000,
    }
  }

  try {
    const content = await file.text()
    // Using a more robust regex to strip comments without corrupting URLs
    const cleanJson = content.replace(/(\".*?\"|\'.*?\')|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (match, group1) => group1 ? group1 : "")
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
