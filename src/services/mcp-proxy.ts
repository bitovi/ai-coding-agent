import type { Request, Response as ExpressResponse, Express } from 'express';
import type { ApiResponse } from '../types/index.js';
import { handleError } from './common.js';

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
  
  return async (req: Request, res: ExpressResponse) => {
    try {
      console.log(`🔄 MCP Proxy: ${req.method} ${req.path}`);
      console.log(`🔄 Headers:`, req.headers);
      
      const { mcpName } = req.params;
      
      // For GET requests (SSE), create a basic proxy request
      let proxyRequest: ProxyRequest;
      if (req.method === 'GET') {
        // SSE connections typically start with an initialize or connect request
        proxyRequest = {
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: {
              name: 'AI-Coding-Agent-Proxy',
              version: '1.0.0'
            }
          },
          id: Date.now()
        };
      } else {
        proxyRequest = req.body;
      }
      
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
  
  return async (req: Request, res: ExpressResponse) => {
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
  res?: ExpressResponse // For streaming responses
): Promise<ProxyResponse | void> {
  const headers: Record<string, string> = {
    'User-Agent': 'AI-Coding-Agent-Proxy/1.0'
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  // For GET requests (SSE), or if the target URL is an SSE endpoint, establish an event stream
  const isSSERequest = res && (res.req.method === 'GET' || serverUrl.includes('/sse'));
  
  if (isSSERequest) {
    // For SSE connections, make a GET request with appropriate headers
    headers['Accept'] = 'text/event-stream';
    headers['Cache-Control'] = 'no-cache';
    
    const response = await fetch(serverUrl, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      const errorResponse = {
        error: response.statusText || 'Error',
        message: `MCP server responded with ${response.status}: ${response.statusText}`,
        details: {
          targetStatus: response.status,
          targetStatusText: response.statusText,
          targetUrl: serverUrl
        },
        timestamp: new Date().toISOString()
      };
      
      res.status(response.status).json(errorResponse);
      return;
    }
    
    // Handle SSE response
    await forwardStreamingResponse(response, res);
    return;
  } else {
    // For POST requests, send JSON-RPC
    headers['Content-Type'] = 'application/json';
    
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: request.id || Date.now(),
        ...request
      })
    });
    
    // Check if response is streaming (SSE or chunked transfer)
    const contentType = response.headers.get('content-type');
    const transferEncoding = response.headers.get('transfer-encoding');
    
    // Only treat as streaming if response is OK and has streaming headers
    if (res && response.ok && (contentType?.includes('text/event-stream') || transferEncoding?.includes('chunked'))) {
      // Handle streaming response by forwarding stream
      await forwardStreamingResponse(response, res);
      return; // No return value for streaming
    }
    
    // Handle non-streaming response (including errors)
    if (!response.ok) {
      // Forward the actual status code from the target server
      const errorResponse = {
        error: response.statusText || 'Error',
        message: `MCP server responded with ${response.status}: ${response.statusText}`,
        details: {
          targetStatus: response.status,
          targetStatusText: response.statusText,
          targetUrl: serverUrl
        },
        timestamp: new Date().toISOString()
      };
      
      if (res) {
        res.status(response.status).json(errorResponse);
        return; // Return void for Express response
      } else {
        throw new Error(`MCP server responded with ${response.status}: ${response.statusText}`);
      }
    }
    
    // Handle regular JSON response
    return await response.json() as ProxyResponse;
  }
}

// Helper function to forward streaming responses (SSE and HTTP streaming)
async function forwardStreamingResponse(sourceResponse: Response, targetResponse: ExpressResponse): Promise<void> {
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
  
  // Forward the stream using the built-in fetch ReadableStream
  const sourceStream = sourceResponse.body;
  if (!sourceStream) {
    throw new Error('No readable stream available from MCP server');
  }
  
  try {
    // Use the ReadableStream reader API
    const reader = sourceStream.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      // Forward the chunk to the client
      targetResponse.write(value);
    }
    
    targetResponse.end();
    
  } catch (error) {
    console.error('Error forwarding stream:', error);
    
    // Send error in appropriate format
    if (isSSE) {
      targetResponse.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream forwarding failed' })}\n\n`);
    } else {
      targetResponse.write(JSON.stringify({ error: 'Stream forwarding failed' }));
    }
    targetResponse.end();
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
  
  // GET /api/mcp/:mcpName/proxy - Handle SSE connections for MCP
  app.get('/api/mcp/:mcpName/proxy', proxyMcpRequest(deps));
  
  // GET /api/mcp/:mcpName/proxy/status - Get proxy status
  app.get('/api/mcp/:mcpName/proxy/status', getProxyStatus(deps));
  
  // Legacy SSE endpoint that Copilot falls back to
  app.post('/v1/sse/message', async (req, res) => {
    try {
      console.log(`🔄 Legacy SSE: ${req.method} ${req.path}`);
      console.log(`🔄 Query params:`, req.query);
      console.log(`🔄 Body:`, req.body);
      
      // For legacy SSE fallback, we need to determine which MCP server to proxy to
      // For now, default to 'jira' - in production this could be configurable
      const mcpName = 'jira';
      const server = deps.configManager.getMcpServer(mcpName);
      
      if (!server) {
        return res.status(404).json({
          error: 'Not Found',
          message: `MCP server '${mcpName}' not found`,
          timestamp: new Date().toISOString()
        });
      }
      
      // Get authorization token
      let authToken = server.authorization_token;
      if (!authToken) {
        const tokens = deps.authManager.getTokens(mcpName);
        authToken = tokens?.access_token;
      }
      
      // Construct the full Jira SSE endpoint with session ID
      const baseUrl = 'https://mcp.atlassian.com';
      const sessionId = req.query.sessionId;
      const targetUrl = sessionId 
        ? `${baseUrl}/v1/sse/message?sessionId=${sessionId}`
        : `${baseUrl}/v1/sse/message`;
      
      console.log(`🔄 Forwarding to: ${targetUrl}`);
      
      // Forward to the actual Jira SSE endpoint
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Coding-Agent-Proxy/1.0'
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(req.body)
      });
      
      if (!response.ok) {
        return res.status(response.status).json({
          error: response.statusText || 'Error',
          message: `MCP server responded with ${response.status}: ${response.statusText}`,
          timestamp: new Date().toISOString()
        });
      }
      
      // Check if response is streaming
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/event-stream')) {
        await forwardStreamingResponse(response, res);
      } else {
        const result = await response.json();
        res.json(result);
      }
      
    } catch (error) {
      console.error('Legacy SSE error:', error);
      handleError(res, error);
    }
  });
}
