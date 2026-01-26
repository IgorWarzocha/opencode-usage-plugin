/**
 * providers/copilot/auth.ts
 * Provides authentication and configuration helpers for GitHub Copilot.
 * Handles local auth token discovery and standard OpenCode credentials.
 */

import { existsSync } from "fs"
import { readFile } from "fs/promises"
import { join } from "path"
import { homedir } from "os"
import { getAuthFilePath } from "../../utils/paths.js"
import { type CopilotAuthData } from "./types.js"

export async function readCopilotAuth(): Promise<CopilotAuthData | null> {
  try {
    const authPath = getAuthFilePath()
    if (existsSync(authPath)) {
      const content = await readFile(authPath, "utf-8")
      const authData = JSON.parse(content)
      const copilotAuth = authData?.["github-copilot"] || authData?.["copilot"]
      if (copilotAuth) {
        return copilotAuth
      }
    }
    return null
  } catch {
    return null
  }
}

export async function readGitHubCliToken(): Promise<string | null> {
  const ghConfigPath = join(homedir(), ".config", "gh", "hosts.yml")

  try {
    const file = Bun.file(ghConfigPath)
    if (!(await file.exists())) {
      return null
    }

    const content = await file.text()
    const lines = content.split("\n")
    let inGithubCom = false
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed === "github.com:" || trimmed === '"github.com":') {
        inGithubCom = true
        continue
      }
      if (inGithubCom && trimmed.startsWith("oauth_token:")) {
        const match = trimmed.match(/oauth_token:\s*["']?([^"'\s]+)/)
        if (match && match[1]) {
          return match[1]
        }
      }
      if (inGithubCom && trimmed.endsWith(":") && !trimmed.startsWith("oauth_token")) {
        inGithubCom = false
      }
    }

    return null
  } catch {
    return null
  }
}
