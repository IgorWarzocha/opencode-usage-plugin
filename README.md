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

## Configuration

Optional config at `~/.config/opencode/usage-config.jsonc`:

```jsonc
{
  // Proxy server endpoint
  "endpoint": "http://localhost:8000",

  // API key for proxy auth
  "apiKey": "your-key",

  // Request timeout (ms)
  "timeout": 10000,

  // Show/hide providers in /usage output
  "providers": {
    "openai": true,
    "proxy": true,
    "copilot": true
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

See `AGENTS.md` for internal architecture.
