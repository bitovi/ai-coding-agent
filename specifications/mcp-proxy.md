# MCP Broker/Proxy Specification

## Overview

The AI Coding Agent will support proxying/brokering MCP server requests. This allows the agent to act as an intermediary between clients and MCP servers, enabling:

1. **Authentication forwarding**: Automatically include stored authorization tokens
2. **Request routing**: Route requests to appropriate MCP servers
3. **Response transformation**: Handle responses from proxied servers
4. **Connection management**: Abstract away direct server connections

## Configuration

### MCP Server Configuration Enhancement

MCP servers in `/examples/mcp-servers.json` will support a new `proxy` property:

```json
[
  {
    "name": "jira",
    "type": "url",
    "url": "https://mcp.atlassian.com/v1/sse",
    "authorization_token": null,
    "proxy": true,
    "tool_configuration": {
      "enabled": true
    }
  },
  {
    "name": "github",
    "type": "url", 
    "url": "https://api.githubcopilot.com/mcp/",
    "authorization_token": "ghp_token_here",
    "proxy": true,
    "tool_configuration": {
      "enabled": true
    }
  }
]
```

**Configuration Properties:**
- `proxy: boolean` - When `true`, enables proxy endpoints for this MCP server
- All existing properties remain supported (`url`, `authorization_token`, etc.)

## API Endpoints

### Core Proxy Endpoint

For each MCP server with `proxy: true`, the following endpoint will be created:

#### Generic MCP Proxy
**`POST /api/mcp/:mcpName/proxy`**

Forwards arbitrary MCP requests to the configured server. This single endpoint handles all MCP protocol operations.

**Request Body (Tool List):**
```json
{
  "method": "tools/list",
  "params": {}
}
```

**Request Body (Tool Execution):**
```json
{
  "method": "tools/call",
  "params": {
    "name": "create-issue",
    "arguments": {
      "summary": "Bug fix needed",
      "description": "User cannot login"
    }
  }
}
```

**Request Body (Resource List):**
```json
{
  "method": "resources/list",
  "params": {}
}
```

**Request Body (Resource Read):**
```json
{
  "method": "resources/read",
  "params": {
    "uri": "resource://path/to/file"
  }
}
```

**Response (MCP JSON-RPC):**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [...] // or tool result, or resources, etc.
  },
  "id": 1
}
```

**Streaming Responses:**
The proxy automatically detects and forwards both Server-Sent Events and HTTP streaming responses:

**Server-Sent Events (SSE):**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: message
data: {"type": "progress", "progress": 0.1}

event: message  
data: {"type": "content", "text": "Processing..."}

event: message
data: {"type": "result", "content": [{"type": "text", "text": "Complete!"}]}
```

**HTTP Streaming (Chunked Transfer):**
```
Content-Type: application/json
Transfer-Encoding: chunked

{"type": "progress", "progress": 0.1}
{"type": "content", "text": "Processing..."}  
{"type": "result", "content": [{"type": "text", "text": "Complete!"}]}
```

The proxy transparently forwards streaming responses while maintaining the SSE protocol structure.

### Status Endpoint

#### Proxy Status
**`GET /api/mcp/:mcpName/proxy/status`**

Returns status of the proxied MCP server.

**Response:**
```json
{
  "name": "jira",
  "isProxy": true,
  "targetUrl": "https://mcp.atlassian.com/v1/sse",
  "isAuthorized": true,
  "hasToken": true,
  "lastProxyRequest": "2024-01-15T10:30:00Z",
  "proxyRequestCount": 42
}
```

### Optional Convenience Endpoints

### Decision on Convenience Endpoints

After analyzing the current codebase and MCP usage patterns, **convenience endpoints are NOT recommended** for the following reasons:

1. **Limited Usage Patterns**: The codebase shows that MCP interactions primarily happen through Claude Code/SDK, not direct client calls
2. **Complexity vs. Value**: The convenience endpoints add significant implementation complexity for minimal benefit
3. **MCP Protocol Alignment**: Direct MCP JSON-RPC requests maintain protocol consistency and are self-documenting
4. **Flexibility**: The generic proxy endpoint can handle all MCP operations without endpoint proliferation

**Recommendation**: Implement only the generic proxy endpoint `POST /api/mcp/:mcpName/proxy` which provides full MCP functionality through standard JSON-RPC requests.

## Implementation Details

### 1. Configuration Manager Updates

**File:** `src/config/ConfigManager.js`

Add validation for the `proxy` property:

