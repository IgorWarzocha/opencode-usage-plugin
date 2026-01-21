/**
 * Loads auth data and fetches live usage snapshots from providers.
 * Ensures only OAuth-backed providers are queried.
 */

import z from "zod"
import type { UsageSnapshot } from "../types"
import { providers } from "../providers"
import { getAuthFilePath } from "../utils"
import type { AuthRecord } from "./registry"
import { resolveProviderAuths } from "./registry"

const authEntrySchema = z
  .object({
    type: z.string().optional(),
    access: z.string().optional(),
    refresh: z.string().optional(),
    enterpriseUrl: z.string().optional(),
    accountId: z.string().optional(),
  })
  .passthrough()

const authRecordSchema = z.record(z.string(), authEntrySchema)

export async function fetchUsageSnapshots(): Promise<UsageSnapshot[]> {
  const auths = await loadAuths()
  const entries = resolveProviderAuths(auths, null)
  const snapshots: UsageSnapshot[] = []
  const fetches = entries.map(async (entry) => {
    const provider = providers[entry.providerID]
    if (!provider?.fetchUsage) return
    const snapshot = await provider.fetchUsage(entry.auth).catch(() => null)
    if (snapshot) snapshots.push(snapshot)
  })

  await Promise.race([Promise.all(fetches), timeout(5000)])
  return snapshots
}



async function loadAuths(): Promise<AuthRecord> {
  const authPath = getAuthFilePath()
  const data = await Bun.file(authPath)
    .json()
    .catch(() => ({}))
  if (!data || typeof data !== "object") return {}
  const parsed = authRecordSchema.safeParse(data)
  if (!parsed.success) return {}
  return parsed.data as AuthRecord
}

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
