# Providers Routing

<instructions>
This directory contains AI provider implementations. Each provider MUST implement the `UsageProvider` interface.
</instructions>

## Patterns
- Each provider SHOULD reside in its own subdirectory.
- Subdirectories SHOULD contain:
  - `index.ts`: Entry point, exports the provider instance.
  - `fetch.ts`: Logic for API requests.
  - `parse.ts` or `response.ts`: Logic for transforming API responses to `UsageSnapshot`.
  - `auth.ts` or `headers.ts`: Authentication and header handling.

## Task Routing
- **Add Provider**: Create directory, implement interface, register in `src/providers/index.ts`.
- **Update Logic**: Modify `fetch.ts` or `parse.ts` within the specific provider folder.

<rules>
- MUST NOT modify `src/providers/base.ts` unless changing the base interface.
- MUST register all providers in `src/providers/index.ts`.
</rules>
