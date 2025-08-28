# Header Forwarding in MCP Proxy

## Summary

The MCP proxy was using a restrictive whitelist approach for forwarding headers, which was causing authentication issues with the target server. The target server expects specific headers from the client that were being filtered out.

## Issue Identified

- MCP proxy only forwarded a limited set of headers
- Target server (jira-mcp-auth-bridge-staging.bitovi.com) was rejecting requests with 406 Not Acceptable
- OAuth tokens were valid but server expected additional client headers

## Changes Made

### 1. Fixed Header Forwarding Logic

**Before**: Whitelist approach - only forwarded specific headers
**After**: Blacklist approach - forward ALL headers except those that conflict

```typescript
// OLD - restrictive whitelist
const allowedHeaders = ['content-type', 'accept', 'user-agent'];

// NEW - blacklist conflicting headers only
const headersToExclude = new Set([
  'host',           // Will be set to target server
  'authorization', // Will be set by proxy if needed
  'connection',    // Managed by HTTP client
  'content-length', // Will be recalculated
  'transfer-encoding', // Managed by HTTP client
  'expect',        // Can interfere with proxy
  'upgrade',       // Can interfere with proxy
  'proxy-authorization', // Proxy-specific
  'proxy-connection'     // Proxy-specific
]);
```

### 2. Preserve Original Header Case

- Forward headers with original casing from client
- Handle both string and string[] header values
- Only exclude headers that would conflict with proxy operation

## Files Modified

- `src/services/mcp-proxy.ts` - Updated `forwardMcpRequest()` function

## Test Files Created

- `tests/test-mcp-auth-debug.js` - Comprehensive OAuth token testing
- `tests/quick-token-test.js` - Simple token validation
- `tests/test-mcp-proxy-debug.js` - Proxy functionality testing

## Expected Result

The target server should now receive all necessary client headers (Accept, User-Agent, etc.) while the proxy maintains control over authentication and connection management headers.

## Status

✅ Header forwarding logic updated
⏳ Testing needed to verify 406 errors are resolved
