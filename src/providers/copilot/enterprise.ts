/**
 * providers/copilot/enterprise.ts
 * GitHub Copilot Enterprise and Organization metrics provider.
 * Fetches usage data from the public preview Copilot usage metrics API.
 *
 * NOTE: This feature is in public preview with data protection and subject to change.
 * Requires "Copilot usage metrics" policy to be set to "Enabled everywhere" for the enterprise.
 *
 * @see https://docs.github.com/rest/copilot/copilot-usage-metrics
 */

import type { CopilotQuota } from "../../types.js"

const GITHUB_API_BASE_URL = "https://api.github.com"
const API_VERSION = "2022-11-28"

interface MetricsReportResponse {
  download_links: string[]
  report_start_day: string
  report_end_day: string
}

interface BaseMetricsEntry {
  date: string
  total_active_users: number
  total_engaged_users: number
  total_lines_suggested: number
  total_lines_accepted: number
  total_suggestions_count: number
  total_acceptances_count: number
  completions_count: number
  chat_conversations_count: number
  chat_acceptances_count: number
  premium_interactions_count?: number
  total_premium_requests?: number
}

interface EnterpriseMetricsEntry extends BaseMetricsEntry {
  enterprise_id: string
}

interface OrganizationMetricsEntry extends BaseMetricsEntry {
  organization_id: string
}

const REQUEST_TIMEOUT_MS = 10000

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

async function fetchMetricsReport<T extends BaseMetricsEntry>(
  url: string,
  authToken: string,
): Promise<T[] | null> {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${authToken}`,
          "X-GitHub-Api-Version": API_VERSION,
        },
      },
      REQUEST_TIMEOUT_MS,
    )

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as MetricsReportResponse

    if (!data.download_links || data.download_links.length === 0) {
      return null
    }

    const reportUrl = data.download_links[0]
    const reportResponse = await fetchWithTimeout(reportUrl, {}, REQUEST_TIMEOUT_MS)

    if (!reportResponse.ok) {
      return null
    }

    const reportText = await reportResponse.text()
    const lines = reportText.trim().split("\n")

    return lines
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as T
        } catch {
          return null
        }
      })
      .filter((entry): entry is T => entry !== null)
  } catch {
    return null
  }
}

async function fetchEnterpriseMetrics(
  enterprise: string,
  authToken: string,
): Promise<EnterpriseMetricsEntry[] | null> {
  const url = `${GITHUB_API_BASE_URL}/enterprises/${enterprise}/copilot/metrics/reports/enterprise-28-day/latest`
  return fetchMetricsReport<EnterpriseMetricsEntry>(url, authToken)
}

/**
 * Fetch and parse the latest 28-day organization metrics report.
 * Aggregates data across all days to compute total usage.
 */
async function fetchOrganizationMetrics(
  organization: string,
  authToken: string,
): Promise<OrganizationMetricsEntry[] | null> {
  const url = `${GITHUB_API_BASE_URL}/orgs/${organization}/copilot/metrics/reports/organization-28-day/latest`
  return fetchMetricsReport<OrganizationMetricsEntry>(url, authToken)
}

/**
 * Convert enterprise/org metrics to CopilotQuota format.
 * Aggregates premium requests across the 28-day period.
 *
 * Note: This is an approximation. The enterprise metrics API provides
 * historical aggregate data, not real-time quota remaining.
 */
function toCopilotQuotaFromMetrics(
  entries: (EnterpriseMetricsEntry | OrganizationMetricsEntry)[],
): CopilotQuota | null {
  if (entries.length === 0) {
    return null
  }

  const sortedEntries = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const totalPremiumRequests = sortedEntries.reduce((sum, entry) => {
    return sum + (entry.total_premium_requests ?? entry.premium_interactions_count ?? 0)
  }, 0)

  const mostRecentEntry = sortedEntries[sortedEntries.length - 1]
  const lastDay = new Date(mostRecentEntry.date)
  const resetTime = new Date(Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth() + 1, 1)).toISOString()

  return {
    used: 0,
    total: -1, // No known max limit; tracking usage only until enterprise validation
    percentRemaining: 0,
    resetTime,
    completionsUsed: sortedEntries.reduce((sum, e) => sum + (e.completions_count ?? 0), 0),
    completionsTotal: -1,
  }
}

/**
 * Configuration for fetching enterprise/org metrics.
 */
export interface CopilotEnterpriseAuth {
  /** Enterprise slug for enterprise-level metrics */
  enterprise?: string
  /** Organization name for org-level metrics */
  organization?: string
  /** Auth token with appropriate scopes */
  token: string
}

/**
 * Fetch usage data from GitHub Copilot enterprise/organization metrics API.
 *
 * Requires:
 * - "Copilot usage metrics" policy enabled for the enterprise
 * - Token with "View Enterprise Copilot Metrics" or "View Organization Copilot Metrics" permission
 * - For fine-grained PATs: "Enterprise Copilot metrics" (read) or "Organization Copilot metrics" (read)
 * - For classic PATs: `manage_billing:copilot` or `read:enterprise` / `read:org`
 */
export async function fetchCopilotEnterpriseUsage(
  auth: CopilotEnterpriseAuth,
): Promise<CopilotQuota | null> {
  const { enterprise, organization, token } = auth

  if (!enterprise && !organization) {
    return null
  }

  let metrics: (EnterpriseMetricsEntry | OrganizationMetricsEntry)[] | null = null

  // Try enterprise endpoint first
  if (enterprise) {
    metrics = await fetchEnterpriseMetrics(enterprise, token)
  }

  // Fall back to organization endpoint if enterprise fails
  if (!metrics && organization) {
    metrics = await fetchOrganizationMetrics(organization, token)
  }

  if (!metrics || metrics.length === 0) {
    return null
  }

  return toCopilotQuotaFromMetrics(metrics)
}
