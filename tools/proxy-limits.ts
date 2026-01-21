/**
 * Proxy limits tool for checking quota stats from the Antigravity proxy.
 * Displays results as an inline status message.
 */

import { tool } from "@opencode-ai/plugin"
import { loadProxyConfig, fetchProxyLimits, formatProxyLimits } from "../providers/proxy"

type ToolContext = {
  sessionID: string
  messageID: string
}

type SendStatusFn = (sessionID: string, text: string) => Promise<void>
type MarkSilentFn = (sessionID: string, messageID: string) => void

export function createProxyLimitsTool(sendStatus: SendStatusFn, markSilent: MarkSilentFn) {
  return tool({
    description:
      "Check current usage limits from the antigravity proxy server. Displays results as an inline status message.",
    args: {
      refresh: tool.schema
        .boolean()
        .optional()
        .default(false)
        .describe("Force refresh the limits data (default: false)"),
    },
    async execute(_args: { refresh?: boolean }, context: ToolContext) {
      markSilent(context.sessionID, context.messageID)
      try {
        const config = await loadProxyConfig()
        const data = await fetchProxyLimits(config)
        const message = formatProxyLimits(data)

        await sendStatus(context.sessionID, message)

        return ""
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        const errorMessage = `Proxy Limits Error\n\n${message}`

        await sendStatus(context.sessionID, errorMessage)

        return ""
      }
    },
  })
}
