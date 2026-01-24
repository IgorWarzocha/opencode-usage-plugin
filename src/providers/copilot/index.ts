import { existsSync, readFileSync } from "fs"
import { readFile } from "fs/promises"
import { homedir } from "os"
import { join } from "path"
import type { UsageProvider } from "../base.js"
import type { UsageSnapshot, CopilotQuota } from "../../types.js"

// =============================================================================
// Constants
// =============================================================================

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

// =============================================================================
// Types
// =============================================================================

export type CopilotTier = "free" | "pro" | "pro+" | "business" | "enterprise"

export interface CopilotQuotaConfig {
  token: string
  username: string
  tier: CopilotTier
}

export interface CopilotAuthData {
  type: string
  refresh?: string
  access?: string
  expires?: number
}

interface QuotaDetail {
  entitlement: number
  percent_remaining: number
  remaining: number
  unlimited: boolean
}

interface CopilotUsageResponse {
  quota_reset_date: string
  quota_snapshots: {
    premium_interactions: QuotaDetail
  }
}

interface BillingUsageItem {
  sku: string
  grossQuantity: number
}

interface BillingUsageResponse {
  usageItems: BillingUsageItem[]
}

const COPILOT_PLAN_LIMITS: Record<CopilotTier, number> = {
  free: 50,
  pro: 300,
  "pro+": 1500,
  business: 300,
  enterprise: 1000,
}

// =============================================================================
// Helpers
// =============================================================================

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

async function readCopilotAuth(): Promise<CopilotAuthData | null> {
  try {
    // Try primary source: copilot-usage-token.json
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

    // Fallback to standard auth.json
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

function readQuotaConfig(): CopilotQuotaConfig | null {
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

// =============================================================================
// Provider Implementation
// =============================================================================

export const CopilotProvider: UsageProvider<void> = {
  id: "copilot",
  displayName: "GitHub Copilot",

  async fetchUsage(): Promise<UsageSnapshot | null> {
    const now = Date.now()
    let quota: CopilotQuota | null = null

    // Strategy 1: Public Billing API
    const config = readQuotaConfig()
    if (config) {
      try {
        const resp = await fetchWithTimeout(
          `${GITHUB_API_BASE_URL}/users/${config.username}/settings/billing/premium_request/usage`,
          {
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `Bearer ${config.token}`,
              "X-GitHub-Api-Version": "2022-11-28",
            },
          },
        )
        if (resp.ok) {
          const data = (await resp.json()) as BillingUsageResponse
          const items = Array.isArray(data.usageItems) ? data.usageItems : []
          const used = items
            .filter((i) => i.sku === "Copilot Premium Request" || i.sku.includes("Premium"))
            .reduce((sum, i) => sum + (i.grossQuantity || 0), 0)
          const total = COPILOT_PLAN_LIMITS[config.tier]
          const remaining = Math.max(0, total - used)

          quota = {
            used,
            total,
            percentRemaining: Math.round((remaining / total) * 100),
            resetTime: new Date(
              Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1),
            ).toISOString(),
          }
        }
      } catch {
        // Fallback to internal API
      }
    }

    // Strategy 2: Internal API
    if (!quota) {
      const auth = await readCopilotAuth()
      if (auth) {
        try {
          const oauthToken = auth.refresh || auth.access
          if (oauthToken) {
            // Try Strategy A: Direct call with OAuth token (legacy format)
            let resp = await fetchWithTimeout(COPILOT_INTERNAL_USER_URL, {
              headers: {
                Accept: "application/json",
                Authorization: `token ${oauthToken}`,
                ...COPILOT_HEADERS,
              },
            })

            // Strategy B: Token Exchange (new format)
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
              const data = (await resp.json()) as any
              
              // Handle "limited" user format (Free/Pro limited)
              if (data.limited_user_quotas) {
                // The API returns 'remaining' counts in limited_user_quotas.
                const remaining = data.limited_user_quotas.chat ?? 0;
                // For Copilot Free, the 'total' is 50 premium requests.
                // The 'monthly_quotas.chat' value in the API (500) is often a legacy or different internal metric.
                // According to GitHub docs, Copilot Free has 50 premium requests.
                const total = 50;
                
                quota = {
                  used: Math.max(0, total - remaining),
                  total: total,
                  percentRemaining: Math.round((remaining / total) * 100),
                  resetTime: data.limited_user_reset_date || data.quota_reset_date,
                }
              } 
              // Handle standard format
              else if (data.quota_snapshots?.premium_interactions) {
                const premium = data.quota_snapshots.premium_interactions
                quota = {
                  used: premium.unlimited ? 0 : premium.entitlement - premium.remaining,
                  total: premium.unlimited ? -1 : premium.entitlement,
                  percentRemaining: Math.round(premium.percent_remaining),
                  resetTime: data.quota_reset_date,
                }
              }
            }
          }
        } catch {
          // Ignore
        }
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
