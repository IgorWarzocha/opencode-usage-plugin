/**
 * Configuration management for the Usage Plugin.
 */

import { join } from "path"
import { homedir, platform } from "os"
import type { UsageConfig } from "../types"

function getConfigPath(): string {
  const plat = platform()
  const home = homedir()

  if (plat === "win32") {
    return join(process.env.APPDATA || join(home, "AppData", "Roaming"), "opencode", "usage-config.jsonc")
  }

  // For macOS, Linux, and other Unix-like systems, use XDG_CONFIG_HOME or default to ~/.config
  const configHome = process.env.XDG_CONFIG_HOME || join(home, ".config")
  return join(configHome, "opencode", "usage-config.jsonc")
}

const CONFIG_PATH = getConfigPath()

export async function loadUsageConfig(): Promise<UsageConfig> {
  const file = Bun.file(CONFIG_PATH)

  if (!(await file.exists())) {
    const content = `{
  // REQUIRED: Proxy server endpoint (default: "http://localhost:8000")
  // Leave empty ONLY if you don't use the proxy
  "endpoint": "http://localhost:8000",

  // REQUIRED: API key for proxy auth (default: "VerysecretKey")
  // Leave empty if your proxy doesn't require authentication
  "apiKey": "VerysecretKey",

  // Optional: Z.ai API endpoint (default: "https://api.z.ai")
  "zaiEndpoint": "https://api.z.ai",

  // Optional: Request timeout in milliseconds (default: 10000)
  "timeout": 10000,

  // Optional: Show/hide providers in /usage output
  "providers": {
    "openai": true,
    "proxy": true,
    "copilot": true,
    "zai": true
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
        zai: true,
      },
    }

  }

  try {
    const content = await file.text()
    const withoutComments = content.replace(
      /(\".*?\"|\'.*?\')|(\/\/.*|\/\*[\s\S]*?\*\/)/g,
      (m, g1) => g1 ?? ""
    )
    const cleanJson = withoutComments.replace(/,(\s*[}\]])/g, "$1")
    const config = JSON.parse(cleanJson) as UsageConfig

    return config
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse config: ${message}`)
  }
}
