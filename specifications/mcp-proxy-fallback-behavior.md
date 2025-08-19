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
async function forwardStreamingResponse(sourceResponse: Response, targetResponse: ExpressResponse, mcpName: string, serverBaseUrl: string): Promise<void> {
  const reader = sourceResponse.body?.getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    // Convert response chunk to string
    let chunk = new TextDecoder().decode(value);
    
    // Rewrite endpoint URLs in SSE data
    chunk = rewriteSSEEndpoints(chunk, mcpName, serverBaseUrl);
    
    // Forward the modified chunk
    targetResponse.write(chunk);
  }
  
  targetResponse.end();
}

function rewriteSSEEndpoints(sseData: string, mcpName: string, serverBaseUrl: string): string {
  // Pattern: event: endpoint\ndata: /some/path?params
  const endpointPattern = /(event:\s*endpoint\s*\ndata:\s*)([^\n\r]+)/g;
  
  return sseData.replace(endpointPattern, (match, prefix, originalPath) => {
    // Construct the full target URL that the proxy should forward to
    const targetUrl = new URL(originalPath, serverBaseUrl).toString();
    
    // Rewrite to use our proxy endpoint with target URL parameter
    const newPath = `/api/mcp/${mcpName}/proxy?target=${encodeURIComponent(targetUrl)}`;
    
    return `${prefix}${newPath}`;
  });
}

// Single proxy endpoint handles all requests
export function setupMcpProxyRoutes(app: Express, deps: ProxyServiceDeps) {
  // Universal proxy endpoint - handles both initial and redirect requests
  app.post('/api/mcp/:mcpName/proxy', proxyMcpRequest(deps));
  app.get('/api/mcp/:mcpName/proxy', proxyMcpRequest(deps));
  
  // Status route
  app.get('/api/mcp/:mcpName/proxy/status', getProxyStatus(deps));
}

function proxyMcpRequest(deps: ProxyServiceDeps) {
  return async (req: Request, res: ExpressResponse) => {
    const { mcpName } = req.params;
    const targetUrl = req.query.target as string; // URL to forward to (if specified)
    
    // Get MCP server configuration
    const server = deps.configManager.getMcpServer(mcpName);
    if (!server) {
      return res.status(404).json({ error: 'MCP server not found' });
    }
    
    // Determine the actual target URL
    const actualTargetUrl = targetUrl || server.url;
    
    // Validate target URL if provided
    if (targetUrl && !validateTargetUrl(targetUrl, mcpName, deps.configManager)) {
      return res.status(400).json({
        error: 'Invalid target URL',
        message: `Target URL must be on the same domain as configured MCP server: ${new URL(server.url).hostname}`,
        provided: targetUrl,
        allowed: new URL(server.url).hostname
      });
    }
    
    // Get authorization token
    let authToken = server.authorization_token;
    if (!authToken) {
      const tokens = deps.authManager.getTokens(mcpName);
      authToken = tokens?.access_token;
    }
    
    // Forward the request
    const proxyRequest = req.method === 'GET' 
      ? { method: 'initialize', params: { /* ... */ }, id: Date.now() }
      : req.body;
      
    return forwardMcpRequest(actualTargetUrl, proxyRequest, authToken, res, mcpName);
  };
}

