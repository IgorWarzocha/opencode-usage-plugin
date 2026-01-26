/**
 * Configuration management for the Usage Plugin.
 */

import { join } from "path"
import { homedir, platform } from "os"
import type { UsageConfig } from "../types"

function getConfigPath(): string {
  const plat = platform()
  const home = homedir()

  if (plat === "darwin") {
    // OpenCode on macOS uses ~/.config for config files
    return join(home, ".config", "opencode", "usage-config.jsonc")
  }
  if (plat === "win32") {
    return join(process.env.APPDATA || join(home, "AppData", "Roaming"), "opencode", "usage-config.jsonc")
  }

  // Linux/other - use XDG_CONFIG_HOME or default to ~/.config
  const xdgConfig = process.env.XDG_CONFIG_HOME
  if (xdgConfig) {
    return join(xdgConfig, "opencode", "usage-config.jsonc")
  }

  return join(home, ".config", "opencode", "usage-config.jsonc")
}

const CONFIG_PATH = getConfigPath()

export async function loadUsageConfig(): Promise<UsageConfig> {
  const file = Bun.file(CONFIG_PATH)

  if (!(await file.exists())) {
    const content = `{
  "endpoint": "",
  "apiKey": "",
  "timeout": 10000,
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
