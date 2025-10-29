import type { Request, Response as ExpressResponse, Express } from 'express';
import type { ApiResponse } from '../types/index.js';
import { handleError } from './common.js';
import { mcpTrafficLogger } from '../utils/mcp-traffic-logger.js';

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
      
      console.log(`🔗 [MCP-PROXY] Received ${req.method} request for MCP server: ${mcpName}`);
      console.log(`🔗 [MCP-PROXY] Target URL from query: ${targetUrl || 'none'}`);
      console.log(`🔗 [MCP-PROXY] Request headers:`, JSON.stringify(req.headers, null, 2));
      
      // Handle requests differently based on whether we have a target parameter
      let proxyRequest: ProxyRequest | null = null;
      
      if (targetUrl) {
        console.log(`🔗 [MCP-PROXY] Processing request with target URL`);
        // If target URL is provided (from rewritten SSE endpoint), 
        // we still need to read the request body for POST requests
        if (req.method === 'POST' && req.body) {
          proxyRequest = req.body;
          console.log(`🔗 [MCP-PROXY] Using POST body as proxy request:`, JSON.stringify(proxyRequest, null, 2));
        } else {
          proxyRequest = null;
          console.log(`🔗 [MCP-PROXY] No request body to forward`);
        }
      } else if (req.method === 'GET') {
        console.log(`🔗 [MCP-PROXY] Creating initialization request for GET`);
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
        console.log(`🔗 [MCP-PROXY] Created initialization request:`, JSON.stringify(proxyRequest, null, 2));
      } else {
        console.log(`🔗 [MCP-PROXY] Using request body for ${req.method} request`);
        // For POST requests, use request body
        proxyRequest = req.body;
        console.log(`🔗 [MCP-PROXY] Request body:`, JSON.stringify(proxyRequest, null, 2));
      }
      
      // 1. Get MCP server configuration
      const server = configManager.getMcpServer(mcpName);
      console.log(`🔗 [MCP-PROXY] Looking up MCP server config for: ${mcpName}`);
      
      if (!server) {
        console.error(`❌ [MCP-PROXY] MCP server '${mcpName}' not found in configuration`);
        console.log(`🔗 [MCP-PROXY] Available servers:`, configManager.getMcpServers().map(s => s.name));
        return res.status(404).json({
          error: 'Not Found',
          message: `MCP server '${mcpName}' not found`,
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`✅ [MCP-PROXY] Found server config:`, JSON.stringify(server, null, 2));
      
      // 2. Validate proxy is enabled
      console.log(`🔗 [MCP-PROXY] Checking if proxy is enabled. server.proxy = ${server.proxy}`);
      if (!server.proxy) {
        console.error(`❌ [MCP-PROXY] Proxy not enabled for server '${mcpName}'`);
        return res.status(400).json({
          error: 'Bad Request',
          message: `MCP server '${mcpName}' does not have proxy enabled`,
          timestamp: new Date().toISOString()
        });
      }
      console.log(`✅ [MCP-PROXY] Proxy is enabled for server '${mcpName}'`);
      
      // 3. Determine the actual target URL
      const actualTargetUrl = targetUrl || server.url;
      console.log(`🔗 [MCP-PROXY] Actual target URL: ${actualTargetUrl}`);
      
      // 4. Validate target URL if provided
      if (targetUrl && !validateTargetUrl(targetUrl, mcpName, configManager)) {
        console.error(`❌ [MCP-PROXY] Invalid target URL: ${targetUrl}`);
        console.error(`❌ [MCP-PROXY] Allowed hostname: ${new URL(server.url).hostname}`);
        return res.status(400).json({
          error: 'Invalid target URL',
          message: `Target URL must be on the same domain as configured MCP server: ${new URL(server.url).hostname}`,
          provided: targetUrl,
          allowed: new URL(server.url).hostname
        });
      }
      
      if (targetUrl) {
        console.log(`✅ [MCP-PROXY] Target URL validation passed`);
      }
      
      // 3. Get authorization token from AuthManager
      let authToken = server.authorization_token;
      console.log(`🔗 [MCP-PROXY] Server has authorization_token: ${!!authToken}`);
      console.log(`🔐 [DEBUG] Server authorization_token (FULL): ${authToken || 'null'}`);
      
      if (!authToken) {
        console.log(`🔗 [MCP-PROXY] No authorization_token in config, checking auth manager for tokens...`);
        const tokens = authManager.getTokens(mcpName);
        console.log(`🔗 [MCP-PROXY] Found tokens in auth manager: ${tokens ? 'YES' : 'NO'}`);
        console.log(`🔐 [DEBUG] Auth manager tokens (FULL): ${JSON.stringify(tokens, null, 2)}`);
        
        authToken = tokens?.access_token;
      }
      
      console.log(`🔗 [MCP-PROXY] Final auth token available: ${!!authToken}`);
      console.log(`🔐 [DEBUG] Final auth token (FULL): ${authToken || 'null'}`);
      
      // 4. Forward request with proper headers
      console.log(`🔗 [MCP-PROXY] Forwarding request to: ${actualTargetUrl}`);
      console.log(`🔗 [MCP-PROXY] With auth token: ${authToken ? 'YES' : 'NO'}`);
      console.log(`🔗 [MCP-PROXY] Request type: ${proxyRequest ? 'JSON-RPC' : 'Direct'}`);
      
      const response = await forwardMcpRequest(actualTargetUrl, proxyRequest, authToken, res, mcpName, req.headers);
      
      // 5. Return response (only for non-streaming responses)
      if (response) {
        console.log(`✅ [MCP-PROXY] Received non-streaming response:`, JSON.stringify(response, null, 2));
        res.json(response);
      } else {
        console.log(`✅ [MCP-PROXY] Streaming response handled`);
      }
      // Note: For streaming responses, the response is handled by forwardStreamingResponse
    } catch (error) {
      console.error(`❌ [MCP-PROXY] Error in proxyMcpRequest:`, error);
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
  mcpName?: string, // For SSE rewriting
  originalHeaders?: Record<string, string | string[]> // Forward original client headers
): Promise<ProxyResponse | void> {
  console.log(`🚀 [MCP-FORWARD] Starting request to: ${serverUrl}`);
  console.log(`🚀 [MCP-FORWARD] Request method: ${request?.method || 'N/A'}`);
  console.log(`🚀 [MCP-FORWARD] Has auth token: ${authToken ? 'YES' : 'NO'}`);
  
  // Generate request ID for tracking
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 [MCP-FORWARD] Request ID: ${requestId}`);
  
  const headers: Record<string, string> = {};

  // Forward all headers from the original client request except those we need to control
  if (originalHeaders) {
    const headersToExclude = new Set([
      'host',           // Will be set to target server
      'authorization', // Will be set by proxy if needed
      'content-type',  // Will be set by proxy based on request type
      'connection',    // Managed by HTTP client
      'content-length', // Will be recalculated
      'transfer-encoding', // Managed by HTTP client
      'expect',        // Can interfere with proxy
      'upgrade',       // Can interfere with proxy
      'proxy-authorization', // Proxy-specific
      'proxy-connection'     // Proxy-specific
    ]);
    
    for (const [headerName, headerValue] of Object.entries(originalHeaders)) {
      const lowerHeaderName = headerName.toLowerCase();
      
      // Skip headers that the proxy needs to control
      if (headersToExclude.has(lowerHeaderName)) {
        continue;
      }
      
      if (headerValue) {
        // Handle both string and string[] values
        const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
        // Preserve original header case
        headers[headerName] = value;
      }
    }
    
    console.log(`🚀 [MCP-FORWARD] Forwarded client headers:`, JSON.stringify(headers, null, 2));
  }
  
  // Set default User-Agent if not provided by client
  if (!headers['User-Agent'] && !headers['user-agent']) {
    headers['User-Agent'] = 'AI-Coding-Agent-Proxy/1.0';
  }
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
    console.log(`🚀 [MCP-FORWARD] Added Authorization header with Bearer token`);
    console.log(`🔐 [DEBUG] Full Authorization header: Bearer ${authToken}`);
  } else {
    console.log(`⚠️  [MCP-FORWARD] No auth token provided - request will be sent without Authorization header`);
  }
  
  // Log headers safely (without exposing sensitive Authorization header)
  const safeHeaders = { ...headers };
  // TEMPORARY DEBUG: Show full Authorization header for debugging
  console.log(`🔐 [DEBUG] Full Authorization header being sent: ${headers['Authorization'] || 'none'}`);
  if (safeHeaders['Authorization']) {
    safeHeaders['Authorization'] = '[Bearer token present]';
  }
  console.log(`🚀 [MCP-FORWARD] Final request headers:`, JSON.stringify(safeHeaders, null, 2));
  
  // For GET requests (SSE), establish an event stream
  // Note: Don't force SSE just because URL contains '/sse' - respect the HTTP method
  const isSSERequest = res && res.req.method === 'GET';
  console.log(`🚀 [MCP-FORWARD] Is SSE request: ${isSSERequest}`);
  
  if (isSSERequest) {
    console.log(`🚀 [MCP-FORWARD] Handling as SSE request`);
    return await forwardSSERequest(serverUrl, headers, res, mcpName);
  } else {
    console.log(`🚀 [MCP-FORWARD] Handling as HTTP request`);
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
  console.log(`📡 [MCP-SSE] Starting SSE request to: ${serverUrl}`);
  
  // Generate request ID for tracking
  const requestId = `sse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`📡 [MCP-SSE] Request ID: ${requestId}`);
  
  // For SSE connections, forward the GET request as-is with appropriate headers
  if (!headers['Accept'] && !headers['accept']) {
    headers['Accept'] = 'text/event-stream';
  }
  if (!headers['Cache-Control'] && !headers['cache-control']) {
    headers['Cache-Control'] = 'no-cache';
  }
  
  console.log(`📡 [MCP-SSE] SSE headers:`, JSON.stringify(headers, null, 2));
  
  // Log the request
  if (mcpName) {
    await mcpTrafficLogger.logRequest(mcpName, {
      method: 'GET',
      url: serverUrl,
      headers,
      isStreaming: true
    }, requestId);
  }
  
  const fetchStartTime = Date.now();
  let response;
  
  try {
    console.log(`📡 [MCP-SSE] Making GET request to MCP server...`);
    
    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`⏰ [MCP-SSE] Request timeout after 120 seconds`);
      controller.abort();
    }, 120000); // 120 second timeout
    
    response = await fetch(serverUrl, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    console.log(`📡 [MCP-SSE] Fetch completed. Status: ${response.status} ${response.statusText}`);
    console.log(`📡 [MCP-SSE] Response headers:`, JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
    
    // Log the response
    if (mcpName) {
      await mcpTrafficLogger.logResponse(requestId, mcpName, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        isStreaming: true,
        contentType: response.headers.get('content-type') || undefined
      });
    }
    
  } catch (error) {
    const fetchTime = Date.now() - fetchStartTime;
    console.error(`❌ [MCP-SSE] Fetch error after ${fetchTime}ms:`, error);
    
    // Log the error
    if (mcpName) {
      await mcpTrafficLogger.logError(requestId, mcpName, {
        error: error.name || 'FetchError',
        message: error.message || 'Unknown fetch error',
        stack: error.stack,
        context: {
          serverUrl,
          fetchTime,
          method: 'GET'
        }
      });
    }
    
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
    console.error(`❌ [MCP-SSE] Server responded with error: ${response.status} ${response.statusText}`);
    
    // Log the error response
    if (mcpName) {
      await mcpTrafficLogger.logError(requestId, mcpName, {
        error: 'HTTP_ERROR',
        message: `MCP server responded with ${response.status}: ${response.statusText}`,
        context: {
          status: response.status,
          statusText: response.statusText,
          serverUrl,
          method: 'GET',
          headers: Object.fromEntries(response.headers.entries())
        }
      });
    }
    
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
    
    console.error(`❌ [MCP-SSE] Error response:`, JSON.stringify(errorResponse, null, 2));
    
    res.status(response.status).json(errorResponse);
    return;
  }
  
  console.log(`✅ [MCP-SSE] Server responded successfully, starting stream forwarding`);
  
  // Handle SSE response - pass requestId for stream logging
  await forwardStreamingResponse(response, res, mcpName, new URL(serverUrl).origin, requestId);
}

