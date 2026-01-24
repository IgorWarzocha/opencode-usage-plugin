/**
 * providers/copilot/auth.ts
 * Provides authentication and configuration helpers for GitHub Copilot.
 * Handles local auth token discovery and quota configuration reading.
 */

import { existsSync, readFileSync } from "fs"
import { readFile } from "fs/promises"
import { homedir } from "os"
import { join } from "path"
import { type CopilotAuthData, type CopilotQuotaConfig } from "./types.js"

function getAuthPath(): string {
  const home = homedir()
  const dataDir =
    process.platform === "win32"
      ? process.env.LOCALAPPDATA || join(home, "AppData", "Local")
      : join(home, ".local", "share")
  return join(dataDir, "opencode", "auth.json")
}

function getUsageTokenPath(): string {
  const home = homedir()
  const dataDir =
    process.platform === "win32"
      ? process.env.LOCALAPPDATA || join(home, "AppData", "Local")
      : join(home, ".local", "share")
  return join(dataDir, "opencode", "copilot-usage-token.json")
}

export async function readCopilotAuth(): Promise<CopilotAuthData | null> {
  try {
    const usagePath = getUsageTokenPath()
    if (existsSync(usagePath)) {
      const content = await readFile(usagePath, "utf-8")
      const data = JSON.parse(content)
      if (data?.token) {
        return {
          type: "oauth",
          refresh: data.token,
          access: data.token,
        }
      }
    }

    const authPath = getAuthPath()
    if (existsSync(authPath)) {
      const content = await readFile(authPath, "utf-8")
      const authData = JSON.parse(content)
      const copilotAuth = authData?.["github-copilot"]
      if (copilotAuth) {
        return copilotAuth
      }
    }
    return null
  } catch {
    return null
  }
}

export function readQuotaConfig(): CopilotQuotaConfig | null {
  try {
    const configPath = join(
      process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
      "opencode",
      "copilot-quota-token.json",
    )
    if (!existsSync(configPath)) return null

    const content = readFileSync(configPath, "utf-8")
    const parsed = JSON.parse(content) as CopilotQuotaConfig
    if (!parsed?.token || !parsed?.username || !parsed?.tier) return null
    return parsed
  } catch {
    return null
  }
}
