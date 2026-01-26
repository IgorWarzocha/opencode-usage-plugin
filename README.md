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

  /**
   * GitHub Copilot Enterprise/Organization Configuration
   * For enterprise or organization-level usage tracking
   */
  "copilotEnterprise": {
    // Enterprise slug from GitHub Enterprise settings
    // Use this for GitHub Enterprise Cloud accounts
    "enterprise": "your-enterprise-slug",

    // Organization name (alternative to enterprise)
    // Use this for organization-level Copilot Business/Enterprise accounts
    "organization": "your-org-name",

    // Optional: override auth token
    // Defaults to GitHub CLI token if not provided
    // Token needs "View Enterprise Copilot Metrics" or "View Organization Copilot Metrics" permission
    "token": ""
  }
}
```

If missing, the plugin creates a default template on first run.

### Copilot auth

**Individual accounts** (Pro, Pro+, Free):
Detected from:
- `~/.local/share/opencode/copilot-usage-token.json`
- `~/.local/share/opencode/auth.json` with a `github-copilot` entry
- `~/.config/opencode/copilot-quota-token.json` (optional override)

**Enterprise/Organization accounts**:
Requires configuration in `usage-config.jsonc` (see above). The plugin will:
1. Check for `copilotEnterprise` config
2. Use enterprise/org metrics API if configured
3. Fall back to individual quota checking if enterprise metrics are unavailable
4. Automatically use GitHub CLI token if no explicit token is provided

**Enterprise Prerequisites**:
- "Copilot usage metrics" policy must be set to **Enabled everywhere** for the enterprise
- Token requires appropriate permissions:
  - Fine-grained PAT: "Enterprise Copilot metrics" (read) or "Organization Copilot metrics" (read)
  - Classic PAT: `manage_billing:copilot` or `read:enterprise` / `read:org`
- GitHub Enterprise Cloud account with Copilot Enterprise or Copilot Business

Copilot is detected from either of these locations:

- `~/.local/share/opencode/copilot-usage-token.json`
- `~/.local/share/opencode/auth.json` with a `github-copilot` entry
- `~/.config/opencode/copilot-quota-token.json` (optional override)

See `AGENTS.md` for internal architecture.
