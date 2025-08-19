# MCP Proxy Fallback Behavior and Legacy Endpoint Handling

## Overview

This document explains why MCP (Model Context Protocol) clients like GitHub Copilot perform fallback behaviors when connecting to MCP servers through a proxy, and provides strategies for handling unknown legacy endpoints dynamically.

## The Fallback Behavior

### What Happens

When Copilot connects to our MCP proxy, the following sequence occurs:

1. **Initial Connection**: Copilot makes a POST request to our proxy endpoint
   ```
   POST https://proxy.example.com/api/mcp/jira/proxy
   ```

2. **SSE Endpoint Discovery**: The target MCP server responds with SSE data containing session information
   ```
   event: endpoint
   data: /v1/sse/message?sessionId=13e1c277421fca24acd9c00d0460881d674ef2194315148056e27e145251060a
   ```
   **Note**: This is a standard SSE redirection pattern where the server tells the client which endpoint to use for subsequent requests.

3. **Protocol Mismatch Detection**: Copilot receives SSE data from a POST request, which indicates a protocol mismatch

4. **Legacy Fallback**: Copilot attempts to use what it calls "legacy SSE" by POSTing to:
   ```
   POST https://proxy.example.com/v1/sse/message?sessionId=...
   ```
   **Key Insight**: Since we control the SSE response in step 2, we can rewrite the endpoint to use our own proxy URLs!

### Why This Happens

This fallback behavior exists because:

1. **Protocol Evolution**: MCP has evolved over time with different implementations
2. **SSE vs JSON-RPC**: Some servers prefer pure SSE, others prefer JSON-RPC over HTTP
3. **Session Management**: Servers may want session-based connections rather than stateless requests
4. **Compatibility**: Ensures maximum compatibility across different MCP implementations

The fallback is a **feature, not a bug** - it ensures clients can connect to servers with different protocol preferences.

## The Problem: Unknown Legacy Endpoints

### Current Limitation

Our current implementation hardcodes the legacy fallback endpoint:

```typescript
// Fixed endpoint - not scalable
app.post('/v1/sse/message', async (req, res) => {
  const mcpName = 'jira'; // Hardcoded!
  return proxyMcpRequest(deps)({ ...req, params: { mcpName } }, res);
});
```

### Issues

1. **Not Scalable**: Can't handle multiple MCP servers with different fallback endpoints
2. **Unpredictable**: We can't anticipate what legacy URLs different MCP servers might use
3. **Maintenance Burden**: Would require manual route creation for each new MCP server

## Solutions

### Option 0: SSE Response Rewriting (NEW - Most Elegant!)

**Rewrite the SSE endpoint data to use our proxy URLs:**

```typescript
async function forwardStreamingResponse(sourceResponse: Response, targetResponse: ExpressResponse, mcpName: string): Promise<void> {
  const reader = sourceResponse.body?.getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    // Convert response chunk to string
    let chunk = new TextDecoder().decode(value);
    
    // Rewrite endpoint URLs in SSE data
    chunk = rewriteSSEEndpoints(chunk, mcpName);
    
    // Forward the modified chunk
    targetResponse.write(chunk);
  }
  
  targetResponse.end();
}

function rewriteSSEEndpoints(sseData: string, mcpName: string): string {
  // Pattern: event: endpoint\ndata: /some/path?params
  const endpointPattern = /(event:\s*endpoint\s*\ndata:\s*)([^\n\r]+)/g;
  
  return sseData.replace(endpointPattern, (match, prefix, originalPath) => {
    // Extract session ID and other params from original path
    const url = new URL(originalPath, 'https://example.com'); // dummy base
    const sessionId = url.searchParams.get('sessionId');
    
    // Rewrite to use our proxy endpoint
    const newPath = `/api/mcp/${mcpName}/proxy/session?sessionId=${sessionId}`;
    
    return `${prefix}${newPath}`;
  });
}

// Add new route for session-based requests
export function setupMcpProxyRoutes(app: Express, deps: ProxyServiceDeps) {
  // Standard proxy routes
  app.post('/api/mcp/:mcpName/proxy', proxyMcpRequest(deps));
  app.get('/api/mcp/:mcpName/proxy', proxyMcpRequest(deps));
  
  // Session-based proxy route (for rewritten endpoints)
  app.post('/api/mcp/:mcpName/proxy/session', sessionProxyHandler(deps));
  
  // Status route
  app.get('/api/mcp/:mcpName/proxy/status', getProxyStatus(deps));
}

function sessionProxyHandler(deps: ProxyServiceDeps) {
  return async (req: Request, res: ExpressResponse) => {
    const { mcpName } = req.params;
    const sessionId = req.query.sessionId;
    
    // Forward to the actual MCP server's session endpoint
    const server = deps.configManager.getMcpServer(mcpName);
    const targetUrl = `${server.url.replace('/v1/sse', '')}/v1/sse/message?sessionId=${sessionId}`;
    
    // Forward the request
    return forwardMcpRequest(targetUrl, req.body, getAuthToken(server, deps), res);
  };
}
```