```javascript
validateMcpServer(server) {
  // ...existing validation...
  
  // Validate proxy configuration
  if (server.proxy === true) {
    if (server.type !== 'url') {
      throw new Error(`Proxy is only supported for 'url' type MCP servers, got '${server.type}'`);
    }
    if (!server.url) {
      throw new Error(`Proxy-enabled MCP server '${server.name}' must have a valid URL`);
    }
  }
}
```

### 2. Proxy Service Implementation

**File:** `src/services/mcp-proxy.ts`

Following the existing service pattern, implement individual handler functions:

```typescript
import type { Request, Response, Express } from 'express';
import type { ApiResponse } from '../types/index.js';
import { handleError } from './common.js';
import fetch from 'node-fetch';

interface ProxyRequest {
  method: string;
  params?: any;
  id?: string | number;
}

interface ProxyResponse {
  jsonrpc: string;
  result?: any;
  error?: any;
  id?: string | number;
}

export interface ProxyServiceDeps {
  configManager: {
    getMcpServers: () => any[];
    getMcpServer: (name: string) => any;
  };
  authManager: {
    isAuthorized: (mcpServer: any) => Promise<boolean>;
    getTokens: (serverName: string) => any;
  };
}

export function proxyMcpRequest(deps: ProxyServiceDeps) {
  const { configManager, authManager } = deps;
  
  return async (req: Request, res: Response) => {
    try {
      const { mcpName } = req.params;
      const proxyRequest: ProxyRequest = req.body;
      
      // 1. Get MCP server configuration
      const server = configManager.getMcpServer(mcpName);
      if (!server) {
        return res.status(404).json({
          error: 'Not Found',
          message: `MCP server '${mcpName}' not found`,
          timestamp: new Date().toISOString()
        });
      }
      
      // 2. Validate proxy is enabled
      if (!server.proxy) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `MCP server '${mcpName}' does not have proxy enabled`,
          timestamp: new Date().toISOString()
        });
      }
      
      // 3. Get authorization token from AuthManager
      let authToken = server.authorization_token;
      if (!authToken) {
        const tokens = authManager.getTokens(mcpName);
        authToken = tokens?.access_token;
      }
      
      // 4. Forward request with proper headers
      const response = await forwardMcpRequest(server.url, proxyRequest, authToken, res);
      
      // 5. Return response (only for non-streaming responses)
      if (response) {
        res.json(response);
      }
      // Note: For streaming responses, the response is handled by forwardStreamingResponse
    } catch (error) {
      handleError(res, error);
    }
  };
}

export function getProxyStatus(deps: ProxyServiceDeps) {
  const { configManager, authManager } = deps;
  
  return async (req: Request, res: Response) => {
    try {
      const { mcpName } = req.params;
      
      const server = configManager.getMcpServer(mcpName);
      if (!server) {
        return res.status(404).json({
          error: 'Not Found',
          message: `MCP server '${mcpName}' not found`,
          timestamp: new Date().toISOString()
        });
      }
      
      const isAuthorized = await authManager.isAuthorized(server);
      const tokens = authManager.getTokens(mcpName);
      const hasToken = !!(server.authorization_token || tokens?.access_token);
      
      const apiResponse: ApiResponse = {
        success: true,
        data: {
          name: mcpName,
          isProxy: !!server.proxy,
          targetUrl: server.url,
          isAuthorized,
          hasToken,
          lastProxyRequest: null, // Could be tracked in future
          proxyRequestCount: 0    // Could be tracked in future
        },
        timestamp: new Date().toISOString()
      };
      
      res.json(apiResponse);
    } catch (error) {
      handleError(res, error);
    }
  };
}

// Helper function to forward requests to MCP servers
async function forwardMcpRequest(
  serverUrl: string, 
  request: ProxyRequest, 
  authToken?: string,
  res?: Response // For streaming responses
): Promise<ProxyResponse | void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'AI-Coding-Agent-Proxy/1.0'
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const response = await fetch(serverUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: request.id || Date.now(),
      ...request
    })
  });
  
  if (!response.ok) {
    throw new Error(`MCP server responded with ${response.status}: ${response.statusText}`);
  }
  
  // Check if response is streaming (SSE or chunked transfer)
  const contentType = response.headers.get('content-type');
  const transferEncoding = response.headers.get('transfer-encoding');
  
  if (res && (contentType?.includes('text/event-stream') || transferEncoding?.includes('chunked'))) {
    // Handle streaming response by forwarding stream
    await forwardStreamingResponse(response, res);
    return; // No return value for streaming
  }
  
  // Handle regular JSON response
  return await response.json() as ProxyResponse;
}

// Helper function to forward streaming responses (SSE and HTTP streaming)
async function forwardStreamingResponse(sourceResponse: Response, targetResponse: Response): Promise<void> {
  const contentType = sourceResponse.headers.get('content-type');
  const isSSE = contentType?.includes('text/event-stream');
  
  // Forward all relevant headers from source to target
  const headersToForward = [
    'content-type',
    'cache-control', 
    'connection',
    'transfer-encoding',
    'access-control-allow-origin',
    'access-control-allow-headers'
  ];
  
  const responseHeaders: Record<string, string> = {};
  headersToForward.forEach(header => {
    const value = sourceResponse.headers.get(header);
    if (value) {
      responseHeaders[header] = value;
    }
  });
  
  // Set default SSE headers if this is an SSE response without proper headers
  if (isSSE) {
    responseHeaders['content-type'] = 'text/event-stream';
    responseHeaders['cache-control'] = responseHeaders['cache-control'] || 'no-cache';
    responseHeaders['connection'] = responseHeaders['connection'] || 'keep-alive';
    responseHeaders['access-control-allow-origin'] = responseHeaders['access-control-allow-origin'] || '*';
  }
  
  // Write headers
  targetResponse.writeHead(200, responseHeaders);
  
  // Forward the stream
  const reader = sourceResponse.body?.getReader();
  if (!reader) {
    throw new Error('No readable stream available from MCP server');
  }
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      // Forward the chunk to the client
      targetResponse.write(value);
    }
  } catch (error) {
    console.error('Error forwarding stream:', error);
    
    // Send error in appropriate format
    if (isSSE) {
      targetResponse.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream forwarding failed' })}\n\n`);
    } else {
      // For HTTP streaming, just end the connection
      targetResponse.write(JSON.stringify({ error: 'Stream forwarding failed' }));
    }
  } finally {
    targetResponse.end();
    reader.releaseLock();
  }
}

