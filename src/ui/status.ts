/**
 * Renders usage snapshots into readable status text.
 */

import type { PluginInput } from "@opencode-ai/plugin"
import type { UsageSnapshot } from "../types"
import type { UsageState } from "../state"

type UsageClient = PluginInput["client"]

export async function sendStatusMessage(options: {
  client: UsageClient
  state: UsageState
  sessionID: string
  text: string
}): Promise<void> {
  // 1. Send to Companion via Bus
  // @ts-ignore
  const bus = options.client.bus
  if (bus) {
    try {
      await bus.publish({
        topic: "companion.projection",
        body: {
          key: "usage",
          kind: "markdown",
          content: options.text,
        },
      })
    } catch {}
  }

  // 2. Send plain message to TUI
  await options.client.session
    .prompt({
      path: { id: options.sessionID },
      body: {
        noReply: true,
        parts: [
          {
            type: "text",
            text: options.text,
            ignored: true,
          },
        ],
      },
    })
    .catch(async () => {
      // 3. Fallback: Toast
      await options.client.tui
        .showToast({
          body: { title: "Usage Status", message: options.text, variant: "info" },
        })
        .catch(() => {})
    })
}

function formatBar(remainingPercent: number): string {
  const clamped = Math.max(0, Math.min(100, remainingPercent))
  const size = 15
  const filled = Math.round((clamped / 100) * size)
  const empty = size - filled
  return `${"█".repeat(filled)}${"░".repeat(empty)}`
}

function formatPlanType(planType: string): string {
  return planType
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function formatResetTime(resetAt: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = resetAt - now
  if (diff <= 0) return "now"
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.ceil(diff / 60)}m`
  if (diff < 86400) return `${Math.round(diff / 3600)}h`
  return `${Math.round(diff / 86400)}d`
}

function formatResetSuffix(resetAt: number | null): string {
  if (!resetAt) return ""
  return ` (resets in ${formatResetTime(resetAt)})`
}

function formatResetSuffixISO(isoString: string): string {
  try {
    const resetAt = Math.floor(new Date(isoString).getTime() / 1000)
    return ` (resets in ${formatResetTime(resetAt)})`
  } catch {
    return ""
  }
}

function formatProxySnapshot(snapshot: UsageSnapshot): string[] {
  const proxy = snapshot.proxyQuota
  if (!proxy) return ["→ [proxy] No data"]

  const lines: string[] = ["→ [Google] Mirrowel Proxy"]

  for (const provider of proxy.providers) {
    lines.push("")
    lines.push(`  ${provider.name}:`)

    for (const tierInfo of provider.tiers) {
      const tierLabel = tierInfo.tier === "paid" ? "Paid" : "Free"
      lines.push(`    ${tierLabel}:`)

      for (const group of tierInfo.quotaGroups) {
        const resetSuffix = group.resetTime ? formatResetSuffixISO(group.resetTime) : ""
        const label = `${group.name}:`.padEnd(9)
        lines.push(`      ${label} ${formatBar(group.remainingPct)} ${group.remaining}/${group.max}${resetSuffix}`)
      }
    }
  }

  return lines
}

function formatSnapshot(snapshot: UsageSnapshot): string[] {
  if (snapshot.provider === "proxy" && snapshot.proxyQuota) {
    return formatProxySnapshot(snapshot)
  }

  const plan = snapshot.planType ? ` (${formatPlanType(snapshot.planType)})` : ""
  const lines: string[] = [`→ [${snapshot.provider.toUpperCase()}]${plan}`]

  const primary = snapshot.primary
  if (primary) {
    const remainingPct = 100 - primary.usedPercent
    const label = "Hourly:".padEnd(13)
    lines.push(
      `  ${label} ${formatBar(remainingPct)} ${remainingPct.toFixed(0)}% left${formatResetSuffix(primary.resetsAt)}`,
    )
  }
  const secondary = snapshot.secondary
  if (secondary) {
    const remainingPct = 100 - secondary.usedPercent
    const label = "Weekly:".padEnd(13)
    lines.push(
      `  ${label} ${formatBar(remainingPct)} ${remainingPct.toFixed(0)}% left${formatResetSuffix(secondary.resetsAt)}`,
    )
  }
  const codeReview = snapshot.codeReview
  if (codeReview) {
    const remainingPct = 100 - codeReview.usedPercent
    const label = "Code Review:".padEnd(13)
    lines.push(
      `  ${label} ${formatBar(remainingPct)} ${remainingPct.toFixed(0)}% left${formatResetSuffix(codeReview.resetsAt)}`,
    )
  }
  if (snapshot.credits?.hasCredits) {
    lines.push(`  Credits:      ${snapshot.credits.balance}`)
  }

  return lines
}

export async function renderUsageStatus(options: {
  client: UsageClient
  state: UsageState
  sessionID: string
  snapshots: UsageSnapshot[]
  filter?: string
}): Promise<void> {
  if (options.snapshots.length === 0) {
    const filterMsg = options.filter ? ` for "${options.filter}"` : ""
    await sendStatusMessage({
      client: options.client,
      state: options.state,
      sessionID: options.sessionID,
      text: `▣ Usage | No data received${filterMsg}.`,
    })
    return
  }

  const lines: string[] = ["▣ Usage Status", ""]

  options.snapshots.forEach((snapshot, index) => {
    const snapshotLines = formatSnapshot(snapshot)
    for (const line of snapshotLines) lines.push(line)
    if (index < options.snapshots.length - 1) {
      lines.push("")
      lines.push("---")
    }
  })

  await sendStatusMessage({
    client: options.client,
    state: options.state,
    sessionID: options.sessionID,
    text: lines.join("\n"),
  })
}