### Benefits of SSE Rewriting:

✅ **Complete control**: We control where Copilot sends follow-up requests  
✅ **No guesswork**: No need to determine which MCP server from ambiguous requests  
✅ **Scalable**: Works with unlimited MCP servers  
✅ **Standard compliant**: Uses the existing SSE endpoint discovery pattern  
✅ **Transparent**: Copilot doesn't know it's being redirected through our proxy

### Option 1: Dynamic Route Registration

Register fallback routes dynamically based on MCP server configuration:

```typescript
interface McpServerConfig {
  name: string;
  url: string;
  proxy: boolean;
  fallbackEndpoints?: string[]; // New field
}

// Example configuration
{
  "name": "jira",
  "url": "https://mcp.atlassian.com/v1/sse",
  "proxy": true,
  "fallbackEndpoints": ["/v1/sse/message", "/api/sse", "/legacy/sse"]
}

// Dynamic route registration
export function setupDynamicMcpRoutes(app: Express, deps: ProxyServiceDeps) {
  const servers = deps.configManager.getMcpServers();
  
  servers.forEach(server => {
    if (server.proxy && server.fallbackEndpoints) {
      server.fallbackEndpoints.forEach(endpoint => {
        app.post(endpoint, createFallbackHandler(server.name, deps));
      });
    }
  });
}
```

### Option 2: Catch-All Legacy Handler (Recommended)

Use a catch-all route for unknown legacy endpoints:

```typescript
export function setupMcpProxyRoutes(app: Express, deps: ProxyServiceDeps) {
  // Standard proxy routes
  app.post('/api/mcp/:mcpName/proxy', proxyMcpRequest(deps));
  app.get('/api/mcp/:mcpName/proxy', proxyMcpRequest(deps));
  
  // Catch-all for legacy MCP endpoints
  // This should be registered LAST to avoid conflicts
  app.all('*', catchAllLegacyHandler(deps));
}

function catchAllLegacyHandler(deps: ProxyServiceDeps) {
  return async (req: Request, res: ExpressResponse, next: NextFunction) => {
    // Only handle requests that look like MCP legacy endpoints
    if (!isMcpLegacyEndpoint(req.path)) {
      return next(); // Pass to next handler (404, etc.)
    }
    
    // Try to determine which MCP server this is for
    const mcpName = determineMcpServer(req, deps);
    
    if (!mcpName) {
      return res.status(404).json({
        error: 'Unknown legacy MCP endpoint',
        path: req.path,
        suggestion: 'Configure fallbackEndpoints in MCP server config'
      });
    }
    
    // Handle as legacy proxy request
    req.params = { ...req.params, mcpName };
    return proxyMcpRequest(deps)(req, res);
  };
}

function isMcpLegacyEndpoint(path: string): boolean {
  // Heuristics to identify MCP endpoints
  return path.includes('/sse/') || 
         path.includes('/mcp/') || 
         path.includes('/v1/') ||
         path.startsWith('/message');
}

function determineMcpServer(req: Request, deps: ProxyServiceDeps): string | null {
  // Strategy 1: Check request headers for clues
  // ⚠️ LIMITATION: Copilot doesn't send custom headers we control
  const userAgent = req.headers['user-agent'];
  if (userAgent?.includes('copilot')) {
    // Look for server hints in headers or query params
    // ⚠️ PROBLEM: Copilot won't send 'x-mcp-server' header - we don't control this
    const serverHint = req.headers['x-mcp-server'] || req.query.server;
    if (serverHint) return serverHint as string;
  }
  
  // Strategy 2: Maintain session mapping
  // ✅ VIABLE: Session IDs are included in SSE responses from MCP servers
  const sessionId = req.query.sessionId || req.body?.sessionId;
  if (sessionId) {
    const server = getServerBySessionId(sessionId, deps);
    if (server) return server;
  }
  
  // Strategy 3: Default to first proxy-enabled server
  // ⚠️ FALLBACK ONLY: Works only if you have one MCP server
  const servers = deps.configManager.getMcpServers();
  const proxyServer = servers.find(s => s.proxy);
  return proxyServer?.name || null;
}
```