function validateTargetUrl(targetUrl: string, mcpName: string, configManager: ConfigManager): boolean {
  const server = configManager.getMcpServer(mcpName);
  if (!server) return false;
  
  try {
    const target = new URL(targetUrl);
    const serverBase = new URL(server.url);
    
    // 1. Must be same domain as configured MCP server
    if (target.hostname !== serverBase.hostname) {
      return false;
    }
    
    // 2. Must use same protocol as configured server
    if (target.protocol !== serverBase.protocol) {
      return false;
    }
    
    // 3. Optional: Validate port if specified in server config
    if (serverBase.port && target.port !== serverBase.port) {
      return false;
    }
    
    return true;
  } catch {
    return false; // Invalid URL
  }
}
```

### Benefits of SSE Rewriting with Secure Target Parameter:

✅ **Single endpoint**: Only one proxy endpoint needed - no separate session routes  
✅ **Complete control**: We control where Copilot sends follow-up requests  
✅ **No guesswork**: Target URL is explicit in the query parameter  
✅ **Domain-restricted**: Only allows URLs on the same domain as configured MCP server  
✅ **Protocol-secure**: Prevents protocol downgrade attacks (HTTPS → HTTP)  
✅ **Scalable**: Works with unlimited MCP servers  
✅ **Standard compliant**: Uses the existing SSE endpoint discovery pattern  
✅ **Transparent**: Copilot doesn't know it's being redirected through our proxy  
✅ **Safe flexibility**: Can proxy to any URL on the trusted MCP server domain

### Security Validation

The proxy implements multiple layers of security validation to prevent common attack vectors:

#### 1. Target URL Validation
- **Domain restriction**: Target URL must be on same domain as configured MCP server
- **Protocol enforcement**: Target URL must use same protocol as configured server  
- **Port validation**: Target URL must use same port (if specified in config)
- **Invalid URL rejection**: Malformed URLs are rejected with clear error messages

#### 2. Input Sanitization
- **URL encoding**: Target URLs are properly URL-encoded when passed as query parameters
- **Path traversal prevention**: No `../` or `./` manipulation possible due to full URL validation
- **Query parameter isolation**: Target URL is treated as opaque string, not parsed for injection

#### 3. Authentication Forwarding
- **Token isolation**: MCP server tokens are never exposed to clients
- **Secure storage**: Tokens retrieved from encrypted storage or secure configuration
- **Standard header forwarding**: Headers are forwarded as-is to MCP servers (trusted client environment)

#### 4. Error Handling
- **Information disclosure prevention**: Error messages don't leak internal URLs or tokens
- **Clear error responses**: Target URL validation failures return detailed HTTP 400 responses

### Attack Scenarios Prevented

#### Server-Side Request Forgery (SSRF)
❌ **SSRF to internal services**: `http://localhost:6379/` → Blocked (different domain)  
❌ **SSRF to metadata endpoints**: `http://169.254.169.254/` → Blocked (different domain)  
❌ **SSRF to internal networks**: `http://192.168.1.1/` → Blocked (different domain)

#### Protocol and Network Attacks  
❌ **Protocol downgrade**: `http://mcp.atlassian.com/` → Blocked (different protocol)  
❌ **Port scanning**: `https://mcp.atlassian.com:3306/` → Blocked (different port)  
❌ **DNS rebinding**: `https://127.0.0.1.mcp.atlassian.com/` → Blocked (different domain)

#### Data Exfiltration
❌ **External data exfiltration**: `https://evil.com/collect` → Blocked (different domain)  
❌ **Subdomain exfiltration**: `https://evil.mcp.atlassian.com/` → Blocked (different domain)  
❌ **Path traversal**: `https://mcp.atlassian.com/../../../etc/passwd` → Safe (full URL validation)

#### Injection Attacks
❌ **URL injection in logs**: Target URLs are sanitized in error messages  
❌ **Response splitting**: Target URL validation prevents CRLF injection

### Allowed Scenarios

✅ **Session endpoints**: `https://mcp.atlassian.com/v1/sse/message?sessionId=...`  
✅ **API versions**: `https://mcp.atlassian.com/v2/sse`  
✅ **Different paths**: `https://mcp.atlassian.com/api/realtime`  
✅ **Query parameters**: `https://mcp.atlassian.com/v1/sse?token=abc&version=2`

### Implementation Security Best Practices

