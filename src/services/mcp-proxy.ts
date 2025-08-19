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
      const { mcpName } = req.params;
      const targetUrl = req.query.target as string;
      
      // Handle requests differently based on whether we have a target parameter
      let proxyRequest: ProxyRequest | null = null;
      
      if (targetUrl) {
        // If target URL is provided (from rewritten SSE endpoint), 
        // we still need to read the request body for POST requests
        if (req.method === 'POST' && req.body) {
          proxyRequest = req.body;
        } else {
          proxyRequest = null;
        }
      } else if (req.method === 'GET') {
        // For GET requests without target (initial MCP connection), create initialization
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
        // For POST requests, use request body
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
      
      // 3. Determine the actual target URL
      const actualTargetUrl = targetUrl || server.url;
      
      // 4. Validate target URL if provided
      if (targetUrl && !validateTargetUrl(targetUrl, mcpName, configManager)) {
        return res.status(400).json({
          error: 'Invalid target URL',
          message: `Target URL must be on the same domain as configured MCP server: ${new URL(server.url).hostname}`,
          provided: targetUrl,
          allowed: new URL(server.url).hostname
        });
      }
      
      // 3. Get authorization token from AuthManager
      let authToken = server.authorization_token;
      if (!authToken) {
        const tokens = authManager.getTokens(mcpName);
        authToken = tokens?.access_token;
      }
      
      // 4. Forward request with proper headers
      const response = await forwardMcpRequest(actualTargetUrl, proxyRequest, authToken, res, mcpName);
      
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

// Helper function to validate target URLs for security
function validateTargetUrl(targetUrl: string, mcpName: string, configManager: any): boolean {
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
    
    // 4. Additional security: reject suspicious patterns
    if (target.hostname.includes('..') || target.pathname.includes('..')) {
      return false;
    }
    
    return true;
  } catch {
    return false; // Invalid URL
  }
}

// Helper function to rewrite SSE endpoint URLs to use our proxy
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

// Helper function to forward requests to MCP servers
async function forwardMcpRequest(
  serverUrl: string, 
  request: ProxyRequest | null, 
  authToken?: string,
  res?: ExpressResponse, // For streaming responses
  mcpName?: string // For SSE rewriting
): Promise<ProxyResponse | void> {
  const headers: Record<string, string> = {
    'User-Agent': 'AI-Coding-Agent-Proxy/1.0'
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  // For GET requests (SSE), establish an event stream
  // Note: Don't force SSE just because URL contains '/sse' - respect the HTTP method
  const isSSERequest = res && res.req.method === 'GET';
  
  if (isSSERequest) {
    return await forwardSSERequest(serverUrl, headers, res, mcpName);
  } else {
    return await forwardHttpRequest(serverUrl, request, headers, res, mcpName);
  }
}

// Helper function to handle SSE (Server-Sent Events) requests
async function forwardSSERequest(
  serverUrl: string,
  headers: Record<string, string>,
  res: ExpressResponse,
  mcpName?: string
): Promise<void> {
  // For SSE connections, make a GET request with appropriate headers
  headers['Accept'] = 'text/event-stream';
  headers['Cache-Control'] = 'no-cache';
  
  const fetchStartTime = Date.now();
  let response;
  
  try {
    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 120000); // 120 second timeout
    
    response = await fetch(serverUrl, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
  } catch (error) {
    const fetchTime = Date.now() - fetchStartTime;
    
    res.status(500).json({
      error: 'Fetch Error',
      message: `Failed to connect to MCP server: ${error.message}`,
      details: {
        errorName: error.name,
        serverUrl,
        fetchTime
      },
      timestamp: new Date().toISOString()
    });
    return;
  }
  
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
  await forwardStreamingResponse(response, res, mcpName, new URL(serverUrl).origin);
}

// Helper function to handle regular HTTP requests (POST/JSON-RPC)
async function forwardHttpRequest(
  serverUrl: string,
  request: ProxyRequest | null,
  headers: Record<string, string>,
  res?: ExpressResponse,
  mcpName?: string
): Promise<ProxyResponse | void> {
  // For POST requests, send JSON-RPC (if request is provided)
  // For direct proxy requests, just forward as-is
  if (request) {
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
      await forwardStreamingResponse(response, res, mcpName, new URL(serverUrl).origin);
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
  } else {
    // Direct proxy request (null request) - forward the raw HTTP request
    // This handles direct GET requests to SSE endpoints with target parameter
    const method = res?.req.method || 'GET';
    
    // Set appropriate headers for different request types
    if (method === 'GET') {
      headers['Accept'] = 'text/event-stream, */*';
      headers['Cache-Control'] = 'no-cache';
    }
    
    const response = await fetch(serverUrl, {
      method: method,
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
      
      if (res) {
        res.status(response.status).json(errorResponse);
        return;
      } else {
        throw new Error(`MCP server responded with ${response.status}: ${response.statusText}`);
      }
    }
    
    // Check if this is a streaming response
    const contentType = response.headers.get('content-type');
    const transferEncoding = response.headers.get('transfer-encoding');
    
    if (res && (contentType?.includes('text/event-stream') || transferEncoding?.includes('chunked'))) {
      // Handle streaming response
      await forwardStreamingResponse(response, res, mcpName, new URL(serverUrl).origin);
      return;
    } else {
      // Handle regular response
      return await response.json() as ProxyResponse;
    }
  }
}

// Helper function to forward streaming responses (SSE and HTTP streaming)
async function forwardStreamingResponse(
  sourceResponse: Response, 
  targetResponse: ExpressResponse, 
  mcpName?: string, 
  serverBaseUrl?: string
): Promise<void> {
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
    
    // Handle client disconnect
    targetResponse.on('close', () => {
      reader.cancel('Client disconnected');
    });
    
    targetResponse.on('error', (error) => {
      reader.cancel('Target response error');
    });
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      // For SSE responses with rewriting capability, process the chunk
      if (isSSE && mcpName && serverBaseUrl) {
        // Convert chunk to string, rewrite SSE endpoints, then convert back
        let chunk = new TextDecoder().decode(value);
        chunk = rewriteSSEEndpoints(chunk, mcpName, serverBaseUrl);
        targetResponse.write(new TextEncoder().encode(chunk));
      } else {
        // Forward the chunk as-is
        targetResponse.write(value);
      }
    }
    
    targetResponse.end();
    
  } catch (error) {
    console.error('Error forwarding stream:', error);
    
    // Send error in appropriate format
    if (isSSE) {
      targetResponse.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream forwarding failed', details: error.message })}\n\n`);
    } else {
      targetResponse.write(JSON.stringify({ error: 'Stream forwarding failed', details: error.message }));
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
}
