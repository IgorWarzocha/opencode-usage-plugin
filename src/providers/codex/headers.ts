/**
 * Codex header parsing helpers for rate limits and credits.
 * Uses shared header utilities for safe parsing.
 */

import { parseBooleanHeader, parseIntegerHeader, parseNumberHeader } from "../../utils"

export function parseWindow(headers: Headers, prefix: "primary" | "secondary") {
  const usedPercent = parseNumberHeader(headers, `x-codex-${prefix}-used-percent`)
  if (usedPercent === null) return null
  return {
    usedPercent,
    windowMinutes: parseIntegerHeader(headers, `x-codex-${prefix}-window-minutes`),
    resetsAt: parseIntegerHeader(headers, `x-codex-${prefix}-reset-at`),
  }
}

export function parseCredits(headers: Headers) {
  const hasCredits = parseBooleanHeader(headers, "x-codex-credits-has-credits")
  if (hasCredits === null) return null
  return {
    hasCredits,
    unlimited: parseBooleanHeader(headers, "x-codex-credits-unlimited") ?? false,
    balance: headers.get("x-codex-credits-balance"),
  }
}
