/**
 * Fetch logic for Z.ai usage monitoring.
 */

import { loadUsageConfig } from "../../usage/config"
import type { ZaiAuth, ZaiQuotaResponse, ZaiModelUsageResponse, ZaiToolUsageResponse } from "./types"

export async function fetchZaiUsage(auth: ZaiAuth) {
  const config = await loadUsageConfig().catch(() => null)
  const baseUrl = config?.zaiEndpoint?.replace(/\/$/, "") || "https://api.z.ai"
  const monitorUrl = `${baseUrl}/api/monitor/usage`

  const now = new Date()

  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, now.getHours(), 0, 0, 0)
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 59, 59, 999)

  const formatDateTime = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    const seconds = String(date.getSeconds()).padStart(2, "0")
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  const startTime = formatDateTime(startDate)
  const endTime = formatDateTime(endDate)
  const queryParams = `?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`

  const headers = {
    "Authorization": auth.key,
    "Accept-Language": "en-US,en",
    "Content-Type": "application/json",
  }

  const [quotaRes, modelRes, toolRes] = await Promise.all([
    fetch(`${monitorUrl}/quota/limit`, { headers }),
    fetch(`${monitorUrl}/model-usage${queryParams}`, { headers }),
    fetch(`${monitorUrl}/tool-usage${queryParams}`, { headers }),
  ])

  if (!quotaRes.ok) {
    throw new Error(`Z.ai quota query failed: ${quotaRes.status} ${await quotaRes.text()}`)
  }

  const quota = (await quotaRes.json()) as ZaiQuotaResponse
  const model = modelRes.ok ? ((await modelRes.json()) as ZaiModelUsageResponse) : null
  const tool = toolRes.ok ? ((await toolRes.json()) as ZaiToolUsageResponse) : null

  return {
    quota: quota.data,
    model: model?.data,
    tool: tool?.data,
  }
}
