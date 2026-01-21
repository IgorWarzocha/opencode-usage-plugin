/**
 * Parses numeric and boolean headers from usage responses.
 * Keeps header parsing consistent across providers.
 */

export function parseNumberHeader(headers: Headers, name: string): number | null {
  const value = headers.get(name)
  if (!value) return null
  const parsed = Number.parseFloat(value)
  if (Number.isNaN(parsed)) return null
  return parsed
}

export function parseIntegerHeader(headers: Headers, name: string): number | null {
  const value = headers.get(name)
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return null
  return parsed
}

export function parseBooleanHeader(headers: Headers, name: string): boolean | null {
  const value = headers.get(name)
  if (!value) return null
  const normalized = value.toLowerCase()
  if (normalized === "true" || normalized === "1") return true
  if (normalized === "false" || normalized === "0") return false
  return null
}
