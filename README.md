# OpenCode Usage Plugin

Track AI provider rate limits and quotas in real-time.

## Features

- **Live rate limits** – See Codex/OpenAI hourly/weekly limits at a glance
- **Proxy quota stats** – Monitor Mirrowel Proxy credentials and tier usage
- **Inline status** – Results appear directly in your chat, no context switching
- **Zero setup** – Auto-detects providers from your existing config

## Installation

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["@howaboua/opencode-usage-plugin"]
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
    "proxy": true
  }
}
```

If missing, the plugin creates a default template on first run.

## Development

```bash
# Check DB contents
bun run debug-db.ts

# Verify path resolution
bun run debug-path.ts
```

See `AGENTS.md` for internal architecture.
