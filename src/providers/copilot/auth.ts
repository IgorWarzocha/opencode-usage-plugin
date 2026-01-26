/**
 * providers/copilot/auth.ts
 * Provides authentication and configuration helpers for GitHub Copilot.
 */

import { existsSync } from "fs"
import { readFile } from "fs/promises"
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
