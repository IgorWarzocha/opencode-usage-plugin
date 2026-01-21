/**
 * Configuration management for the proxy provider.
 */

import type { ProxyConfig } from "./types"

const CONFIG_PATH = `${process.env.HOME}/.config/opencode/proxy-limits.json`

export async function loadProxyConfig(): Promise<ProxyConfig> {
  const file = Bun.file(CONFIG_PATH)

  if (!(await file.exists())) {
    throw new Error(
      `Config file not found: ${CONFIG_PATH}\n\n` +
        `Create it with:\n` +
        `{\n` +
        `  "endpoint": "http://localhost:8000",\n` +
        `  "apiKey": "your-key",\n` +
        `  "timeout": 10000\n` +
        `}`,
    )
  }

  try {
    const content = await file.text()
    const config = JSON.parse(content) as ProxyConfig

    if (!config.endpoint) {
      throw new Error('Config must contain "endpoint" field')
    }

    return config
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse config: ${message}`)
  }
}
