# @howaboua/opencode-usage-plugin

[OpenCode](https://opencode.ai) plugin for tracking real-time AI provider usage, rate limits, and quotas.

## Installation

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@howaboua/opencode-usage-plugin"]
}
```

OpenCode automatically installs plugin dependencies at runtime.

## Overview

This plugin integrates into the opencode environment to track and report AI provider usage. It provides:
- Real-time monitoring of rate limits and quotas.
- Hooks for intercepting auth, commands, and sessions.
- Specialized tools (`usage.get`, `proxy-limits`) for querying current state.

## Project Structure

- `hooks/`: System event interceptors.
 - `providers/`: AI provider fetchers (Codex, Proxy).
- `usage/`: Snapshot business logic.
- `ui/`: Status indicators for CLI/IDE.

## Development

Dependencies are managed in `.opencode/package.json`. Use the `probe-*.ts` scripts in the root for testing API endpoints.

Refer to `AGENTS.md` for detailed development guidelines and coding conventions.

## License

MIT
