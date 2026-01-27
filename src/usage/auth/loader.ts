/**
 * Utility for loading and merging authentication records from multiple system paths.
 * Handles platform-specific path resolution and specific provider auth transformations.
 */

import z from "zod"
import { getPossibleAuthPaths } from "../../utils"

const authEntrySchema = z.object({
  type: z.string().optional(),
  access: z.string().optional(),
  refresh: z.string().optional(),
  enterpriseUrl: z.string().optional(),
  accountId: z.string().optional(),
  key: z.string().optional(),
}).passthrough()

const authRecordSchema = z.record(z.string(), authEntrySchema)

export type AuthEntry = z.infer<typeof authEntrySchema>
export type AuthRecord = Record<string, AuthEntry>

export async function loadMergedAuths(): Promise<{
  auths: AuthRecord
  codexDiagnostics: string[]
}> {
  const possiblePaths = getPossibleAuthPaths()
  const mergedAuth: AuthRecord = {}
  const codexDiagnostics: string[] = [`Auth paths checked: ${possiblePaths.join(", ")}`]
  const orderedPaths = [...possiblePaths].reverse()

  for (const authPath of orderedPaths) {
    const diagnostics = await processAuthPath(authPath, mergedAuth)
    codexDiagnostics.push(...diagnostics)
  }

  return { auths: mergedAuth, codexDiagnostics }
}

async function processAuthPath(authPath: string, mergedAuth: AuthRecord): Promise<string[]> {
  const diagnostics: string[] = []
  try {
    const file = Bun.file(authPath)
    if (!(await file.exists())) return [`Missing auth file: ${authPath}`]

    const data = await file.json()
    if (typeof data !== "object" || data === null) return [`Auth file is not a JSON object: ${authPath}`]

    if (authPath.includes(".codex")) {
      const parsed = parseCodexAuth(data as Record<string, unknown>, authPath)
      if (parsed.auth) Object.assign(mergedAuth, parsed.auth)
      return parsed.diagnostics
    }

    const parsed = authRecordSchema.safeParse(data)
    if (!parsed.success) return [`Auth file failed schema validation: ${authPath}`]

    Object.assign(mergedAuth, parsed.data)
    diagnostics.push(`Loaded auth from ${authPath}`)
  } catch (e: any) {
    diagnostics.push(`Failed to read auth file ${authPath}: ${e.message}`)
  }
  return diagnostics
}

function parseCodexAuth(data: Record<string, unknown>, path: string) {
  const tokens = data.tokens as any
  if (!tokens?.access_token) return { auth: null, diagnostics: [`Invalid Codex auth in ${path}`] }

  return {
    auth: {
      openai: {
        type: "oauth",
        access: tokens.access_token,
        accountId: tokens.account_id,
        refresh: tokens.refresh_token,
      },
    },
    diagnostics: [`Codex CLI auth loaded from ${path}`],
  }
}
