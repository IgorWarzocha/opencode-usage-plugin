/**
 * Orchestrates the fetching of usage snapshots from multiple providers.
 * Manages provider filtering, concurrency, and fallback for missing data.
 */

import type { UsageSnapshot } from "../types"
import { providers } from "../providers"
import { loadUsageConfig } from "./config"
import { loadMergedAuths } from "./auth/loader"
import { resolveProviderAuthsWithConfig } from "./registry"
import type { ResolvedProviderAuthEntry } from "./registry"

type OpenRouterEntry = Extract<ResolvedProviderAuthEntry, { providerID: "openrouter" }>

const CORE_PROVIDERS = ["codex", "proxy", "copilot", "zai-coding-plan", "anthropic", "openrouter"]

export async function fetchUsageSnapshots(filter?: string, openrouterKeyName?: string): Promise<UsageSnapshot[]> {
  const target = resolveFilter(filter)
  const normalizedOpenRouterKey = openrouterKeyName?.trim().toLowerCase()
  const config = await loadUsageConfig().catch(() => null)
  const toggles = config?.providers ?? {}
  
  const isEnabled = (id: string) => {
    if (id === "codex") return toggles.openai !== false
    if (id === "zai-coding-plan") return toggles.zai !== false
    if (id === "openrouter") return toggles.openrouter !== false
    return (toggles as Record<string, boolean>)[id] !== false
  }

  const { auths, codexDiagnostics } = await loadMergedAuths()
  const entries = resolveProviderAuthsWithConfig(auths, null, config)
  const snapshotsMap = new Map<string, UsageSnapshot>()
  const fetched = new Set<string>()
  const fetchedOpenRouterEntryIDs = new Set<string>()

  const filteredEntries = entries
    .filter(e => {
      if (e.providerID !== "openrouter" || !normalizedOpenRouterKey) return true
      return e.auth.keyName?.toLowerCase() === normalizedOpenRouterKey
    })
    .filter(e => (!target || e.providerID === target) && isEnabled(e.providerID))

  const fetches = filteredEntries
    .map(async e => {
      const snap = await providers[e.providerID]?.fetchUsage?.(e.auth).catch(() => null)
      if (snap) { 
        snapshotsMap.set(e.entryID, snap)
        if (e.providerID === "openrouter") fetchedOpenRouterEntryIDs.add(e.entryID)
        else fetched.add(e.providerID)
      }
    })

  // Handle special/default fetches
  for (const id of ["proxy", "copilot", "anthropic"]) {
    if ((!target || target === id) && isEnabled(id) && !fetched.has(id)) {
      const provider = providers[id]
      if (provider?.fetchUsage) {
        fetches.push(provider.fetchUsage(undefined).then(s => {
          if (s) {
            snapshotsMap.set(id, s)
            fetched.add(id)
          }
        }).catch(() => {}))
      }
    }
  }

  await Promise.race([Promise.all(fetches), new Promise(r => setTimeout(r, 5000))])
  const snapshots = Array.from(snapshotsMap.values())
  return appendMissingStates(
    snapshots,
    fetched,
    isEnabled,
    target,
    codexDiagnostics,
    filteredEntries.filter((e): e is OpenRouterEntry => e.providerID === "openrouter"),
    fetchedOpenRouterEntryIDs,
  )
}

function resolveFilter(f?: string): string | undefined {
  const aliases: Record<string, string> = {
    codex: "codex", openai: "codex", gpt: "codex",
    proxy: "proxy", agy: "proxy", gemini: "proxy",
    copilot: "copilot", github: "copilot",
    zai: "zai-coding-plan", glm: "zai-coding-plan",
    anthropic: "anthropic", claude: "anthropic",
    openrouter: "openrouter", or: "openrouter",
  }
  return f ? aliases[f.toLowerCase().trim()] : undefined
}

export function resolveProviderFilter(filter?: string): string | undefined {
  return resolveFilter(filter)
}


function appendMissingStates(
  snaps: UsageSnapshot[], 
  fetched: Set<string>, 
  isEnabled: (id: string) => boolean,
  target?: string,
  diagnostics?: string[],
  openRouterEntries: OpenRouterEntry[] = [],
  fetchedOpenRouterEntryIDs: Set<string> = new Set(),
): UsageSnapshot[] {
  for (const id of CORE_PROVIDERS) {
    if (id === "openrouter" && openRouterEntries.length > 0) continue
    if (isEnabled(id) && !fetched.has(id) && (!target || target === id)) {
      snaps.push({
        timestamp: Date.now(),
        provider: id,
        planType: null,
        primary: null,
        secondary: null,
        codeReview: null,
        credits: null,
        updatedAt: Date.now(),
        isMissing: true,
        missingReason: id === "codex" ? "Auth resolution failed" : undefined,
        missingDetails: id === "codex" ? diagnostics : undefined
      })
    }
  }

  for (const entry of openRouterEntries) {
    if (fetchedOpenRouterEntryIDs.has(entry.entryID)) continue
    const keyName = entry.auth.keyName ?? "unknown"
    snaps.push({
      timestamp: Date.now(),
      provider: "openrouter",
      planType: null,
      primary: null,
      secondary: null,
      codeReview: null,
      credits: null,
      updatedAt: Date.now(),
      isMissing: true,
      missingReason: `OpenRouter key \"${keyName}\" failed to fetch`,
    })
  }

  return snaps
}

export async function loadAuths() {
  const { auths } = await loadMergedAuths()
  return auths
}
