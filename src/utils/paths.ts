/**
 * Resolves filesystem locations for OpenCode data files.
 * Centralizes platform-specific paths so callers stay simple and consistent.
 */

import { homedir, platform } from "os"
import { join } from "path"
import { existsSync } from "fs"

export function getAppDataPath(): string {
  const plat = platform()
  const home = homedir()

  if (plat === "win32") {
    return join(process.env.APPDATA || join(home, "AppData", "Roaming"), "opencode")
  }

  const dataHome = process.env.XDG_DATA_HOME || join(home, ".local", "share")
  return join(dataHome, "opencode")
}

/**
 * Returns all possible auth file paths for the current platform.
 * On macOS, OpenCode uses Linux-style paths, so we check both.
 */
export function getPossibleAuthPaths(): string[] {
  const plat = platform()
  const home = homedir()
  const pathSet = new Set<string>()

  if (plat === "win32") {
    pathSet.add(join(process.env.APPDATA || join(home, "AppData", "Roaming"), "opencode", "auth.json"))
  } else {
    // Linux/other
    const dataHome = process.env.XDG_DATA_HOME || join(home, ".local", "share")
    pathSet.add(join(dataHome, "opencode", "auth.json"))
    pathSet.add(join(home, ".codex", "auth.json"))
  }

  return Array.from(pathSet)
}

/**
 * Returns the first existing auth file path, or the default location if none exist.
 */
export function getAuthFilePath(): string {
  const possiblePaths = getPossibleAuthPaths()

  // Return the first existing path
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path
    }
  }

  // Return the default (first) path if none exist
  return possiblePaths[0]
}
