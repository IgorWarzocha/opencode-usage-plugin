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

  if (plat === "darwin") {
    return join(home, "Library", "Application Support", "opencode")
  }
  if (plat === "win32") {
    return join(process.env.APPDATA || join(home, "AppData", "Roaming"), "opencode")
  }

  const xdgData = process.env.XDG_DATA_HOME
  if (xdgData) {
    return join(xdgData, "opencode")
  }

  return join(home, ".local", "share", "opencode")
}

/**
 * Returns all possible auth file paths for the current platform.
 * On macOS, OpenCode uses Linux-style paths, so we check both.
 */
export function getPossibleAuthPaths(): string[] {
  const plat = platform()
  const home = homedir()
  const paths: string[] = []

  if (plat === "darwin") {
    // OpenCode on macOS uses Linux-style paths
    paths.push(join(home, ".local", "share", "opencode", "auth.json"))
    // Standard macOS location (fallback)
    paths.push(join(home, "Library", "Application Support", "opencode", "auth.json"))
    // Codex-specific auth (fallback)
    paths.push(join(home, ".codex", "auth.json"))
  } else if (plat === "win32") {
    paths.push(join(process.env.APPDATA || join(home, "AppData", "Roaming"), "opencode", "auth.json"))
  } else {
    // Linux/other
    const xdgData = process.env.XDG_DATA_HOME
    if (xdgData) {
      paths.push(join(xdgData, "opencode", "auth.json"))
    }
    paths.push(join(home, ".local", "share", "opencode", "auth.json"))
    paths.push(join(home, ".codex", "auth.json"))
  }

  return paths
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
