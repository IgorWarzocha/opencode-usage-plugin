/**
 * Orchestrates the fetching of usage snapshots from multiple providers.
 * Manages provider filtering, concurrency, and fallback for missing data.
 */

import type { UsageSnapshot } from "../types"
import { providers } from "../providers"
import { loadUsageConfig } from "./config"
import { loadMergedAuths } from "./auth/loader"
import { resolveProviderAuths } from "./registry"

const CORE_PROVIDERS = ["codex", "proxy", "copilot"]

export async function fetchUsageSnapshots(filter?: string): Promise<UsageSnapshot[]> {
  const target = resolveFilter(filter)
  const config = await loadUsageConfig().catch(() => null)
  const toggles = config?.providers ?? {}
  
  const isEnabled = (id: string) => {
    if (id === "codex") return toggles.openai !== false
    return (toggles as any)[id] !== false
  }

  const { auths, codexDiagnostics } = await loadMergedAuths()
  const entries = resolveProviderAuths(auths, null)
  const snapshotsMap = new Map<string, UsageSnapshot>()
  const fetched = new Set<string>()

  const fetches = entries
    .filter(e => (!target || e.providerID === target) && isEnabled(e.providerID))
    .map(async e => {
      const snap = await providers[e.providerID]?.fetchUsage?.(e.auth).catch(() => null)
      if (snap) { 
        snapshotsMap.set(e.providerID, snap)
        fetched.add(e.providerID) 
      }
    })

  // Handle special/default fetches
  for (const id of ["proxy", "copilot"]) {
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
  return appendMissingStates(snapshots, fetched, isEnabled, target, codexDiagnostics)
}

function resolveFilter(f?: string): string | undefined {
  const aliases: Record<string, string> = { 
    codex: "codex", openai: "codex", gpt: "codex", 
    proxy: "proxy", agy: "proxy", gemini: "proxy",
    copilot: "copilot", github: "copilot" 
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
  diagnostics?: string[]
): UsageSnapshot[] {
  for (const id of CORE_PROVIDERS) {
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
  return snaps
}

export async function loadAuths() {
  const { auths } = await loadMergedAuths()
  return auths
}