### Option 3: Session-Based Mapping

Track active sessions to map legacy requests to the correct server:

```typescript
// Global session tracking
const activeSessions = new Map<string, { mcpServer: string, timestamp: number }>();

// In the main proxy handler, track sessions
export function proxyMcpRequest(deps: ProxyServiceDeps) {
  return async (req: Request, res: ExpressResponse) => {
    // ... existing code ...
    
    // After successful SSE response that includes sessionId
    if (isSSEResponse && response.includes('sessionId')) {
      const sessionId = extractSessionId(response);
      if (sessionId) {
        activeSessions.set(sessionId, {
          mcpServer: mcpName,
          timestamp: Date.now()
        });
        
        // Clean up old sessions periodically
        cleanupOldSessions();
      }
    }
  };
}

// Use session mapping in legacy handler
function getServerBySessionId(sessionId: string, deps: ProxyServiceDeps): string | null {
  const session = activeSessions.get(sessionId);
  return session?.mcpServer || null;
}

function cleanupOldSessions() {
  const maxAge = 1000 * 60 * 60; // 1 hour
  const now = Date.now();
  
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.timestamp > maxAge) {
      activeSessions.delete(sessionId);
    }
  }
}
```

### Option 4: Client Hint Headers

Add custom headers to help identify the target server:

```typescript
// Modify proxy responses to include server identification
export function setupMcpProxyRoutes(app: Express, deps: ProxyServiceDeps) {
  app.post('/api/mcp/:mcpName/proxy', (req, res, next) => {
    // Add server hint header
    res.setHeader('X-MCP-Server', req.params.mcpName);
    return proxyMcpRequest(deps)(req, res);
  });
  
  // Legacy handler can check for the hint
  app.all('*', (req, res, next) => {
    const serverHint = req.headers['x-mcp-server'];
    if (serverHint && isMcpLegacyEndpoint(req.path)) {
      req.params = { mcpName: serverHint };
      return proxyMcpRequest(deps)(req, res);
    }
    next();
  });
}
```

## Realistic Assessment of Solutions

## Realistic Assessment of Solutions

### What Actually Works Best

**SSE Response Rewriting (Option 0)** is by far the most elegant solution:

✅ **SSE endpoint discovery is standard**: This is how MCP servers are supposed to work  
✅ **We control the response**: We can rewrite any endpoint URL in the SSE stream  
✅ **Copilot follows the redirect**: This is exactly what Copilot expects to happen  
✅ **No client modifications needed**: Works with any MCP client that follows the standard  
✅ **Scales perfectly**: Each MCP server gets its own rewritten endpoints

### How SSE Endpoint Discovery Works

This is a **standard pattern** in real-time protocols:

1. **Client connects** to server
2. **Server responds with SSE** containing the "real" endpoint to use
3. **Client disconnects** from initial endpoint
4. **Client connects** to the endpoint specified in the SSE data
5. **Normal communication** proceeds on the new endpoint

Examples from other systems:
- **WebRTC signaling**: Initial connection gets ICE candidates and session descriptions
- **OAuth flows**: Authorization server redirects to different endpoints
- **Load balancers**: Return the actual server endpoint to use

### Why This Is Better Than Catch-All

Instead of trying to guess which MCP server a request is for, we:

1. **Rewrite the SSE response** from Jira: `/v1/sse/message?sessionId=...` → `/api/mcp/jira/proxy/session?sessionId=...`
2. **Copilot automatically uses our endpoint** because that's what the SSE told it to do
3. **We know exactly which MCP server** because it's in the URL path (`/mcp/jira/`)
4. **Session tracking becomes trivial** because the session ID is in our URL

### Session Tracking (Option 3)** is the most reliable approach because:

