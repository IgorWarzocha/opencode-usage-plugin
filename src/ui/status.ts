/**
 * Renders usage snapshots into readable status text.
 * Dispatches to specialized formatters and manages session messaging.
 */

import type { PluginInput } from "@opencode-ai/plugin"
import type { UsageSnapshot } from "../types"
import type { UsageState } from "../state"
import { formatProxySnapshot } from "./formatters/proxy"
import { formatCopilotSnapshot } from "./formatters/copilot"
import { formatZaiSnapshot } from "./formatters/zai"
import { formatBar, formatResetSuffix, formatMissingSnapshot } from "./formatters/shared"

type UsageClient = PluginInput["client"]

export async function sendStatusMessage(options: {
  client: UsageClient
  state: UsageState
  sessionID: string
  text: string
}): Promise<void> {
  const bus = (options.client as any).bus
  if (bus) {
    try {
      await bus.publish({
        topic: "companion.projection",
        body: { key: "usage", kind: "markdown", content: options.text },
      })
    } catch {}
  }

  await options.client.session.prompt({
    path: { id: options.sessionID },
    body: { noReply: true, parts: [{ type: "text", text: options.text, ignored: true }] },
  }).catch(async () => {
    await options.client.tui.showToast({
      body: { title: "Usage Status", message: options.text, variant: "info" },
    }).catch(() => {})
  })
}

function formatSnapshot(snapshot: UsageSnapshot): string[] {
  if (snapshot.isMissing) return formatMissingSnapshot(snapshot)
  if (snapshot.provider === "proxy") return formatProxySnapshot(snapshot)
  if (snapshot.provider === "copilot") return formatCopilotSnapshot(snapshot)
  if (snapshot.provider === "zai-coding-plan") return formatZaiSnapshot(snapshot)

  const plan = snapshot.planType ? ` (${snapshot.planType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())})` : ""
  const lines = [`→ [${snapshot.provider.toUpperCase()}]${plan}`]

  const metrics = [
    { label: "Hourly:", data: snapshot.primary },
    { label: "Weekly:", data: snapshot.secondary },
    { label: "Code Review:", data: snapshot.codeReview }
  ]

  let hasData = false
  for (const m of metrics) {
    if (m.data) {
      const pct = 100 - m.data.usedPercent
      lines.push(`  ${m.label.padEnd(13)} ${formatBar(pct)} ${pct.toFixed(0)}% left${formatResetSuffix(m.data.resetsAt)}`)
      hasData = true
    }
  }

  if (snapshot.credits?.hasCredits) {
    lines.push(`  Credits:      ${snapshot.credits.balance}`)
    hasData = true
  }

  return hasData ? lines : formatMissingSnapshot(snapshot)
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
    return sendStatusMessage({ ...options, text: `▣ Usage | No data received${filterMsg}.` })
  }

  const lines = ["▣ Usage Status", ""]
  options.snapshots.forEach((s, i) => {
    lines.push(...formatSnapshot(s))
    if (i < options.snapshots.length - 1) lines.push("", "---")
  })

  await sendStatusMessage({ ...options, text: lines.join("\n") })
}
