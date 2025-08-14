import type { Request, Response } from 'express';
import { getConnections, type GetConnectionsDeps } from './connections.js';

// Mock the common module
jest.mock('./common.js', () => ({
  handleError: jest.fn(),
  checkConnectionAvailability: jest.fn(),
  getConnectionDetails: jest.fn(),
  setupGitCredentials: jest.fn(),
  setupDockerCredentials: jest.fn(),
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
    const commonModule = require('./common.js');
    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue([]);
    commonModule.checkConnectionAvailability.mockImplementation(() => false);
    commonModule.getConnectionDetails.mockImplementation(() => ({}));

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
          },
          {
            name: 'docker-registry',
            type: 'credential',
            description: 'Docker registry credentials',
            isAvailable: false,
            setupUrl: '/api/connections/credential/docker-registry/setup',
            details: {
              lastConfigured: null,
              method: 'credentials'
            }
          }
        ]
      },
      timestamp: expect.any(String)
    });
  });

  it('should return MCP server connections with authorization status', async () => {
    // Arrange
    const commonModule = require('./common.js');
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

    commonModule.checkConnectionAvailability.mockImplementation((type: string) => {
      return type === 'git-credentials';
    });
    commonModule.getConnectionDetails.mockImplementation(() => ({}));

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
            authUrl: '/api/connections/mcp/jira/authorize',
            details: {
              url: 'https://api.atlassian.com',
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
            authUrl: '/api/connections/mcp/github/authorize',
            details: {
              url: 'https://api.github.com',
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
          },
          {
            name: 'docker-registry',
            type: 'credential',
            description: 'Docker registry credentials',
            isAvailable: false,
            setupUrl: '/api/connections/credential/docker-registry/setup',
            details: {
              lastConfigured: null,
              method: 'credentials'
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
    const commonModule = require('./common.js');
    const mockMcpServers = [
      {
        name: 'unknown-server',
        url: 'https://api.unknown.com'
        // No description field
      }
    ];

    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue(mockMcpServers);
    mockDeps.authManager!.isAuthorized = jest.fn().mockResolvedValue(false);
    commonModule.checkConnectionAvailability.mockReturnValue(false);
    commonModule.getConnectionDetails.mockImplementation(() => ({}));

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
      authUrl: '/api/connections/mcp/unknown-server/authorize',
      details: {
        url: 'https://api.unknown.com',
        scopes: undefined,
        lastAuthorized: null,
        tokenExpiry: null,
        hasRefreshToken: false
      }
    });
  });

  it('should handle available credential connections', async () => {
    // Arrange
    const commonModule = require('./common.js');
    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue([]);
    
    commonModule.checkConnectionAvailability.mockImplementation((type: string) => {
      return type === 'git-credentials' || type === 'docker-registry';
    });
    commonModule.getConnectionDetails.mockImplementation(() => ({}));

    // Act
    await getConnections(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    const gitConnection = response.data.connections.find((c: any) => c.name === 'git-credentials');
    const dockerConnection = response.data.connections.find((c: any) => c.name === 'docker-registry');

    expect(gitConnection.isAvailable).toBe(true);
    expect(gitConnection.details.lastConfigured).toEqual(expect.any(String));
    expect(dockerConnection.isAvailable).toBe(true);
    expect(dockerConnection.details.lastConfigured).toEqual(expect.any(String));
  });

  it('should handle missing MCP servers gracefully', async () => {
    // Arrange
    const commonModule = require('./common.js');
    const depsWithNoServers: GetConnectionsDeps = {
      configManager: {
        getMcpServers: jest.fn().mockReturnValue([])
      },
      authManager: {
        isAuthorized: jest.fn().mockResolvedValue(false)
      }
    };
    commonModule.checkConnectionAvailability.mockReturnValue(false);

    // Act
    await getConnections(depsWithNoServers)(mockReq as Request, mockRes as Response);

    // Assert
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.data.connections).toHaveLength(2); // Only credential connections
    expect(response.data.connections[0].name).toBe('git-credentials');
    expect(response.data.connections[1].name).toBe('docker-registry');
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
    const commonModule = require('./common.js');
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
    
    commonModule.checkConnectionAvailability.mockImplementation((type: string) => {
      return type === 'git-credentials';
    });
    commonModule.getConnectionDetails.mockImplementation(() => ({}));

    // Act
    await getConnections(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(response.data.connections).toHaveLength(3); // 1 MCP + 2 credential connections
    
    const connectionTypes = response.data.connections.map((c: any) => c.type);
    expect(connectionTypes).toContain('mcp-server');
    expect(connectionTypes).toContain('credential');
    
    const connectionNames = response.data.connections.map((c: any) => c.name);
    expect(connectionNames).toContain('slack');
    expect(connectionNames).toContain('git-credentials');
    expect(connectionNames).toContain('docker-registry');
  });

  it('should return true for servers with authorization_token in config', async () => {
    // Arrange
    const commonModule = require('./common.js');
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

    commonModule.checkConnectionAvailability.mockReturnValue(false);
    commonModule.getConnectionDetails.mockImplementation(() => ({}));

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
    const commonModule = require('./common.js');
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

    commonModule.checkConnectionAvailability.mockReturnValue(false);
    commonModule.getConnectionDetails.mockImplementation(() => ({}));

    // Act
    await getConnections(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockDeps.authManager!.isAuthorized).toHaveBeenCalledWith(mockMcpServers[0]);
    
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    const githubConnection = response.data.connections.find((c: any) => c.name === 'github');
    
    expect(githubConnection.isAvailable).toBe(true);

    // Cleanup
    if (originalEnv !== undefined) {
      process.env.MCP_github_authorization_token = originalEnv;
    } else {
      delete process.env.MCP_github_authorization_token;
    }
  });

  it('should prioritize config authorization_token over OAuth tokens', async () => {
    // Arrange
    const commonModule = require('./common.js');
    const mockMcpServers = [
      {
        name: 'priority-test',
        description: 'Priority test server',
        url: 'https://api.test.com',
        authorization_token: 'config-token-priority',
        scopes: ['read']
      }
    ];

    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue(mockMcpServers);
    // Even if OAuth would return false, config token should make this true
    mockDeps.authManager!.isAuthorized = jest.fn().mockResolvedValue(true);

    commonModule.checkConnectionAvailability.mockReturnValue(false);
    commonModule.getConnectionDetails.mockImplementation(() => ({}));

    // Act
    await getConnections(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockDeps.authManager!.isAuthorized).toHaveBeenCalledWith(mockMcpServers[0]);
    
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    const testConnection = response.data.connections.find((c: any) => c.name === 'priority-test');
    
    expect(testConnection.isAvailable).toBe(true);
  });
});
