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

3. **Protocol Mismatch Detection**: Copilot receives SSE data from a POST request, which indicates a protocol mismatch

4. **Legacy Fallback**: Copilot attempts to use what it calls "legacy SSE" by POSTing to:
   ```
   POST https://proxy.example.com/v1/sse/message
   ```

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
  const userAgent = req.headers['user-agent'];
  if (userAgent?.includes('copilot')) {
    // Look for server hints in headers or query params
    const serverHint = req.headers['x-mcp-server'] || req.query.server;
    if (serverHint) return serverHint as string;
  }
  
  // Strategy 2: Maintain session mapping
  const sessionId = req.query.sessionId || req.body?.sessionId;
  if (sessionId) {
    const server = getServerBySessionId(sessionId, deps);
    if (server) return server;
  }
  
  // Strategy 3: Default to first proxy-enabled server
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

## Recommended Implementation

**Use Option 2 (Catch-All) combined with Option 3 (Session Mapping)** for the most robust solution:

1. **Session Tracking**: Track sessions when SSE responses include session IDs
2. **Catch-All Handler**: Handle unknown legacy endpoints with heuristics
3. **Graceful Degradation**: Fall back to default server if detection fails
4. **Clear Error Messages**: Provide helpful errors for truly unknown endpoints

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