/**
 * Wire up MCP proxy routes to the Express app
 * @param app - Express application instance 
 * @param deps - Dependencies for dependency injection
 */
export function setupMcpProxyRoutes(app: Express, deps: ProxyServiceDeps) {
  // POST /api/mcp/:mcpName/proxy - Forward generic MCP requests
  app.post('/api/mcp/:mcpName/proxy', proxyMcpRequest(deps));
  
  // GET /api/mcp/:mcpName/proxy/status - Get proxy status
  app.get('/api/mcp/:mcpName/proxy/status', getProxyStatus(deps));
}
```

### 3. Service Integration

**Update:** `src/services/index.ts`

Add the MCP proxy exports:

```typescript
export { 
  proxyMcpRequest,
  getProxyStatus,
  setupMcpProxyRoutes 
} from './mcp-proxy.js';
```

### 4. Main Application Integration

**Update:** `index.ts` or main application file

Import and wire up the MCP proxy routes:

```typescript
import { setupMcpProxyRoutes } from './src/services/mcp-proxy.js';

// In your main application setup method:
setupRoutes(): void {
  // ...existing route setup...
  
  // Set up MCP proxy routes
  const proxyDeps = {
    configManager: this.configManager,
    authManager: this.authManager
  };
  
  setupMcpProxyRoutes(this.app, proxyDeps);
  
  // ...rest of route setup...
}
```

### 5. Authorization Token Forwarding

**Update:** `index.ts` or main application file

Import and wire up the MCP proxy routes:

```typescript
import { setupMcpProxyRoutes } from './src/services/mcp-proxy.js';

// In your main application setup method:
setupRoutes(): void {
  // ...existing route setup...
  
  // Set up MCP proxy routes
  const proxyDeps = {
    configManager: this.configManager,
    authManager: this.authManager
  };
  
  setupMcpProxyRoutes(this.app, proxyDeps);
  
  // ...rest of route setup...
}

The proxy will automatically include authorization tokens from the AuthManager:

1. **Static tokens**: From `authorization_token` config or environment variables
2. **OAuth tokens**: From stored OAuth tokens (access_token)
3. **Token refresh**: Automatically refresh expired OAuth tokens

**Request Headers:**
```http
Authorization: Bearer {access_token}
Content-Type: application/json
User-Agent: AI-Coding-Agent-Proxy/1.0
X-Forwarded-For: {client_ip}
```

### 6. Error Handling

