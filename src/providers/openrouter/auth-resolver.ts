/**
 * Resolves OpenRouter auth entries from config and auth records.
 * Deduplicates by key and ensures unique display names.
 */

import type { UsageConfig } from "../../types"
import type { AuthRecord } from "../../usage/registry"
import type { OpenRouterAuth } from "./types"

export type OpenRouterResolvedAuthEntry = {
  providerID: "openrouter"
  entryID: string
  auth: OpenRouterAuth
}

export function resolveOpenRouterAuths(
  auths: AuthRecord,
  config: UsageConfig | null,
): OpenRouterResolvedAuthEntry[] {
  const entries: OpenRouterResolvedAuthEntry[] = []
  const seenKeys = new Set<string>()
  const seenNames = new Set<string>()

  const configuredKeys = Array.isArray(config?.openrouterKeys) ? config.openrouterKeys : []
  for (const configured of configuredKeys) {
    const key = configured?.key?.trim()
    if (!key || seenKeys.has(key)) continue
    const rawName = configured?.name?.trim()
    if (configured.enabled === false) continue
    const name = getUniqueOpenRouterName(rawName || `key-${entries.length + 1}`, seenNames)
    seenKeys.add(key)
    seenNames.add(name.toLowerCase())
    entries.push({
      providerID: "openrouter",
      entryID: `openrouter:${name}`,
      auth: { key, keyName: name },
    })
  }

  for (const authKey of ["openrouter", "or"]) {
    const auth = auths[authKey]
    const key = (auth?.key || auth?.access || "").trim()
    if (!key || seenKeys.has(key)) continue
    const name = getUniqueOpenRouterName("default", seenNames)
    seenKeys.add(key)
    seenNames.add(name.toLowerCase())
    entries.push({
      providerID: "openrouter",
      entryID: `openrouter:${name}`,
      auth: { key, keyName: name },
    })
    break
  }

  return entries
}

function getUniqueOpenRouterName(candidate: string, seenNames: Set<string>): string {
  const normalized = candidate.toLowerCase()
  if (!seenNames.has(normalized)) return candidate

  let suffix = 2
  while (seenNames.has(`${normalized}-${suffix}`)) suffix += 1
  return `${candidate}-${suffix}`
}
