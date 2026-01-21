# Usage Tracking Plugin

Real-time usage snapshots (quotas, rate limits, credits) for AI providers like Codex and Mirrowel Proxy.

## Overview

This plugin integrates into the opencode environment to track and report AI provider usage. It provides:
- Real-time monitoring of rate limits and quotas.
- Hooks for intercepting auth, commands, and sessions.
- A specialized tool (`usage.get`) for querying current state.

## Project Structure

- `hooks/`: System event interceptors.
 - `providers/`: AI provider fetchers (Codex, Proxy).
- `usage/`: Snapshot business logic.
- `ui/`: Status indicators for CLI/IDE.

## Development

Dependencies are managed in `.opencode/package.json`. Use the `probe-*.ts` scripts in the root for testing API endpoints.

Refer to `AGENTS.md` for detailed development guidelines and coding conventions.
