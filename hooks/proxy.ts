/**
 * Hooks for proxy-limits functionality.
 * Manages silent responses after tool execution.
 */

const silence = new Map<string, Set<string>>()

export function markSilent(sessionID: string, messageID: string) {
  const current = silence.get(sessionID) ?? new Set<string>()
  current.add(messageID)
  if (!silence.has(sessionID)) silence.set(sessionID, current)
}

function shouldSilence(sessionID: string, messageID: string) {
  const current = silence.get(sessionID)
  if (!current) return false
  if (!current.has(messageID)) return false
  current.delete(messageID)
  if (current.size === 0) silence.delete(sessionID)
  return true
}

export function proxyHooks() {
  return {
    "experimental.text.complete": async (
      input: { sessionID: string; messageID: string },
      output: { text: string },
    ) => {
      if (!shouldSilence(input.sessionID, input.messageID)) return
      output.text = ""
    },
  }
}
