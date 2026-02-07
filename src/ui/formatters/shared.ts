/**
 * Formats various usage snapshots (Proxy, Copilot, Codex) into human-readable text.
 * Provides specialized formatting for progress bars, reset times, and missing data states.
 */

import { platform, homedir } from "os"
import { join } from "path"
import type { UsageSnapshot } from "../../types"

export function formatBar(pct: number): string {
  const clamped = Math.max(0, Math.min(100, pct))
  const size = 15
  const filled = Math.round((clamped / 100) * size)
  return `${"█".repeat(filled)}${"░".repeat(size - filled)}`
}

export function formatResetSuffix(resetAt: number | null): string {
  if (!resetAt) return ""
  const delta = formatTimeDelta(resetAt)
  return delta === "just refreshed" ? ` (${delta})` : ` (resets in ${delta})`
}

export function formatResetSuffixISO(iso: string): string {
  try {
    const at = Math.floor(new Date(iso).getTime() / 1000)
    const delta = formatTimeDelta(at)
    return delta === "just refreshed" ? ` (${delta})` : ` (resets in ${delta})`
  } catch { return "" }
}

function formatTimeDelta(at: number): string {
  const atSeconds = at > 1e11 ? Math.floor(at / 1000) : at

  const diff = atSeconds - Math.floor(Date.now() / 1000)
  if (diff <= 0) return "just refreshed"

  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const minutes = Math.floor((diff % 3600) / 60)

  if (days > 0) {
    return hours > 0 ? `${days}d${hours}hrs` : `${days}d`
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}hrs${minutes}m` : `${hours}hrs`
  }

  if (minutes > 0) return `${minutes}m`
  return `${diff}s`
}

export function formatMissingSnapshot(snapshot: UsageSnapshot): string[] {
  const { provider } = snapshot
  const configPath = getConfigPath()
  const instructions: Record<string, string> = {
    codex: "if you dont have codex oauth, please set your usage-config.jsonc to openai: false",
    proxy: "check your usage-config.jsonc. Default: endpoint http://localhost:8000, apiKey VerysecretKey. If you changed these during proxy setup, update your config to match. Or set proxy: false to disable.",
    copilot: "if you are not running GitHub Copilot, please set your usage-config.jsonc to copilot: false",
    anthropic: "if you are not using Claude Code with a subscription, please set your usage-config.jsonc to anthropic: false",
    openrouter: "please check your OpenRouter API key in your auth configuration or set openrouter: false in usage-config.jsonc to disable."
  }

  const lines = [`→ [${provider.toUpperCase()}] - ${instructions[provider] || ""}`]
  if (snapshot.missingReason) lines.push("", `Reason: ${snapshot.missingReason}`)
  if (snapshot.missingDetails?.length) {
    lines.push("", "Details:", ...snapshot.missingDetails.map((d: string) => `- ${d}`))
  }

  return [...lines, "", `File: ${configPath}`, "", "Issue? https://github.com/IgorWarzocha/opencode-usage-plugin/issues"]
}

function getConfigPath() {
  const home = homedir()
  const plat = platform()
  
  if (plat === "win32") {
    return join(process.env.APPDATA || join(home, "AppData", "Roaming"), "opencode", "usage-config.jsonc")
  }

  // For macOS, Linux, and other Unix-like systems, use XDG_CONFIG_HOME or default to ~/.config
  const configHome = process.env.XDG_CONFIG_HOME || join(home, ".config")
  return join(configHome, "opencode", "usage-config.jsonc")
}