✅ **Session IDs are real**: MCP servers do include session IDs in SSE responses  
✅ **We control the tracking**: We can capture and store session mappings  
✅ **Copilot includes session IDs**: In fallback requests like `/v1/sse/message?sessionId=...`

### What Probably Won't Work

**Header-based detection** has major limitations:

❌ **No custom headers**: Copilot doesn't send headers we can control  
❌ **No server hints**: We can't inject `X-MCP-Server` headers into Copilot's requests  
❌ **Limited user-agent info**: User-agent alone doesn't identify the target MCP server

**Path-based heuristics** are unreliable:

❌ **Path patterns vary**: Different MCP servers use different legacy endpoint patterns  
❌ **No standard**: There's no MCP specification for legacy endpoint naming  
❌ **False positives**: Could match non-MCP endpoints accidentally

### The Real-World Solution

For multiple MCP servers, the only reliable approach is:

1. **Session tracking** when it works (when sessionId is present)
2. **Configuration-based routing** for known patterns
3. **Graceful failure** for unknown cases

```typescript
function determineMcpServer(req: Request, deps: ProxyServiceDeps): string | null {
  // Only reliable strategy: Session mapping
  const sessionId = req.query.sessionId || req.body?.sessionId;
  if (sessionId) {
    return getServerBySessionId(sessionId, deps);
  }
  
  // Fallback: Use path-based rules from configuration
  const servers = deps.configManager.getMcpServers();
  for (const server of servers) {
    if (server.proxy && server.fallbackEndpoints?.includes(req.path)) {
      return server.name;
    }
  }
  
  // Last resort: Default server (only works with one proxy server)
  const defaultServer = servers.find(s => s.proxy);
  return defaultServer?.name || null;
}
```

### Limitations We Must Accept

1. **Single-server assumption**: Most solutions only work reliably with one MCP server
2. **Manual configuration**: Some endpoint patterns must be manually configured
3. **Session dependency**: Without session IDs, routing becomes guesswork
4. **Client limitations**: We can't modify how Copilot sends requests

## Recommended Implementation

**Use Option 0 (SSE Response Rewriting)** - this is the most elegant and scalable solution:

1. **Rewrite SSE endpoint URLs** to point back to our proxy with server identification
2. **Add session-based proxy routes** to handle the rewritten requests  
3. **Maintain session context** automatically through URL structure
4. **No guesswork or heuristics needed** - everything is explicit

This approach works because:
- ✅ **Standards-compliant**: Uses the existing SSE endpoint discovery pattern
- ✅ **Scales infinitely**: Each MCP server gets its own URL namespace  
- ✅ **No configuration needed**: Works automatically for any MCP server
- ✅ **Transparent to clients**: Copilot follows standard SSE redirects
- ✅ **Debuggable**: Clear request routing through URL paths

### Implementation Example

```typescript
// In forwardStreamingResponse function:
async function forwardStreamingResponse(sourceResponse: Response, targetResponse: ExpressResponse, mcpName?: string): Promise<void> {
  const reader = sourceResponse.body?.getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    let chunk = new TextDecoder().decode(value);
    
    // Rewrite endpoint URLs if we have an MCP server name
    if (mcpName) {
      chunk = rewriteSSEEndpoints(chunk, mcpName);
    }
    
    targetResponse.write(new TextEncoder().encode(chunk));
  }
  
  targetResponse.end();
}
```

This completely eliminates the need for catch-all handlers or session mapping complexity!

## Configuration Example

```json
{
  "name": "jira",
  "url": "https://mcp.atlassian.com/v1/sse",
  "authorization_token": null,
  "proxy": true,
  "fallbackEndpoints": ["/v1/sse/message"],
  "tool_configuration": {
    "enabled": true
  }
}
```

## Benefits

1. **Automatic Handling**: No manual route configuration needed
2. **Scalable**: Works with any number of MCP servers
3. **Future-Proof**: Adapts to new MCP server implementations
4. **Debuggable**: Clear logging and error messages
5. **Backward Compatible**: Maintains existing functionality

## Implementation Priority

1. **Phase 1**: Implement session tracking in existing proxy
2. **Phase 2**: Add catch-all legacy handler with heuristics
3. **Phase 3**: Add configuration options for explicit fallback endpoints
4. **Phase 4**: Add client hint headers for improved detection

This approach ensures our MCP proxy can handle the dynamic nature of MCP protocol fallback behaviors while remaining maintainable and scalable.
