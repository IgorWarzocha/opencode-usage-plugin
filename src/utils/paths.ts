/**
 * Resolves filesystem locations for OpenCode data files.
 * Centralizes platform-specific paths so callers stay simple and consistent.
 */

import { homedir, platform } from "os"
import { join } from "path"

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

export function getAuthFilePath(): string {
  return join(getAppDataPath(), "auth.json")
}