**Error Responses:**
```json
{
  "error": "ProxyError",
  "message": "MCP server 'jira' is not configured for proxying",
  "details": {
    "mcpName": "jira",
    "proxyEnabled": false
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Common Error Cases:**
- MCP server not found: `404 Not Found`
- Proxy not enabled: `400 Bad Request`
- Authorization failed: `401 Unauthorized`
- Target server unreachable: `502 Bad Gateway`
- Invalid MCP request: `400 Bad Request`

## Integration Points

### 1. Connections API Updates

The existing `/api/connections` endpoint will include proxy information:

```json
{
  "connections": [
    {
      "name": "jira",
      "type": "mcp-server",
      "isAvailable": true,
      "isProxy": true,
      "proxyEndpoints": [
        "/api/mcp/jira/proxy"
      ],
      "details": {
        "targetUrl": "https://mcp.atlassian.com/v1/sse",
        "lastAuthorized": "2024-01-15T09:00:00Z"
      }
    }
  ]
}
```

### 2. UI Integration

The frontend can use the generic proxy endpoint for MCP operations:

```javascript
// Generic MCP proxy call (non-streaming)
const response = await fetch('/api/mcp/jira/proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'tools/call',
    params: {
      name: 'create-issue',
      arguments: {
        summary: 'Bug fix needed',
        description: 'User cannot login'
      }
    }
  })
});

// Streaming MCP proxy call (handles both SSE and HTTP streaming)
fetch('/api/mcp/claude/proxy', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream, application/json' // Accept both SSE and streaming JSON
  },
  body: JSON.stringify({
    method: 'tools/call',
    params: {
      name: 'generate-code',
      arguments: { prompt: 'Create a React component' }
    }
  })
}).then(response => {
  const contentType = response.headers.get('content-type');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  function readStream() {
    reader.read().then(({ done, value }) => {
      if (done) return;
      
      const chunk = decoder.decode(value);
      
      // Handle Server-Sent Events
      if (contentType?.includes('text/event-stream')) {
        const events = chunk.split('\n\n');
        events.forEach(event => {
          if (event.startsWith('data: ')) {
            const data = JSON.parse(event.substring(6));
            console.log('SSE data:', data);
          }
        });
      }
      // Handle HTTP streaming (JSONL or chunked JSON)
      else {
        // Split by newlines for JSONL format
        const lines = chunk.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          try {
            const data = JSON.parse(line);
            console.log('Streaming JSON:', data);
          } catch (e) {
            // Handle partial JSON chunks
            console.log('Partial chunk:', line);
          }
        });
      }
      
      readStream();
    });
  }
  
  readStream();
});
```

## Testing Strategy

### 1. Unit Tests
- Configuration validation for proxy property
- Authorization token forwarding logic
- Request/response transformation
- Error handling scenarios

### 2. Integration Tests
- End-to-end proxy requests
- Authentication flow with proxied servers
- Multiple concurrent proxy requests
- Proxy with different MCP server types
- **Streaming response handling (SSE and HTTP)**
- **SSE event forwarding accuracy**
- **HTTP chunked transfer encoding support**

### 3. Manual Testing
```bash
# Test proxy functionality (non-streaming)
curl -X POST http://localhost:3000/api/mcp/jira/proxy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"method": "tools/list", "params": {}}'

# Test tool execution via proxy (non-streaming)
curl -X POST http://localhost:3000/api/mcp/jira/proxy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"method": "tools/call", "params": {"name": "create-issue", "arguments": {"summary": "Test issue"}}}'

# Test SSE streaming proxy functionality
curl -X POST http://localhost:3000/api/mcp/claude/proxy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: text/event-stream" \
  -d '{"method": "tools/call", "params": {"name": "generate-code", "arguments": {"prompt": "Create a function"}}}'

# Test HTTP streaming proxy functionality
curl -X POST http://localhost:3000/api/mcp/claude/proxy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json" \
  -d '{"method": "tools/call", "params": {"name": "stream-process", "arguments": {"data": "large-dataset"}}}'
```

## Security Considerations

1. **Token Security**: Authorization tokens are never exposed to clients
2. **Request Validation**: All proxy requests are validated before forwarding
3. **Rate Limiting**: Consider implementing rate limiting for proxy endpoints
4. **Audit Logging**: Log all proxy requests for security monitoring
5. **CORS Handling**: Proper CORS configuration for cross-origin proxy requests
6. **Stream Security**: Ensure streaming connections are properly closed and don't leak resources
7. **Connection Limits**: Monitor and limit concurrent streaming connections per client

## Benefits

1. **Simplified Client Integration**: Clients don't need to handle MCP protocol directly
2. **Centralized Authentication**: All token management handled by the agent
3. **Request Standardization**: Consistent API interface regardless of target MCP server
4. **Enhanced Security**: Tokens never leave the server environment
5. **Monitoring & Logging**: Centralized logging of all MCP interactions
6. **Comprehensive Streaming Support**: Transparent forwarding of both Server-Sent Events and HTTP streaming responses
7. **Protocol Flexibility**: Handles request/response, SSE, and chunked transfer encoding seamlessly

This specification provides a complete foundation for implementing MCP proxy functionality that integrates seamlessly with the existing authentication and configuration systems.

