/**
 * providers/copilot/index.ts
 * Main entry point for the GitHub Copilot usage provider.
 */

import type { UsageProvider } from "../base.js"
import type { UsageSnapshot, CopilotQuota } from "../../types.js"
import { readCopilotAuth } from "./auth.js"
import {
  toCopilotQuotaFromInternal,
  type CopilotInternalUserResponse,
} from "./response.js"

const GITHUB_API_BASE_URL = "https://api.github.com"
const COPILOT_INTERNAL_USER_URL = `${GITHUB_API_BASE_URL}/copilot_internal/user`
const COPILOT_TOKEN_EXCHANGE_URL = `${GITHUB_API_BASE_URL}/copilot_internal/v2/token`

const COPILOT_VERSION = "0.35.0"
const EDITOR_VERSION = "vscode/1.107.0"
const EDITOR_PLUGIN_VERSION = `copilot-chat/${COPILOT_VERSION}`
const USER_AGENT = `GitHubCopilotChat/${COPILOT_VERSION}`

const COPILOT_HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  "Editor-Version": EDITOR_VERSION,
  "Editor-Plugin-Version": EDITOR_PLUGIN_VERSION,
  "Copilot-Integration-Id": "vscode-chat",
}

const REQUEST_TIMEOUT_MS = 3000

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function exchangeForCopilotToken(oauthToken: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(COPILOT_TOKEN_EXCHANGE_URL, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${oauthToken}`,
        ...COPILOT_HEADERS,
      },
    })

    if (!response.ok) return null
    const data = (await response.json()) as { token: string }
    return data.token
  } catch {
    return null
  }
}

export const CopilotProvider: UsageProvider<void> = {
  id: "copilot",
  displayName: "GitHub Copilot",

  async fetchUsage(): Promise<UsageSnapshot | null> {
    const now = Date.now()
    let quota: CopilotQuota | null = null

    const auth = await readCopilotAuth()
    const oauthToken = auth?.refresh || auth?.access
    if (oauthToken) {
      try {
        let resp = await fetchWithTimeout(COPILOT_INTERNAL_USER_URL, {
          headers: {
            Accept: "application/json",
            Authorization: `token ${oauthToken}`,
            ...COPILOT_HEADERS,
          },
        })

        if (!resp.ok) {
          const copilotToken = await exchangeForCopilotToken(oauthToken)
          if (copilotToken) {
            resp = await fetchWithTimeout(COPILOT_INTERNAL_USER_URL, {
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${copilotToken}`,
                ...COPILOT_HEADERS,
              },
            })
          }
        }

        if (resp.ok) {
          const data = (await resp.json()) as CopilotInternalUserResponse
          quota = toCopilotQuotaFromInternal(data)
        }
      } catch {
      }
    }

    if (!quota) return null

    return {
      timestamp: now,
      provider: "copilot",
      planType: null,
      primary: null,
      secondary: null,
      codeReview: null,
      credits: null,
      copilotQuota: quota,
      updatedAt: now,
    }
  },
}