// Helper function to handle regular HTTP requests (POST/JSON-RPC)
async function forwardHttpRequest(
  serverUrl: string,
  request: ProxyRequest | null,
  headers: Record<string, string>,
  res?: ExpressResponse,
  mcpName?: string
): Promise<ProxyResponse | void> {
  console.log(`🌐 [MCP-HTTP] Starting HTTP request to: ${serverUrl}`);
  console.log(`🌐 [MCP-HTTP] Request object:`, request ? JSON.stringify(request, null, 2) : 'null');
  
  // Generate request ID for tracking
  const requestId = `http-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🌐 [MCP-HTTP] Request ID: ${requestId}`);
  
  // For POST requests, send JSON-RPC (if request is provided)
  // For direct proxy requests, just forward as-is
  if (request) {
    console.log(`🌐 [MCP-HTTP] Sending JSON-RPC request`);
    // Ensure we have the correct Content-Type (override any forwarded duplicates)
    headers['Content-Type'] = 'application/json';
    
    // Only set Accept header if client didn't provide one
    // Server requires both application/json and text/event-stream in Accept header
    if (!headers['Accept'] && !headers['accept']) {
      headers['Accept'] = 'application/json, text/event-stream';
    }
    
    const requestBody = {
      jsonrpc: '2.0',
      id: request.id || Date.now(),
      ...request
    };
    
    console.log(`🌐 [MCP-HTTP] Request body:`, JSON.stringify(requestBody, null, 2));
    console.log(`🌐 [MCP-HTTP] Request headers:`, JSON.stringify(headers, null, 2));
    
    // Log the request
    if (mcpName) {
      await mcpTrafficLogger.logRequest(mcpName, {
        method: 'POST',
        url: serverUrl,
        headers,
        body: requestBody,
        isStreaming: false
      }, requestId);
    }
    
    let response;
    try {
      response = await fetch(serverUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
    } catch (error) {
      console.error(`❌ [MCP-HTTP] Fetch error:`, error);
      
      // Log the fetch error
      if (mcpName) {
        await mcpTrafficLogger.logError(requestId, mcpName, {
          error: 'FETCH_ERROR',
          message: `Failed to connect to MCP server: ${error.message}`,
          stack: error.stack,
          context: {
            serverUrl,
            method: 'POST',
            headers
          }
        });
      }
      
      if (res) {
        res.status(500).json({
          error: 'Connection Error',
          message: `Failed to connect to MCP server: ${error.message}`,
          details: {
            errorName: error.name,
            serverUrl
          },
          timestamp: new Date().toISOString()
        });
        return;
      } else {
        throw error;
      }
    }
    
    console.log(`🌐 [MCP-HTTP] Response status: ${response.status} ${response.statusText}`);
    console.log(`🌐 [MCP-HTTP] Response headers:`, JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
    
    // Log the response
    if (mcpName) {
      await mcpTrafficLogger.logResponse(requestId, mcpName, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        isStreaming: false,
        contentType: response.headers.get('content-type') || undefined
      });
    }
    
    // Check if response is streaming (SSE or chunked transfer)
    const contentType = response.headers.get('content-type');
    const transferEncoding = response.headers.get('transfer-encoding');
    
    console.log(`🌐 [MCP-HTTP] Content-Type: ${contentType}`);
    console.log(`🌐 [MCP-HTTP] Transfer-Encoding: ${transferEncoding}`);
    
    // Only treat as streaming if response is OK and has streaming headers
    if (res && response.ok && (contentType?.includes('text/event-stream') || transferEncoding?.includes('chunked'))) {
      console.log(`🌐 [MCP-HTTP] Detected streaming response, forwarding stream`);
      // Update response logging for streaming
      if (mcpName) {
        await mcpTrafficLogger.logResponse(requestId, mcpName, {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          isStreaming: true,
          contentType: response.headers.get('content-type') || undefined
        });
      }
      // Handle streaming response by forwarding stream - pass requestId
      await forwardStreamingResponse(response, res, mcpName, new URL(serverUrl).origin, requestId);
      return; // No return value for streaming
    }
    
    // Handle non-streaming response (including errors)
    if (!response.ok) {
      console.error(`❌ [MCP-HTTP] Server error: ${response.status} ${response.statusText}`);
      
      // Log the error
      if (mcpName) {
        await mcpTrafficLogger.logError(requestId, mcpName, {
          error: 'HTTP_ERROR',
          message: `MCP server responded with ${response.status}: ${response.statusText}`,
          context: {
            status: response.status,
            statusText: response.statusText,
            serverUrl,
            method: 'POST',
            headers: Object.fromEntries(response.headers.entries())
          }
        });
      }
      
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
      
      console.error(`❌ [MCP-HTTP] Error response:`, JSON.stringify(errorResponse, null, 2));
      
      if (res) {
        res.status(response.status).json(errorResponse);
        return; // Return void for Express response
      } else {
        throw new Error(`MCP server responded with ${response.status}: ${response.statusText}`);
      }
    }
    
    // Handle regular JSON response
    console.log(`✅ [MCP-HTTP] Processing successful JSON response`);
    const jsonResponse = await response.json() as ProxyResponse;
    console.log(`✅ [MCP-HTTP] JSON response:`, JSON.stringify(jsonResponse, null, 2));
    
    // Log the response body
    if (mcpName) {
      await mcpTrafficLogger.logResponse(requestId, mcpName, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: jsonResponse,
        isStreaming: false,
        contentType: response.headers.get('content-type') || undefined
      });
    }
    
    // Forward response headers back to client if we have Express response object
    if (res) {
      // Forward ALL headers from MCP server response except those we need to control
      const headersToExclude = new Set([
        'content-length',      // Will be recalculated by Express
        'transfer-encoding',   // Managed by Express
        'connection',          // Managed by Express
        'keep-alive',          // Managed by Express
        'server',              // Hide target server info
        'via',                 // Will be added by proxy if needed
        'proxy-authenticate',  // Proxy-specific
        'proxy-authorization', // Proxy-specific
        'upgrade'              // May interfere with proxy
      ]);
      
      for (const [headerName, headerValue] of response.headers.entries()) {
        const lowerHeaderName = headerName.toLowerCase();
        
        if (!headersToExclude.has(lowerHeaderName) && headerValue) {
          res.setHeader(headerName, headerValue);
          console.log(`📤 [HEADER-FORWARD] ${headerName}: ${headerValue}`);
        }
      }
      
      res.json(jsonResponse);
      return; // Return void for Express response handling
    }
    
    return jsonResponse;
  } else {
    console.log(`🌐 [MCP-HTTP] Direct proxy request (no JSON-RPC wrapper)`);
    
    // Direct proxy request (null request) - forward the raw HTTP request
    // This handles direct GET requests to SSE endpoints with target parameter
    const method = res?.req.method || 'GET';
    
    console.log(`🌐 [MCP-HTTP] Using method: ${method}`);
    
    // Set appropriate headers for different request types
    if (method === 'GET') {
      // Server requires both application/json and text/event-stream in Accept header
      const currentAccept = headers['Accept'] || headers['accept'] || '';
      if (!currentAccept.includes('application/json') || !currentAccept.includes('text/event-stream')) {
        // Ensure both content types are present
        headers['Accept'] = 'text/event-stream, application/json';
        console.log(`🌐 [MCP-HTTP] Fixed Accept header to include both content types`);
      }
      if (!headers['Cache-Control'] && !headers['cache-control']) {
        headers['Cache-Control'] = 'no-cache';
      }
    }
    
    console.log(`🌐 [MCP-HTTP] Direct request headers:`, JSON.stringify(headers, null, 2));
    
    // Log the direct request
    if (mcpName) {
      await mcpTrafficLogger.logRequest(mcpName, {
        method: method,
        url: serverUrl,
        headers,
        isStreaming: method === 'GET' // GET requests are typically for streaming
      }, requestId);
    }
    
    let response;
    try {
      response = await fetch(serverUrl, {
        method: method,
        headers
      });
    } catch (error) {
      console.error(`❌ [MCP-HTTP] Direct fetch error:`, error);
      
      // Log the fetch error
      if (mcpName) {
        await mcpTrafficLogger.logError(requestId, mcpName, {
          error: 'FETCH_ERROR',
          message: `Failed to connect to MCP server: ${error.message}`,
          stack: error.stack,
          context: {
            serverUrl,
            method: method,
            headers
          }
        });
      }
      
      if (res) {
        res.status(500).json({
          error: 'Connection Error',
          message: `Failed to connect to MCP server: ${error.message}`,
          details: {
            errorName: error.name,
            serverUrl
          },
          timestamp: new Date().toISOString()
        });
        return;
      } else {
        throw error;
      }
    }
    
    console.log(`🌐 [MCP-HTTP] Direct response status: ${response.status} ${response.statusText}`);
    
    // Log the direct response
    if (mcpName) {
      await mcpTrafficLogger.logResponse(requestId, mcpName, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        isStreaming: false, // Will be updated if streaming is detected
        contentType: response.headers.get('content-type') || undefined
      });
    }
    
    if (!response.ok) {
      console.error(`❌ [MCP-HTTP] Direct request error: ${response.status} ${response.statusText}`);
      
      // Log the error
      if (mcpName) {
        await mcpTrafficLogger.logError(requestId, mcpName, {
          error: 'HTTP_ERROR',
          message: `MCP server responded with ${response.status}: ${response.statusText}`,
          context: {
            status: response.status,
            statusText: response.statusText,
            serverUrl,
            method: method,
            headers: Object.fromEntries(response.headers.entries())
          }
        });
      }
      
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
    
    console.log(`🌐 [MCP-HTTP] Direct response Content-Type: ${contentType}`);
    console.log(`🌐 [MCP-HTTP] Direct response Transfer-Encoding: ${transferEncoding}`);
    
    if (res && (contentType?.includes('text/event-stream') || transferEncoding?.includes('chunked'))) {
      console.log(`🌐 [MCP-HTTP] Direct streaming response detected`);
      
      // Update response logging for streaming
      if (mcpName) {
        await mcpTrafficLogger.logResponse(requestId, mcpName, {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          isStreaming: true,
          contentType: response.headers.get('content-type') || undefined
        });
      }
      
      // Handle streaming response - pass requestId
      await forwardStreamingResponse(response, res, mcpName, new URL(serverUrl).origin, requestId);
      return;
    } else {
      console.log(`🌐 [MCP-HTTP] Direct regular response`);
      // Handle regular response
      const jsonResponse = await response.json() as ProxyResponse;
      console.log(`🌐 [MCP-HTTP] Direct JSON response:`, JSON.stringify(jsonResponse, null, 2));
      
      // Log the response body for direct requests
      if (mcpName) {
        await mcpTrafficLogger.logResponse(requestId, mcpName, {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: jsonResponse,
          isStreaming: false,
          contentType: response.headers.get('content-type') || undefined
        });
      }
      
      // Forward response headers back to client if we have Express response object
      if (res) {
        // Forward ALL headers from MCP server response except those we need to control
        const headersToExclude = new Set([
          'content-length',      // Will be recalculated by Express
          'transfer-encoding',   // Managed by Express
          'connection',          // Managed by Express
          'keep-alive',          // Managed by Express
          'server',              // Hide target server info
          'via',                 // Will be added by proxy if needed
          'proxy-authenticate',  // Proxy-specific
          'proxy-authorization', // Proxy-specific
          'upgrade'              // May interfere with proxy
        ]);
        
        for (const [headerName, headerValue] of response.headers.entries()) {
          const lowerHeaderName = headerName.toLowerCase();
          
          if (!headersToExclude.has(lowerHeaderName) && headerValue) {
            res.setHeader(headerName, headerValue);
            console.log(`📤 [HEADER-FORWARD] ${headerName}: ${headerValue}`);
          }
        }
        
        res.json(jsonResponse);
        return; // Return void for Express response handling
      }
      
      return jsonResponse;
    }
  }
}

