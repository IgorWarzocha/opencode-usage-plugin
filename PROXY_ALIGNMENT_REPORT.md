# Proxy Implementation Alignment Report

Generated: 2026-01-22
Reference: USAGE_API_QUICK_REFERENCE.md

---

## Executive Summary

**Status**: Partially Aligned
**Coverage**: ~30% of documented API surface
**Critical Gaps**: POST refresh endpoint, query filtering, 4 additional endpoints

---

## ✅ Properly Aligned Features

### 1. GET /v1/quota-stats (Cached Stats)
**File**: `src/providers/proxy/fetch.ts` (lines 7-39)
- ✅ Bearer token authentication
- ✅ Correct endpoint construction
- ✅ Timeout handling
- ✅ Response type matches API schema

### 2. Response Type Definitions
**File**: `src/providers/proxy/types.ts` (lines 17-84)
- ✅ `ProxyResponse` structure matches
- ✅ `Provider` type includes all fields (credential_count, active_count, etc.)
- ✅ `Credential` type complete (stable_id, display_name, tier, windows)
- ✅ `WindowStats` matches time-windowed stats
- ✅ `Summary` type aligns

### 3. Data Parsing Logic
**File**: `src/providers/proxy/index.ts` (lines 18-195)
- ✅ Provider-level `quota_groups` parsing
- ✅ Credential-level windows fallback
- ✅ Tier aggregation (paid/free)

### 4. Display Formatting
**File**: `src/providers/proxy/format.ts` (lines 115-184)
- ✅ Visual bar representation
- ✅ Reset time formatting
- ✅ Credential status display

---

## ❌ Critical Misalignments

### 1. POST /v1/quota-stats Not Implemented
**API Reference**: Lines 96-137 in USAGE_API_QUICK_REFERENCE.md

**Expected Behavior**:
```bash
curl -X POST "http://127.0.0.1:8000/v1/quota-stats" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"reload","scope":"all"}'
```

**Current Implementation** (`fetch.ts:24-29`):
```typescript
const response = await fetch(url, {
  method: "GET",  // ❌ Hardcoded GET
  headers,
  signal: controller.signal,
})
```

**Impact**:
- Cannot trigger cache reload
- Cannot force refresh provider quotas
- Stale data until server auto-refresh

**Required Fix**:
```typescript
// Add method parameter
export async function fetchProxyLimits(
  config: ProxyConfig,
  options?: { method?: "GET" | "POST"; action?: "reload" | "force_refresh"; scope?: string }
): Promise<ProxyResponse>
```

---

### 2. Query Parameter Filtering Missing
**API Reference**: Lines 26-33 in USAGE_API_QUICK_REFERENCE.md

**Expected**:
```bash
curl "/v1/quota-stats?provider=gemini_cli"
```

**Current**: No URL parameter construction logic

**Required Fix**:
```typescript
// In fetch.ts
const params = new URLSearchParams()
if (options?.provider) params.set("provider", options.provider)
const url = `${baseUrl}/quota-stats${params ? `?${params}` : ""}`
```

---

### 3. Unused Tool Refresh Parameter
**File**: `src/tools/proxy-limits.ts` (line 27)

```typescript
async execute(_args: { refresh?: boolean }, context: ToolContext)
//              ^^^^^^^^^^^^^^^^^^^^^^
//              Captured but never used
```

**Impact**: Users cannot force refresh from tool invocation

**Required Fix**:
```typescript
const data = await fetchProxyLimits(config, {
  method: args.refresh ? "POST" : "GET",
  action: args.refresh ? "reload" : undefined,
  scope: "all"
})
```

---

### 4. Missing Endpoints (Feature Gaps)

#### a) GET /v1/models (Lines 142-167)
**Purpose**: List available models

**Response Schema**:
```typescript
{
  object: "list"
  data: Array<{
    id: string        // "gemini/gemini-2.5-flash"
    object: "model"
    created: number
    owned_by: string  // "gemini"
  }>
}
```

**Status**: ❌ Not implemented

---

#### b) GET /v1/models/{id} (Lines 173-191)
**Purpose**: Model details with pricing

**Response Schema**:
```typescript
{
  id: string
  object: "model"
  created: number
  owned_by: string
  input_cost_per_token: number
  output_cost_per_token: number
  max_input_tokens: number
  max_output_tokens: number
  context_window: number
}
```

**Status**: ❌ Not implemented

---

#### c) GET /v1/providers (Lines 196-223)
**Purpose**: List enabled providers

**Response Schema**:
```typescript
{
  providers: Array<{
    name: string
    enabled: boolean
    credentials: number
  }>
}
```

**Status**: ❌ Not implemented

---

#### d) GET / (Lines 227-240) - Health Check
**Purpose**: Proxy server status

**Response Schema**:
```typescript
{
  status: "ok"
  version: string
  timestamp: string  // ISO 8601
}
```

**Status**: ❌ Not implemented

---

## 🔧 Minor Issues

### 1. Optional Field vs Required
**File**: `types.ts:29`

```typescript
export type ProviderQuotaGroup = {
  baseline?: number      // API shows this always present
  remaining: number
  resets_at?: string     // API examples always include this
}
```

**Recommendation**: Make `resets_at` required based on API examples

---

### 2. Error Handling Gaps
**File**: `fetch.ts:31-33`

```typescript
if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${response.statusText}`)
}
```

**Missing**: No retry logic, no detailed error parsing from API error responses

---

## 📊 Coverage Summary

| Endpoint | Method | Implemented | File |
|----------|--------|-------------|------|
| /v1/quota-stats | GET | ✅ Yes | fetch.ts |
| /v1/quota-stats | POST | ❌ No | - |
| /v1/models | GET | ❌ No | - |
| /v1/models/{id} | GET | ❌ No | - |
| /v1/providers | GET | ❌ No | - |
| / | GET | ❌ No | - |

**Query Parameters**: ❌ No `?provider=` filter support
**Actions**: ❌ No reload/force_refresh support

---

## 🎯 Recommended Priority

### P0 (Critical)
1. Implement POST /v1/quota-stats with action/scope support
2. Wire up tool's `refresh` parameter to POST logic
3. Add query parameter filtering

### P1 (High Value)
4. Implement GET /v1/providers for provider discovery
5. Implement GET / for health check connectivity

### P2 (Nice to Have)
6. GET /v1/models endpoint
7. GET /v1/models/{id} endpoint with pricing
8. Retry logic for transient failures

---

## 📝 Implementation Checklist

- [ ] Add `method`, `action`, `scope` parameters to `fetchProxyLimits()`
- [ ] Implement POST request body construction
- [ ] Add query parameter support to URL construction
- [ ] Update tool to pass `refresh` to fetch call
- [ ] Create `fetchModels()` function in new `models.ts`
- [ ] Create `fetchProviders()` function in `fetch.ts` or separate
- [ ] Create `healthCheck()` function
- [ ] Add types for models, providers, health responses
- [ ] Update `format.ts` for new data types
- [ ] Add error type parsing from API
- [ ] Add tests for POST requests
- [ ] Add tests for query parameters

---

## Conclusion

The current implementation provides solid coverage of the GET /v1/quota-stats endpoint but lacks the interactive control surface (POST for refresh) and discovery endpoints (models, providers, health) that would make this a complete API client.

**Estimated Effort to Full Alignment**: 4-6 hours
**Risk**: Low - additive changes only, no breaking changes to existing types