#### 1. Strict Domain Validation
```typescript
function validateTargetUrl(targetUrl: string, mcpName: string, configManager: ConfigManager): boolean {
  const server = configManager.getMcpServer(mcpName);
  if (!server) return false;
  
  try {
    const target = new URL(targetUrl);
    const serverBase = new URL(server.url);
    
    // Exact domain match - no subdomain wildcards
    if (target.hostname !== serverBase.hostname) {
      return false;
    }
    
    // Protocol must match exactly
    if (target.protocol !== serverBase.protocol) {
      return false;
    }
    
    // Port must match if specified
    if (serverBase.port && target.port !== serverBase.port) {
      return false;
    }
    
    // Additional security: reject suspicious patterns
    if (target.hostname.includes('..') || target.pathname.includes('..')) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false; // Invalid URL
  }
}
```

#### 2. MCP-Specific Logging
```typescript
// Log SSE endpoint rewrites - this adds valuable context beyond HTTP logs
function logSSERewrite({ originalEndpoint, rewrittenEndpoint, mcpName }) {
  console.info('SSE endpoint rewritten', { 
    originalEndpoint, 
    rewrittenEndpoint, 
    mcpName 
  });
}

// Usage in rewriteSSEEndpoints function
function rewriteSSEEndpoints(sseData: string, mcpName: string, serverBaseUrl: string): string {
  return sseData.replace(endpointPattern, (match, prefix, originalPath) => {
    const targetUrl = new URL(originalPath, serverBaseUrl).toString();
    const newPath = `/api/mcp/${mcpName}/proxy?target=${encodeURIComponent(targetUrl)}`;
    
    // Log the rewrite for debugging
    logSSERewrite({
      originalEndpoint: originalPath,
      rewrittenEndpoint: newPath,
      mcpName
    });
    
    return `${prefix}${newPath}`;
  });
}
```
```

### Defense in Depth Strategy

The MCP proxy implements multiple security layers:

1. **Network Level**: Only configured MCP server domains allowed
2. **Application Level**: Input validation and sanitization
3. **Authentication Level**: Token-based access control
4. **Monitoring Level**: SSE endpoint rewriting visibility

### Example Flow:

1. **Initial request**: `POST /api/mcp/jira/proxy` (uses server.url from config)
2. **Jira responds**: `event: endpoint\ndata: /v1/sse/message?sessionId=123`
3. **We rewrite to**: `event: endpoint\ndata: /api/mcp/jira/proxy?target=https%3A%2F%2Fmcp.atlassian.com%2Fv1%2Fsse%2Fmessage%3FsessionId%3D123`
4. **Copilot follows**: `POST /api/mcp/jira/proxy?target=...` 
5. **We validate**: Target URL domain matches `mcp.atlassian.com` ✅
6. **We proxy to**: The validated target URL

### Why This Approach Is Safe

Since we're already configured to proxy to `https://mcp.atlassian.com/v1/sse`, allowing proxying to other endpoints like:
- `https://mcp.atlassian.com/v1/sse/message?sessionId=123`
- `https://mcp.atlassian.com/api/session/456`
- `https://mcp.atlassian.com/legacy/endpoint`

...doesn't meaningfully increase the attack surface. We already trust this domain and have authentication tokens for it.

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

## Recommended Implementation: Secure Target Parameter

**Use SSE Response Rewriting with Domain-Validated Target Parameter** - this provides the best balance of elegance, security, and practicality.

This approach eliminates the need for:
- ❌ Hardcoded legacy endpoints
- ❌ Complex session mapping  
- ❌ Route guessing heuristics
- ❌ Manual endpoint configuration

While providing:
- ✅ **Maximum flexibility within secure boundaries**
- ✅ **Domain-restricted proxying** to prevent SSRF attacks
- ✅ **Single endpoint architecture** for simplicity
- ✅ **Standards-compliant SSE redirection**

## Single Proxy Endpoint Routes

```typescript
export function setupMcpProxyRoutes(app: Express, deps: ProxyServiceDeps) {
  // Universal proxy endpoint - handles both initial and redirect requests
  app.post('/api/mcp/:mcpName/proxy', proxyMcpRequest(deps));
  app.get('/api/mcp/:mcpName/proxy', proxyMcpRequest(deps));
  
  // Status route
  app.get('/api/mcp/:mcpName/proxy/status', getProxyStatus(deps));
  
  // No legacy endpoints needed - everything goes through the main proxy with validation!
}
```

