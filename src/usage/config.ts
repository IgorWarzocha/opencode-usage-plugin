/**
 * Configuration management for the Usage Plugin.
 */

import { join } from "path"
import { homedir } from "os"
import type { UsageConfig } from "../types"

const CONFIG_PATH = join(homedir(), ".config", "opencode", "usage-config.jsonc")

export async function loadUsageConfig(): Promise<UsageConfig> {
  const file = Bun.file(CONFIG_PATH)

  if (!(await file.exists())) {
    const content = `/**
 * Usage Plugin Configuration
 */
{
  // Proxy endpoint (e.g. http://localhost:8000)
  "endpoint": "",

  // API key for authentication
  "apiKey": "",

  // Request timeout in milliseconds
  "timeout": 10000,

  // Provider visibility
  "providers": {
    "openai": true,
    "proxy": true,
    "copilot": true
  }
}
`
    await Bun.write(CONFIG_PATH, content)
    return {
      endpoint: "",
      apiKey: "",
      timeout: 10000,
      providers: {
        openai: true,
        proxy: true,
        copilot: true,
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
    const config = JSON.parse(cleanJson) as UsageConfig

    return config
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse config: ${message}`)
  }
}
