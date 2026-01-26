/**
 * Renders usage snapshots into readable status text.
 */

import type { PluginInput } from "@opencode-ai/plugin"
import { platform, homedir } from "os"
import { join } from "path"
import type { UsageSnapshot } from "../types"
import type { UsageState } from "../state"

type UsageClient = PluginInput["client"]

export async function sendStatusMessage(options: {
  client: UsageClient
  state: UsageState
  sessionID: string
  text: string
}): Promise<void> {
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
  if (!proxy || !proxy.providers || proxy.providers.length === 0) return []

  const lines: string[] = ["→ [Google] Mirrowel Proxy"]

  for (const provider of proxy.providers) {
    if (!provider.tiers || provider.tiers.length === 0) continue
    
    lines.push("")
    lines.push(`  ${provider.name}:`)

    for (const tierInfo of provider.tiers) {
      if (!tierInfo.quotaGroups || tierInfo.quotaGroups.length === 0) continue
      
      const tierLabel = tierInfo.tier === "paid" ? "Paid" : "Free"
      lines.push(`    ${tierLabel}:`)

      for (const group of tierInfo.quotaGroups) {
        const resetSuffix = group.resetTime ? formatResetSuffixISO(group.resetTime) : ""
        const label = `${group.name}:`.padEnd(9)
        lines.push(`      ${label} ${formatBar(group.remainingPct)} ${group.remaining}/${group.max}${resetSuffix}`)
      }
    }
  }

  // If we only have the header, it means no tiers/groups were formatted
  if (lines.length === 1) return []

  return lines
}

function formatCopilotSnapshot(snapshot: UsageSnapshot): string[] {
  const copilot = snapshot.copilotQuota
  if (!copilot) return []

  const lines: string[] = ["→ [GITHUB] Copilot"]
  const resetSuffix = copilot.resetTime ? formatResetSuffixISO(copilot.resetTime) : ""
  const totalLabel = copilot.total === -1 ? "∞" : copilot.total.toString()
  const chatLabel = "Chat:".padEnd(13)

  const chatRemaining = copilot.used
  const chatPct = copilot.percentRemaining

  lines.push(`  ${chatLabel} ${formatBar(chatPct)} ${chatRemaining}/${totalLabel}${resetSuffix}`)

  if (copilot.completionsUsed !== undefined && copilot.completionsTotal !== undefined) {
    const compLabel = "Completions:".padEnd(13)
    const compPct =
      copilot.completionsTotal > 0
        ? Math.round((copilot.completionsUsed / copilot.completionsTotal) * 100)
        : 0
    lines.push(
      `  ${compLabel} ${formatBar(compPct)} ${copilot.completionsUsed}/${copilot.completionsTotal}`,
    )
  }

  return lines
}

function getAppDataPath(): string {
  const home = homedir()
  const plat = platform()
  if (plat === "darwin") return join(home, ".config", "opencode")
  if (plat === "win32") return join(process.env.APPDATA || join(home, "AppData", "Roaming"), "opencode")
  return join(process.env.XDG_CONFIG_HOME || join(home, ".config"), "opencode")
}

function formatMissingSnapshot(snapshot: UsageSnapshot): string[] {
  const provider = snapshot.provider
  const configPath = join(getAppDataPath(), "usage-config.jsonc")
  
  let providerInstruction = ""
  if (provider === "codex") {
    providerInstruction = "if you dont have codex oauth, please set your usage-config.jsonc to openai: false"
  } else if (provider === "proxy") {
    providerInstruction = "if you are not running Mirrowel's proxy, please set your usage-config.jsonc to proxy: false"
  } else if (provider === "copilot") {
    providerInstruction = "if you are not running GitHub Copilot, please set your usage-config.jsonc to copilot: false"
  } else {
    // For other providers, we don't show the big help block unless it's a core one
    return []
  }

  return [
    `→ [${provider.toUpperCase()}] - ${providerInstruction}`,
    "",
    `The file can be found in ${configPath}. Please read the comments in the file or visit the repo for the readme.`,
    "",
    "If you are seeing empty usages or errors, despite having everything set up correctly, please fire an issue at https://github.com/IgorWarzocha/opencode-usage-plugin/issues - thank you!",
  ]
}

function formatSnapshot(snapshot: UsageSnapshot): string[] {
  if (snapshot.isMissing) {
    return formatMissingSnapshot(snapshot)
  }
  
  if (snapshot.provider === "proxy" && snapshot.proxyQuota) {
    return formatProxySnapshot(snapshot)
  }
  if (snapshot.provider === "copilot" && snapshot.copilotQuota) {
    return formatCopilotSnapshot(snapshot)
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

  // If we only have the header line, don't show anything
  if (lines.length === 1) return []

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

  const formattedSnapshots = options.snapshots
    .map(snapshot => formatSnapshot(snapshot))
    .filter(lines => lines.length > 0)

  if (formattedSnapshots.length === 0) {
    await sendStatusMessage({
      client: options.client,
      state: options.state,
      sessionID: options.sessionID,
      text: `▣ Usage | No active providers found.`,
    })
    return
  }

  formattedSnapshots.forEach((snapshotLines, index) => {
    for (const line of snapshotLines) lines.push(line)
    if (index < formattedSnapshots.length - 1) {
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