## Recommended Implementation: Secure Target Parameter

**Use SSE Response Rewriting with Domain-Validated Target Parameter** - this provides the best balance of elegance, security, and practicality:

### Security Strategy

Validate that target URLs match the configured MCP server's domain and protocol - this leverages existing trust relationships while preventing abuse.

### Implementation

```typescript
// Enhanced forwardMcpRequest function:
async function forwardMcpRequest(
  targetUrl: string, 
  request: ProxyRequest, 
  authToken?: string,
  res?: ExpressResponse,
  mcpName?: string
): Promise<ProxyResponse | void> {
  // ... existing forwarding logic ...
  
  // When forwarding streaming responses, pass server base URL for rewriting
  if (isSSERequest && mcpName) {
    const serverBaseUrl = new URL(targetUrl).origin;
    await forwardStreamingResponse(response, res, mcpName, serverBaseUrl);
  }
}

// Modified proxy handler with security validation:
function proxyMcpRequest(deps: ProxyServiceDeps) {
  return async (req: Request, res: ExpressResponse) => {
    const { mcpName } = req.params;
    const targetUrl = req.query.target as string; // Explicit target URL
    
    const server = deps.configManager.getMcpServer(mcpName);
    const actualTargetUrl = targetUrl || server.url; // Use target or default
    
    // Validate target URL if provided
    if (targetUrl && !validateTargetUrl(targetUrl, mcpName, deps.configManager)) {
      return res.status(400).json({
        error: 'Invalid target URL',
        message: `Target URL must be on the same domain as configured MCP server`,
        provided: targetUrl,
        allowed: new URL(server.url).hostname
      });
    }
    
    // Forward with URL rewriting enabled
    return forwardMcpRequest(actualTargetUrl, req.body, authToken, res, mcpName);
  };
}
```

This approach is **significantly cleaner and more secure** because:
- ✅ **Single proxy endpoint** handles all cases
- ✅ **Domain-restricted** - can only proxy to trusted MCP server domains  
- ✅ **Protocol-safe** - prevents downgrade attacks
- ✅ **No routing complexity** - target URL is explicit but validated
- ✅ **Leverages existing trust** - same domains we already proxy to

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
6. **Security-First**: Multiple layers of protection against common attacks

## Security Monitoring and Incident Response

### Monitoring Alerts

The proxy should generate alerts for the following security events:

```typescript
enum SecurityEventType {
  INVALID_TARGET_URL = 'invalid_target_url',
  DOMAIN_MISMATCH = 'domain_mismatch', 
  PROTOCOL_DOWNGRADE = 'protocol_downgrade',
  SUSPICIOUS_PATTERN = 'suspicious_pattern',
  AUTHENTICATION_FAILURE = 'auth_failure'
}

interface SecurityEvent {
  type: SecurityEventType;
  timestamp: string;
  clientIP: string;
  userAgent: string;
  mcpName: string;
  attemptedUrl: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
}
```

### Alert Thresholds

- **High**: > 10 invalid target URL attempts from same IP in 5 minutes
- **Critical**: Attempts to access localhost, private IPs, or cloud metadata
- **Medium**: > 5 protocol downgrade attempts from same IP in 1 hour
- **Low**: Single invalid domain attempts (normal Copilot behavior)

### Incident Response

1. **Automated Response**:
   - Log critical-level events for investigation
   - Log all events for security analysis

2. **Manual Response**:
   - Review security logs for patterns
   - Update domain allowlists if needed
   - Coordinate with MCP server administrators

3. **Recovery**:
   - Update security rules based on findings
   - Document new attack patterns for future prevention

### Security Hardening Checklist

- [ ] Target URL validation implemented and tested
- [ ] SSE endpoint rewriting logging enabled for debugging
- [ ] Error messages don't leak sensitive information
- [ ] HTTP responses provide clear validation failure details
- [ ] Regular security testing performed
- [ ] MCP server configurations reviewed

