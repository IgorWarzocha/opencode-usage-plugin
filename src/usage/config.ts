/**
 * Configuration management for the Usage Plugin.
 */

import { join } from "path"
import { homedir } from "os"
import type { UsageConfig } from "../types.js"
import { readGitHubCliToken } from "../providers/copilot/auth.js"
import type { CopilotEnterpriseAuth } from "../providers/copilot/enterprise.js"

const CONFIG_PATH = join(homedir(), ".config", "opencode", "usage-config.jsonc")

export async function loadUsageConfig(): Promise<UsageConfig> {
  const file = Bun.file(CONFIG_PATH)

  if (!(await file.exists())) {
    const content = `/**
 * Usage Plugin Configuration
 */
{
  "endpoint": "",
  "apiKey": "",
  "timeout": 10000,
  "providers": {
    "openai": true,
    "proxy": true,
    "copilot": true
  },
  /**
   * GitHub Copilot Enterprise/Organization Configuration
   * Uncomment and configure for enterprise-level usage tracking
   */
  // "copilotEnterprise": {
  //   /** Enterprise slug from GitHub Enterprise settings */
  //   "enterprise": "your-enterprise-slug",
  //   /** Organization name (alternative to enterprise) */
  //   "organization": "your-org-name",
  //   /** Optional: override auth token (defaults to gh CLI token) */
  //   "token": ""
  // }
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

export async function loadCopilotEnterpriseConfig(): Promise<CopilotEnterpriseAuth | null> {
  const config = await loadUsageConfig()

  if (!config.copilotEnterprise) {
    return null
  }

  const { enterprise, organization, token: explicitToken } = config.copilotEnterprise

  if (!enterprise && !organization) {
    return null
  }

  const token = explicitToken || (await readGitHubCliToken())

  if (!token) {
    return null
  }

  return {
    enterprise,
    organization,
    token,
  }
}
