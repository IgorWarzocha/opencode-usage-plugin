# Codex Provider

<instructions>
Provider for OpenAI/ChatGPT usage.
</instructions>

## Patterns
- Uses `/wham/usage` endpoint.
- Fallback to rate-limit headers in `headers.ts`.
- Response validation via Zod in `response.ts`.
