# AGENTS.md - Usage Tracking Plugin

<instructions>
This plugin tracks and reports real-time usage snapshots (quotas, rate limits, credits) for AI providers like Codex and Mirrowel Proxy. It integrates into the opencode environment via hooks and provides specialized tools for querying usage state.
</instructions>

## 🧭 Navigation

- **Entry Point**: `index.ts` (wires hooks and tools)
- **Core Logic**:
  - `hooks/`: Intercepts system events (commands, sessions, experimental)
  - `providers/`: Specialized fetchers for different AI providers (e.g., Codex, Proxy)
  - `usage/`: Business logic for fetching and caching snapshots
  - `ui/`: Status indicators and display logic
- **Data Model**: `types.ts` defines `UsageSnapshot`, `UsageEntry`, and `PlanType`
- **State Management**: `state.ts` manages the in-memory usage snapshots

## 🛠️ Development Workflow

### Commands
Dependencies are in root `package.json`. The plugin loads via `opencode.json`.

- **Load Plugin**: `opencode` (automatically loads plugin specified in `opencode.json`)
- **Build Check**: Verify `index.ts` compiles: `bun --version && bun index.ts --help 2>/dev/null || true`

### Conventions
- **Hooks**: MUST follow the pattern in `hooks/index.ts`. Use barrel exports to keep `index.ts` lean.
- **Providers**: NEW providers MUST implement the `UsageProvider` interface from `providers/base.ts` and be registered in `providers/index.ts`.
- **Types**: ALWAYS refer to `types.ts` for usage schemas to ensure consistency across providers.
- **Error Handling**: Use the utility helpers in `utils/` for consistent header and path handling.

## 🚀 Common Tasks

### Adding a New Provider
1. Create a new directory in `providers/<name>/`.
2. Implement `UsageProvider` interface.
3. Register the provider in `providers/index.ts`.
4. Add any necessary types to `types.ts`.

### Modifying UI Indicators
- Update `ui/status.ts` to change how usage information is displayed in the CLI/IDE.

<rules>
- MUST maintain clear separation between providers in `providers/`.
</rules>
