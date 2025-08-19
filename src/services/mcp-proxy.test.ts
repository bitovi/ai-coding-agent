import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { proxyMcpRequest, getProxyStatus, setupMcpProxyRoutes } from './mcp-proxy.js';

// Mock global fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock dependencies
const mockConfigManager = {
  getMcpServer: jest.fn() as jest.MockedFunction<any>,
  getMcpServers: jest.fn() as jest.MockedFunction<any>
};

const mockAuthManager = {
  isAuthorized: jest.fn() as jest.MockedFunction<any>,
  getTokens: jest.fn() as jest.MockedFunction<any>
};

const deps = {
  configManager: mockConfigManager,
  authManager: mockAuthManager
};

describe('MCP Proxy Service', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    setupMcpProxyRoutes(app as any, deps);
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('POST /api/mcp/:mcpName/proxy', () => {
    it('should return 404 when MCP server is not found', async () => {
      mockConfigManager.getMcpServer.mockReturnValue(null);

      const response = await request(app)
        .post('/api/mcp/nonexistent/proxy')
        .send({ method: 'tools/list', params: {} });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe("MCP server 'nonexistent' not found");
    });

    it('should return 400 when proxy is not enabled', async () => {
      mockConfigManager.getMcpServer.mockReturnValue({
        name: 'github',
        type: 'url',
        url: 'https://api.githubcopilot.com/mcp/',
        proxy: false
      });

      const response = await request(app)
        .post('/api/mcp/github/proxy')
        .send({ method: 'tools/list', params: {} });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe("MCP server 'github' does not have proxy enabled");
    });

    it('should successfully proxy request to MCP server', async () => {
      mockConfigManager.getMcpServer.mockReturnValue({
        name: 'jira',
        type: 'url',
        url: 'https://mcp.atlassian.com/v1/sse',
        proxy: true,
        authorization_token: 'test-token'
      });

      const mockResponse = {
        ok: true,
        json: jest.fn(() => Promise.resolve({
          jsonrpc: '2.0',
          result: {
            tools: [
              { name: 'create-issue', description: 'Create a Jira issue' }
            ]
          },
          id: 1
        })),
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        }
      } as any;

      mockFetch.mockResolvedValue(mockResponse as any);

      const response = await request(app)
        .post('/api/mcp/jira/proxy')
        .send({ method: 'tools/list', params: {} });

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result.tools).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://mcp.atlassian.com/v1/sse',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
            'User-Agent': 'AI-Coding-Agent-Proxy/1.0'
          }),
          body: expect.stringContaining('"method":"tools/list"')
        })
      );
    });

    it('should handle 401 Unauthorized from target server', async () => {
      mockConfigManager.getMcpServer.mockReturnValue({
        name: 'jira',
        type: 'url',
        url: 'https://mcp.atlassian.com/v1/sse',
        proxy: true
      });

      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        }
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const response = await request(app)
        .post('/api/mcp/jira/proxy')
        .send({ method: 'tools/list', params: {} });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
      expect(response.body.message).toBe('MCP server responded with 401: Unauthorized');
      expect(response.body.details.targetStatus).toBe(401);
      expect(response.body.details.targetStatusText).toBe('Unauthorized');
      expect(response.body.details.targetStatus).toBe(401);
    });

    it('should use OAuth token when no static token is available', async () => {
      mockConfigManager.getMcpServer.mockReturnValue({
        name: 'jira',
        type: 'url',
        url: 'https://mcp.atlassian.com/v1/sse',
        proxy: true,
        authorization_token: null
      });

      mockAuthManager.getTokens.mockReturnValue({
        access_token: 'oauth-access-token'
      });

      const mockResponse = {
        ok: true,
        json: jest.fn(() => Promise.resolve({
          jsonrpc: '2.0',
          result: { tools: [] },
          id: 1
        })),
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        }
      } as any;

      mockFetch.mockResolvedValue(mockResponse as any);

      const response = await request(app)
        .post('/api/mcp/jira/proxy')
        .send({ method: 'tools/list', params: {} });

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://mcp.atlassian.com/v1/sse',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer oauth-access-token'
          })
        })
      );
    });

    it('should include proper JSON-RPC structure in forwarded request', async () => {
      mockConfigManager.getMcpServer.mockReturnValue({
        name: 'jira',
        type: 'url',
        url: 'https://mcp.atlassian.com/v1/sse',
        proxy: true
      });

      const mockResponse = {
        ok: true,
        json: jest.fn(() => Promise.resolve({
          jsonrpc: '2.0',
          result: { tools: [] },
          id: 1
        })),
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        }
      } as any;

      mockFetch.mockResolvedValue(mockResponse as any);

      await request(app)
        .post('/api/mcp/jira/proxy')
        .send({ method: 'tools/call', params: { name: 'create-issue' }, id: 42 });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://mcp.atlassian.com/v1/sse',
        expect.objectContaining({
          body: expect.stringMatching(/"jsonrpc":"2\.0"/)
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs![1]?.body as string);
      expect(body).toEqual({
        jsonrpc: '2.0',
        id: 42,
        method: 'tools/call',
        params: { name: 'create-issue' }
      });
    });

    it('should work without any authorization token', async () => {
      mockConfigManager.getMcpServer.mockReturnValue({
        name: 'public',
        type: 'url',
        url: 'https://public.mcp.example.com/',
        proxy: true,
        authorization_token: null
      });

      mockAuthManager.getTokens.mockReturnValue(null);

      const mockResponse = {
        ok: true,
        json: jest.fn(() => Promise.resolve({ jsonrpc: '2.0', result: {}, id: 1 })),
        headers: { get: jest.fn().mockReturnValue('application/json') }
      } as any;

      mockFetch.mockResolvedValue(mockResponse as any);

      await request(app)
        .post('/api/mcp/public/proxy')
        .send({ method: 'tools/list', params: {} });

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs![1]?.headers as Record<string, string>;
      expect(headers).not.toHaveProperty('Authorization');
    });
  });

  describe('GET /api/mcp/:mcpName/proxy/status', () => {
    it('should return 404 when MCP server is not found', async () => {
      mockConfigManager.getMcpServer.mockReturnValue(null);

      const response = await request(app)
        .get('/api/mcp/nonexistent/proxy/status');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe("MCP server 'nonexistent' not found");
    });

    it('should return proxy status for valid server', async () => {
      mockConfigManager.getMcpServer.mockReturnValue({
        name: 'jira',
        type: 'url',
        url: 'https://mcp.atlassian.com/v1/sse',
        proxy: true,
        authorization_token: 'test-token'
      });

      mockAuthManager.isAuthorized.mockResolvedValue(true);
      mockAuthManager.getTokens.mockReturnValue({
        access_token: 'oauth-token'
      });

      const response = await request(app)
        .get('/api/mcp/jira/proxy/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        name: 'jira',
        isProxy: true,
        targetUrl: 'https://mcp.atlassian.com/v1/sse',
        isAuthorized: true,
        hasToken: true,
        lastProxyRequest: null,
        proxyRequestCount: 0
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('should show proxy status for server without proxy enabled', async () => {
      mockConfigManager.getMcpServer.mockReturnValue({
        name: 'github',
        type: 'url',
        url: 'https://api.githubcopilot.com/mcp/',
        proxy: false
      });

      mockAuthManager.isAuthorized.mockResolvedValue(false);
      mockAuthManager.getTokens.mockReturnValue(null);

      const response = await request(app)
        .get('/api/mcp/github/proxy/status');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        name: 'github',
        isProxy: false,
        targetUrl: 'https://api.githubcopilot.com/mcp/',
        isAuthorized: false,
        hasToken: false,
        lastProxyRequest: null,
        proxyRequestCount: 0
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch network errors', async () => {
      mockConfigManager.getMcpServer.mockReturnValue({
        name: 'jira',
        type: 'url',
        url: 'https://mcp.atlassian.com/v1/sse',
        proxy: true
      });

      mockFetch.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .post('/api/mcp/jira/proxy')
        .send({ method: 'tools/list', params: {} });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Error');
      expect(response.body.message).toBe('Network error');
    });

    it('should handle different HTTP error codes from target server', async () => {
      mockConfigManager.getMcpServer.mockReturnValue({
        name: 'jira',
        type: 'url',
        url: 'https://mcp.atlassian.com/v1/sse',
        proxy: true
      });

      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        }
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const response = await request(app)
        .post('/api/mcp/jira/proxy')
        .send({ method: 'tools/list', params: {} });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('MCP server responded with 404: Not Found');
      expect(response.body.details.targetStatus).toBe(404);
      expect(response.body.details.targetStatusText).toBe('Not Found');
    });
  });
});