// Helper function to forward streaming responses (SSE and HTTP streaming)
async function forwardStreamingResponse(
  sourceResponse: Response, 
  targetResponse: ExpressResponse, 
  mcpName?: string, 
  serverBaseUrl?: string,
  requestId?: string
): Promise<void> {
  console.log(`🌊 [MCP-STREAM] Starting stream forwarding`);
  console.log(`🌊 [MCP-STREAM] Source response status: ${sourceResponse.status}`);
  console.log(`🌊 [MCP-STREAM] MCP name: ${mcpName || 'N/A'}`);
  console.log(`🌊 [MCP-STREAM] Server base URL: ${serverBaseUrl || 'N/A'}`);
  console.log(`🌊 [MCP-STREAM] Request ID: ${requestId || 'N/A'}`);
  
  const contentType = sourceResponse.headers.get('content-type');
  const isSSE = contentType?.includes('text/event-stream');
  
  console.log(`🌊 [MCP-STREAM] Content type: ${contentType}`);
  console.log(`🌊 [MCP-STREAM] Is SSE: ${isSSE}`);
  
  // Forward all response headers from source to target except those we need to control
  const headersToExclude = new Set([
    'content-length',      // Will be recalculated by streaming
    'transfer-encoding',   // May need to be controlled by Express
    'connection',          // May need to be controlled by Express
    'keep-alive',          // May need to be controlled by Express
    'proxy-authenticate',  // Proxy-specific
    'proxy-authorization', // Proxy-specific
    'upgrade',             // May interfere with proxy
    'via',                 // Will be added by proxy if needed
    'server'               // Hide target server info
  ]);
  
  const responseHeaders: Record<string, string> = {};
  
  // Forward all headers except excluded ones
  for (const [headerName, headerValue] of sourceResponse.headers.entries()) {
    const lowerHeaderName = headerName.toLowerCase();
    
    if (!headersToExclude.has(lowerHeaderName) && headerValue) {
      responseHeaders[headerName] = headerValue;
      console.log(`🌊 [MCP-STREAM] Forwarding header ${headerName}: ${headerValue}`);
    }
  }
  
  // Set default SSE headers if this is an SSE response without proper headers
  if (isSSE) {
    responseHeaders['content-type'] = 'text/event-stream';
    responseHeaders['cache-control'] = responseHeaders['cache-control'] || 'no-cache';
    responseHeaders['connection'] = responseHeaders['connection'] || 'keep-alive';
    responseHeaders['access-control-allow-origin'] = responseHeaders['access-control-allow-origin'] || '*';
    console.log(`🌊 [MCP-STREAM] Applied default SSE headers`);
  }
  
  console.log(`🌊 [MCP-STREAM] Final response headers:`, JSON.stringify(responseHeaders, null, 2));
  
  // Write headers
  targetResponse.writeHead(200, responseHeaders);
  console.log(`🌊 [MCP-STREAM] Response headers written`);
  
  // Forward the stream using the built-in fetch ReadableStream
  const sourceStream = sourceResponse.body;
  if (!sourceStream) {
    console.error(`❌ [MCP-STREAM] No readable stream available from MCP server`);
    throw new Error('No readable stream available from MCP server');
  }
  
  console.log(`🌊 [MCP-STREAM] Source stream available, starting to forward`);
  
  try {
    // Use the ReadableStream reader API
    const reader = sourceStream.getReader();
    console.log(`🌊 [MCP-STREAM] Reader obtained`);
    
    // Set up a timeout for reading inactivity (5 minutes)
    let readTimeoutId: NodeJS.Timeout | null = null;
    const STREAM_READ_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    
    const resetReadTimeout = () => {
      if (readTimeoutId) {
        clearTimeout(readTimeoutId);
      }
      readTimeoutId = setTimeout(() => {
        console.log(`⏰ [MCP-STREAM] Stream read timeout after ${STREAM_READ_TIMEOUT/1000} seconds`);
        try {
          reader.cancel('Stream read timeout');
        } catch (cancelError) {
          console.log(`⚠️ [MCP-STREAM] Reader already cancelled during timeout`);
        }
      }, STREAM_READ_TIMEOUT);
    };
    
    // Start the timeout
    resetReadTimeout();
    
    // Handle client disconnect
    targetResponse.on('close', () => {
      console.log(`🔌 [MCP-STREAM] Client disconnected, cancelling reader`);
      if (readTimeoutId) clearTimeout(readTimeoutId);
      try {
        reader.cancel('Client disconnected');
      } catch (cancelError) {
        console.log(`⚠️ [MCP-STREAM] Reader already cancelled or closed`);
      }
    });
    
    targetResponse.on('error', (error) => {
      console.error(`❌ [MCP-STREAM] Target response error:`, error);
      if (readTimeoutId) clearTimeout(readTimeoutId);
      try {
        reader.cancel('Target response error');
      } catch (cancelError) {
        console.log(`⚠️ [MCP-STREAM] Reader already cancelled or closed`);
      }
    });
    
    let chunkCount = 0;
    
    try {
      while (true) {
        let readResult;
        try {
          readResult = await reader.read();
          resetReadTimeout(); // Reset timeout on successful read
        } catch (readError) {
          console.log(`⚠️ [MCP-STREAM] Read error (likely timeout or connection closed):`, readError.message);
          // This is expected for timeouts - just break the loop
          break;
        }
        
        const { done, value } = readResult;
        
        if (done) {
          console.log(`✅ [MCP-STREAM] Stream completed after ${chunkCount} chunks`);
          
          // Log stream completion
          if (mcpName && requestId) {
            await mcpTrafficLogger.logCustomEvent(requestId, mcpName, 'STREAM_COMPLETED', {
              totalChunks: chunkCount,
              streamType: isSSE ? 'SSE' : 'CHUNKED'
            });
          }
          break;
        }
      
      chunkCount++;
      if (chunkCount <= 5 || chunkCount % 10 === 0) {
        console.log(`🌊 [MCP-STREAM] Processing chunk ${chunkCount}, size: ${value?.length || 0} bytes`);
      }
      
      let processedChunk: string | Uint8Array = value;
      
      // For SSE responses with rewriting capability, process the chunk
      if (isSSE && mcpName && serverBaseUrl) {
        // Convert chunk to string, rewrite SSE endpoints, then convert back
        let chunk = new TextDecoder().decode(value);
        if (chunkCount <= 3) {
          console.log(`🌊 [MCP-STREAM] Original chunk ${chunkCount}:`, chunk.substring(0, 200));
        }
        
        chunk = rewriteSSEEndpoints(chunk, mcpName, serverBaseUrl);
        
        if (chunkCount <= 3) {
          console.log(`🌊 [MCP-STREAM] Rewritten chunk ${chunkCount}:`, chunk.substring(0, 200));
        }
        
        processedChunk = new TextEncoder().encode(chunk);
        
        // Log chunk data (limit content for large chunks)
        if (mcpName && requestId) {
          await mcpTrafficLogger.logStreamChunk(requestId, mcpName, {
            chunkNumber: chunkCount,
            chunkSize: chunk.length,
            content: chunk.length > 1000 ? chunk.substring(0, 1000) + '...[TRUNCATED]' : chunk,
            isSSE: true
          });
        }
        
        targetResponse.write(processedChunk);
      } else {
        // Forward the chunk as-is
        processedChunk = value;
        
        // Log chunk data for non-SSE streams
        if (mcpName && requestId) {
          const chunkText = new TextDecoder().decode(value);
          await mcpTrafficLogger.logStreamChunk(requestId, mcpName, {
            chunkNumber: chunkCount,
            chunkSize: value.length,
            content: chunkText.length > 1000 ? chunkText.substring(0, 1000) + '...[TRUNCATED]' : chunkText,
            isSSE: false
          });
        }
        
        targetResponse.write(processedChunk);
      }
    }
    
    // Clear timeout on successful completion
    if (readTimeoutId) clearTimeout(readTimeoutId);
    
    console.log(`✅ [MCP-STREAM] Stream forwarding completed successfully`);
    targetResponse.end();
    
    } catch (whileLoopError) {
      console.log(`⚠️ [MCP-STREAM] While loop error (stream terminated):`, whileLoopError.message);
      // Clear timeout on error
      if (readTimeoutId) clearTimeout(readTimeoutId);
      // This is expected for stream timeouts/terminations
    }
    
  } catch (error) {
    console.error(`❌ [MCP-STREAM] Error forwarding stream:`, error);
    
    // Log the stream error
    if (mcpName && requestId) {
      await mcpTrafficLogger.logError(requestId, mcpName, {
        error: 'STREAM_ERROR',
        message: `Stream forwarding failed: ${error.message}`,
        stack: error.stack,
        context: {
          streamType: isSSE ? 'SSE' : 'CHUNKED',
          contentType: sourceResponse.headers.get('content-type')
        }
      });
    }
    
    // Send error in appropriate format
    if (isSSE) {
      const errorData = `event: error\ndata: ${JSON.stringify({ error: 'Stream forwarding failed', details: error.message })}\n\n`;
      console.log(`❌ [MCP-STREAM] Sending SSE error:`, errorData);
      targetResponse.write(errorData);
    } else {
      const errorData = JSON.stringify({ error: 'Stream forwarding failed', details: error.message });
      console.log(`❌ [MCP-STREAM] Sending JSON error:`, errorData);
      targetResponse.write(errorData);
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
