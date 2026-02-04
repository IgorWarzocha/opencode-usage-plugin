# OpenCode Usage Plugin

Track AI provider rate limits and quotas in real-time.

## Features

- **Live rate limits** – See Codex/OpenAI hourly/weekly limits at a glance
- **Proxy quota stats** – Monitor Mirrowel Proxy credentials and tier usage
- **Copilot usage** – Track GitHub Copilot chat + completions quotas
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
  // REQUIRED: Proxy server endpoint (e.g., "http://localhost:8000")
  // Leave empty ONLY if you don't use the proxy
  "endpoint": "http://localhost:8000",

  // REQUIRED: API key for proxy auth (if your proxy requires it)
  // Leave empty if your proxy doesn't require authentication
  "apiKey": "your-key-here",

  // Optional: Request timeout in milliseconds (default: 10000)
  "timeout": 10000,

  // Optional: Show/hide providers in /usage output
  "providers": {
    "openai": true,
    "proxy": true,
    "copilot": true
  }
}
```

> **⚠️ Important**: If using the Mirrowel Proxy, both `endpoint` and `apiKey` must be set. Empty values will cause proxy queries to fail.

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
/usage proxy
/usage copilot
```

### Support the proxy

```
/usage support
```

## Supported Providers

| Provider | Source |
|----------|--------|
| **Codex / OpenAI** | Auth tokens + `/wham/usage` endpoint |
| **Mirrowel Proxy** | Local `/v1/quota-stats` endpoint |
| **GitHub Copilot** | GitHub internal usage APIs |

## Troubleshooting

**Proxy shows "not configured" error**
- Ensure `endpoint` and `apiKey` are set in `usage-config.jsonc`
- Verify your proxy is running at the specified endpoint
- Check that the API key matches your proxy credentials

**Missing provider data**
- Use `providers: { ... }` in config to disable unused providers
- For Codex: Ensure you have valid auth tokens
- For Copilot: Check token file locations in Configuration section above

**Config file not found**
- The plugin auto-creates `usage-config.jsonc` on first run
- Check the path in Configuration section above
- Manually create the file if needed

See `AGENTS.md` for internal architecture.
