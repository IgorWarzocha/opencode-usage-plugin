# Proxy Provider

<instructions>
Provider for Mirrowel/Antigravity Proxy usage.
</instructions>

## Patterns
- Fetches aggregated quota stats from proxy endpoint.
- Complex tier normalization (`paid` vs `free`) in `index.ts`.
- Configurable model group mapping and display names.
- Sorting and aggregation of credential-level quotas.
