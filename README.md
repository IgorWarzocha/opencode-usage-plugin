# OpenCode Usage Plugin

Track AI provider rate limits and quotas in real-time.

## Features

- **Live rate limits** – See Codex/OpenAI hourly/weekly limits at a glance
- **Anthropic subscription limits** – Track Claude OAuth windows (5h, 7d, Sonnet/Opus/cowork tiers)
- **Proxy quota stats** – Monitor Mirrowel Proxy credentials and tier usage
- **Copilot usage** – Track GitHub Copilot chat + completions quotas
- **Z.ai usage** – Track GLM Coding Plan 5-hour token quota and monthly tool quota
- **Inline status** – Results appear directly in your chat, no context switching
- **Zero setup** – Auto-detects providers from your existing config

<img width="1300" height="900" alt="image" src="https://github.com/user-attachments/assets/cd49e450-f4b6-4314-b236-b3a92bffdb88" />

## Installation

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@howaboua/opencode-usage-plugin"]
}
```

OpenCode installs dependencies automatically on next launch.

## Configuration

The plugin creates a default config file on first run at:

**Linux/macOS**: `~/.config/opencode/usage-config.jsonc`  
**Windows**: `%APPDATA%\opencode\usage-config.jsonc`

```jsonc
{
  // REQUIRED: Proxy server endpoint (default: "http://localhost:8000")
  // Leave empty ONLY if you don't use the proxy
  "endpoint": "http://localhost:8000",

  // REQUIRED: API key for proxy auth (default: "VerysecretKey")
  // Leave empty if your proxy doesn't require authentication
  "apiKey": "VerysecretKey",

  // Optional: Request timeout in milliseconds (default: 10000)
  "timeout": 10000,

  // Optional: Z.ai API endpoint (default: "https://api.z.ai")
  "zaiEndpoint": "https://api.z.ai",

  // Optional: Show/hide providers in /usage output
  "providers": {
    "openai": true,
    "anthropic": true,
    "proxy": true,
    "copilot": true,
    "zai": true
  },

  // Model group display configuration (optional)
  "modelGroups": {
    // Show all model groups from proxy (default: true)
    // When true: auto-discovers all groups, uses displayNames as overrides
    // When false: only shows groups listed in displayNames (whitelist mode)
    "showAll": true,

    // Override display names for specific groups (optional)
    // Groups not listed here use their original name from the proxy
    "displayNames": {
      "g3-pro": "Gemini Pro",
      "g3-flash": "Gemini Flash",
      "claude": "Claude"
    }
  }
}
```

> **⚠️ Important**: If using the Mirrowel Proxy, both `endpoint` and `apiKey` must be set. The proxy defaults to `endpoint: http://localhost:8000` and `apiKey: VerysecretKey`. If you changed these during your proxy setup, you MUST update your config file to match.

### Model Group Configuration

The `modelGroups` section controls how quota groups are displayed:

| `showAll` | `displayNames` | Behavior |
|-----------|----------------|----------|
| `true` (default) | empty/missing | Show all groups with original names |
| `true` | provided | Show all groups, apply display name overrides |
| `false` | provided | Only show groups in displayNames (whitelist mode) |
| `false` | empty/missing | Shows no groups (all filtered out) |
| missing section | — | Legacy behavior (hardcoded group whitelist) |

If missing, the plugin creates a default template on first run.

### Copilot auth

Copilot is detected from either of these locations:

- `~/.local/share/opencode/copilot-usage-token.json`
- `~/.local/share/opencode/auth.json` with a `github-copilot` entry
- `~/.config/opencode/copilot-quota-token.json` (optional override)

## Usage

### Check all providers

```
/usage
```

### Check specific provider

```
/usage codex
/usage anthropic
/usage claude
/usage proxy
/usage copilot
/usage zai
/usage glm
```

### Support the proxy

```
/usage support
```

## Supported Providers

| Provider | Source |
|----------|--------|
| **Codex / OpenAI** | Auth tokens + `/wham/usage` endpoint |
| **Anthropic Claude** | OAuth profile + `/api/oauth/usage` windows |
| **Mirrowel Proxy** | Local `/v1/quota-stats` endpoint |
| **GitHub Copilot** | GitHub internal usage APIs |
| **Z.ai GLM Coding Plan** | `chat.z.ai` auth + Z.ai usage APIs |

## Troubleshooting

**Proxy shows "not configured" error**
- Ensure `endpoint` and `apiKey` are set in `usage-config.jsonc`
- Default values: `endpoint: http://localhost:8000`, `apiKey: VerysecretKey`
- If you changed these during proxy setup, update your config file to match
- Verify your proxy is running at the specified endpoint

**Missing provider data**
- Use `providers: { ... }` in config to disable unused providers
- For Codex: Ensure you have valid auth tokens
- For Copilot: Check token file locations in Configuration section above
- For Z.ai: Ensure your OpenCode auth includes `chat.z.ai` credentials
- For Anthropic: Ensure Claude OAuth credentials are available (`anthropic` in auth.json)

**Config file not found**
- The plugin auto-creates `usage-config.jsonc` on first run
- Check the path in Configuration section above
- Manually create the file if needed

See `AGENTS.md` for internal architecture.
