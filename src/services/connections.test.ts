import type { Request, Response } from 'express';
import { getConnections, type GetConnectionsDeps } from './connections.js';

// Mock the common module
jest.mock('./common.js', () => ({
  handleError: jest.fn(),
  setupGitCredentials: jest.fn(),
}));

// Mock the special connections manager
jest.mock('../connections/special/index.js', () => ({
  specialConnectionsManager: {
    getAllConnections: jest.fn(),
    isAvailable: jest.fn(),
    getConnectionDetails: jest.fn(),
    hasConnection: jest.fn(),
    setup: jest.fn(),
  }
}));

describe('getConnections', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockDeps: GetConnectionsDeps;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock request
    mockReq = {
      params: {},
      body: {},
      headers: {},
      query: {}
    };

    // Mock response
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      redirect: jest.fn()
    };

    // Mock dependencies
    mockDeps = {
      configManager: {
        getMcpServers: jest.fn()
      },
      authManager: {
        isAuthorized: jest.fn().mockResolvedValue(false)
      }
    };
  });

  it('should return empty connections array when no MCP servers exist', async () => {
    // Arrange
    const { specialConnectionsManager } = require('../connections/special/index.js');
    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue([]);
    
    specialConnectionsManager.getAllConnections.mockReturnValue([
      {
        name: 'git-credentials',
        description: 'Git credentials for repository access',
        method: 'token',
        type: 'credential'
      }
    ]);
    specialConnectionsManager.isAvailable.mockReturnValue(false);
    specialConnectionsManager.getConnectionDetails.mockReturnValue({});

    // Act
    await getConnections(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: {
        connections: [
          {
            name: 'git-credentials',
            type: 'credential',
            description: 'Git credentials for repository access',
            isAvailable: false,
            setupUrl: '/api/connections/credential/git-credentials/setup',
            details: {
              lastConfigured: null,
              method: 'token'
            }
          }
        ]
      },
      timestamp: expect.any(String)
    });
  });

  it('should return MCP server connections with authorization status', async () => {
    // Arrange
    const { specialConnectionsManager } = require('../connections/special/index.js');
    const mockMcpServers = [
      {
        name: 'jira',
        description: 'Jira integration',
        url: 'https://api.atlassian.com',
        scopes: ['read:jira-work', 'write:jira-work']
      },
      {
        name: 'github',
        description: 'GitHub integration',
        url: 'https://api.github.com',
        scopes: ['repo']
      }
    ];

    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue(mockMcpServers);
    mockDeps.authManager!.isAuthorized = jest.fn()
      .mockResolvedValueOnce(true)  // jira authorized
      .mockResolvedValueOnce(false); // github not authorized

    specialConnectionsManager.getAllConnections.mockReturnValue([
      {
        name: 'git-credentials',
        description: 'Git credentials for repository access',
        method: 'token',
        type: 'credential'
      }
    ]);
    specialConnectionsManager.isAvailable.mockReturnValue(true);
    specialConnectionsManager.getConnectionDetails.mockReturnValue({});

    // Act
    await getConnections(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: {
        connections: [
          {
            name: 'jira',
            type: 'mcp-server',
            description: 'Jira integration',
            isAvailable: true,
            isProxy: false,
            authUrl: '/api/connections/mcp/jira/authorize',
            proxyEndpoints: undefined,
            details: {
              url: 'https://api.atlassian.com',
              targetUrl: undefined,
              scopes: ['read:jira-work', 'write:jira-work'],
              lastAuthorized: expect.any(String),
              tokenExpiry: null,
              hasRefreshToken: false
            }
          },
          {
            name: 'github',
            type: 'mcp-server',
            description: 'GitHub integration',
            isAvailable: false,
            isProxy: false,
            authUrl: '/api/connections/mcp/github/authorize',
            proxyEndpoints: undefined,
            details: {
              url: 'https://api.github.com',
              targetUrl: undefined,
              scopes: ['repo'],
              lastAuthorized: null,
              tokenExpiry: null,
              hasRefreshToken: false
            }
          },
          {
            name: 'git-credentials',
            type: 'credential',
            description: 'Git credentials for repository access',
            isAvailable: true,
            setupUrl: '/api/connections/credential/git-credentials/setup',
            details: {
              lastConfigured: expect.any(String),
              method: 'token'
            }
          }
        ]
      },
      timestamp: expect.any(String)
    });

    expect(mockDeps.authManager!.isAuthorized).toHaveBeenCalledWith(mockMcpServers[0]);
    expect(mockDeps.authManager!.isAuthorized).toHaveBeenCalledWith(mockMcpServers[1]);
  });

  it('should handle MCP servers without descriptions', async () => {
    // Arrange
    const { specialConnectionsManager } = require('../connections/special/index.js');
    const mockMcpServers = [
      {
        name: 'unknown-server',
        url: 'https://api.unknown.com'
      }
    ];

    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue(mockMcpServers);
    mockDeps.authManager!.isAuthorized = jest.fn().mockResolvedValue(false);
    
    specialConnectionsManager.getAllConnections.mockReturnValue([
      {
        name: 'git-credentials',
        description: 'Git credentials for repository access',
        method: 'token',
        type: 'credential'
      }
    ]);
    specialConnectionsManager.isAvailable.mockReturnValue(false);
    specialConnectionsManager.getConnectionDetails.mockReturnValue({});

    // Act
    await getConnections(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    const mcpConnection = response.data.connections.find((c: any) => c.name === 'unknown-server');
    
    expect(mcpConnection).toEqual({
      name: 'unknown-server',
      type: 'mcp-server',
      description: 'unknown-server integration',
      isAvailable: false,
      isProxy: false,
      authUrl: '/api/connections/mcp/unknown-server/authorize',
      proxyEndpoints: undefined,
      details: {
        url: 'https://api.unknown.com',
        targetUrl: undefined,
        scopes: undefined,
        lastAuthorized: null,
        tokenExpiry: null,
        hasRefreshToken: false
      }
    });
  });

  it('should handle available credential connections', async () => {
    // Arrange
    const { specialConnectionsManager } = require('../connections/special/index.js');
    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue([]);
    
    specialConnectionsManager.getAllConnections.mockReturnValue([
      {
        name: 'git-credentials',
        description: 'Git credentials for repository access',
        method: 'token',
        type: 'credential'
      }
    ]);
    specialConnectionsManager.isAvailable.mockReturnValue(true);
    specialConnectionsManager.getConnectionDetails.mockReturnValue({});

    // Act
    await getConnections(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    const gitConnection = response.data.connections.find((c: any) => c.name === 'git-credentials');

    expect(gitConnection.isAvailable).toBe(true);
    expect(gitConnection.details.lastConfigured).toEqual(expect.any(String));
  });

  it('should handle missing MCP servers gracefully', async () => {
    // Arrange
    const { specialConnectionsManager } = require('../connections/special/index.js');
    const depsWithNoServers: GetConnectionsDeps = {
      configManager: {
        getMcpServers: jest.fn().mockReturnValue([])
      },
      authManager: {
        isAuthorized: jest.fn().mockResolvedValue(false)
      }
    };
    
    specialConnectionsManager.getAllConnections.mockReturnValue([
      {
        name: 'git-credentials',
        description: 'Git credentials for repository access',
        method: 'token',
        type: 'credential'
      }
    ]);
    specialConnectionsManager.isAvailable.mockReturnValue(false);
    specialConnectionsManager.getConnectionDetails.mockReturnValue({});

    // Act
    await getConnections(depsWithNoServers)(mockReq as Request, mockRes as Response);

    // Assert
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.data.connections).toHaveLength(1); // Only credential connections
    expect(response.data.connections[0].name).toBe('git-credentials');
  });

  it('should call handleError when an exception occurs', async () => {
    // Arrange
    const commonModule = require('./common.js');
    const error = new Error('Test error');
    
    mockDeps.configManager!.getMcpServers = jest.fn().mockImplementation(() => {
      throw error;
    });

    // Act
    await getConnections(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(commonModule.handleError).toHaveBeenCalledWith(mockRes, error);
  });

  it('should include all connection types in mixed scenario', async () => {
    // Arrange
    const { specialConnectionsManager } = require('../connections/special/index.js');
    const mockMcpServers = [
      {
        name: 'slack',
        description: 'Slack integration',
        url: 'https://api.slack.com',
        scopes: ['chat:write']
      }
    ];

    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue(mockMcpServers);
    mockDeps.authManager!.isAuthorized = jest.fn().mockResolvedValue(true);
    
    specialConnectionsManager.getAllConnections.mockReturnValue([
      {
        name: 'git-credentials',
        description: 'Git credentials for repository access',
        method: 'token',
        type: 'credential'
      }
    ]);
    specialConnectionsManager.isAvailable.mockReturnValue(true);
    specialConnectionsManager.getConnectionDetails.mockReturnValue({});

    // Act
    await getConnections(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(response.data.connections).toHaveLength(2); // 1 MCP + 1 credential connection
    
    const connectionTypes = response.data.connections.map((c: any) => c.type);
    expect(connectionTypes).toContain('mcp-server');
    expect(connectionTypes).toContain('credential');
    
    const connectionNames = response.data.connections.map((c: any) => c.name);
    expect(connectionNames).toContain('slack');
    expect(connectionNames).toContain('git-credentials');
  });

  it('should return true for servers with authorization_token in config', async () => {
    // Arrange
    const { specialConnectionsManager } = require('../connections/special/index.js');
    const mockMcpServers = [
      {
        name: 'figma',
        description: 'Figma integration',
        url: 'https://figma.com/mcp/',
        authorization_token: 'my-figma-auth-token',
        scopes: ['design:read']
      }
    ];

    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue(mockMcpServers);
    mockDeps.authManager!.isAuthorized = jest.fn().mockResolvedValue(true); // Should return true for config token

    specialConnectionsManager.getAllConnections.mockReturnValue([
      {
        name: 'git-credentials',
        description: 'Git credentials for repository access',
        method: 'token',
        type: 'credential'
      }
    ]);
    specialConnectionsManager.isAvailable.mockReturnValue(false);
    specialConnectionsManager.getConnectionDetails.mockReturnValue({});

    // Act
    await getConnections(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockDeps.authManager!.isAuthorized).toHaveBeenCalledWith(mockMcpServers[0]);
    
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    const figmaConnection = response.data.connections.find((c: any) => c.name === 'figma');
    
    expect(figmaConnection.isAvailable).toBe(true);
    expect(figmaConnection.description).toBe('Figma integration');
  });

  it('should return true for servers with environment authorization token', async () => {
    // Arrange
    const { specialConnectionsManager } = require('../connections/special/index.js');
    const originalEnv = process.env.MCP_github_authorization_token;
    process.env.MCP_github_authorization_token = 'env-auth-token';

    const mockMcpServers = [
      {
        name: 'github',
        description: 'GitHub integration',
        url: 'https://api.github.com',
        authorization_token: null,
        scopes: ['repo']
      }
    ];

    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue(mockMcpServers);
    mockDeps.authManager!.isAuthorized = jest.fn().mockResolvedValue(true); // Should return true for env token

    specialConnectionsManager.getAllConnections.mockReturnValue([
      {
        name: 'git-credentials',
        description: 'Git credentials for repository access',
        method: 'token',
        type: 'credential'
      }
    ]);
    specialConnectionsManager.isAvailable.mockReturnValue(false);
    specialConnectionsManager.getConnectionDetails.mockReturnValue({});

    // Act
    await getConnections(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockDeps.authManager!.isAuthorized).toHaveBeenCalledWith(mockMcpServers[0]);
    
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    const githubConnection = response.data.connections.find((c: any) => c.name === 'github');
    
    expect(githubConnection.isAvailable).toBe(true);
    expect(githubConnection.description).toBe('GitHub integration');

    // Cleanup
    if (originalEnv) {
      process.env.MCP_github_authorization_token = originalEnv;
    } else {
      delete process.env.MCP_github_authorization_token;
    }
  });

  it('should prioritize config authorization_token over OAuth tokens', async () => {
    // Arrange
    const { specialConnectionsManager } = require('../connections/special/index.js');
    const mockMcpServers = [
      {
        name: 'jira',
        description: 'Jira integration',
        url: 'https://jira.example.com/mcp',
        authorization_token: 'config-token-value',
        scopes: ['read:jira-work']
      }
    ];

    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue(mockMcpServers);
    mockDeps.authManager!.isAuthorized = jest.fn().mockResolvedValue(true);

    specialConnectionsManager.getAllConnections.mockReturnValue([
      {
        name: 'git-credentials',
        description: 'Git credentials for repository access',
        method: 'token',
        type: 'credential'
      }
    ]);
    specialConnectionsManager.isAvailable.mockReturnValue(false);
    specialConnectionsManager.getConnectionDetails.mockReturnValue({});

    // Act
    await getConnections(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockDeps.authManager!.isAuthorized).toHaveBeenCalledWith(mockMcpServers[0]);
    
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    const jiraConnection = response.data.connections.find((c: any) => c.name === 'jira');
    
    expect(jiraConnection.isAvailable).toBe(true);
    expect(jiraConnection.description).toBe('Jira integration');
  });
});
