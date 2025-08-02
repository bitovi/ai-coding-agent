import type { Request, Response } from 'express';
import { getConnections } from './connections.js';
import type { Dependencies } from './common.js';

// Mock the common module
jest.mock('./common.js', () => ({
  handleError: jest.fn(),
  checkConnectionAvailability: jest.fn(),
  setupGitCredentials: jest.fn(),
  setupDockerCredentials: jest.fn(),
}));

describe('getConnections', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockDeps: Dependencies;

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
        isAuthorized: jest.fn()
      }
    };
  });

  it('should return empty connections array when no MCP servers exist', () => {
    // Arrange
    const commonModule = require('./common.js');
    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue([]);
    commonModule.checkConnectionAvailability.mockImplementation(() => false);

    // Act
    getConnections(mockDeps)(mockReq as Request, mockRes as Response);

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

  it('should return MCP server connections with authorization status', () => {
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
      .mockReturnValueOnce(true)  // jira authorized
      .mockReturnValueOnce(false); // github not authorized

    commonModule.checkConnectionAvailability.mockImplementation((type: string) => {
      return type === 'git-credentials';
    });

    // Act
    getConnections(mockDeps)(mockReq as Request, mockRes as Response);

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

    expect(mockDeps.authManager!.isAuthorized).toHaveBeenCalledWith('jira');
    expect(mockDeps.authManager!.isAuthorized).toHaveBeenCalledWith('github');
  });

  it('should handle MCP servers without descriptions', () => {
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
    mockDeps.authManager!.isAuthorized = jest.fn().mockReturnValue(false);
    commonModule.checkConnectionAvailability.mockReturnValue(false);

    // Act
    getConnections(mockDeps)(mockReq as Request, mockRes as Response);

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

  it('should handle available credential connections', () => {
    // Arrange
    const commonModule = require('./common.js');
    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue([]);
    
    commonModule.checkConnectionAvailability.mockImplementation((type: string) => {
      return type === 'git-credentials' || type === 'docker-registry';
    });

    // Act
    getConnections(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    const gitConnection = response.data.connections.find((c: any) => c.name === 'git-credentials');
    const dockerConnection = response.data.connections.find((c: any) => c.name === 'docker-registry');

    expect(gitConnection.isAvailable).toBe(true);
    expect(gitConnection.details.lastConfigured).toEqual(expect.any(String));
    expect(dockerConnection.isAvailable).toBe(true);
    expect(dockerConnection.details.lastConfigured).toEqual(expect.any(String));
  });

  it('should handle missing dependencies gracefully', () => {
    // Arrange
    const commonModule = require('./common.js');
    const emptyDeps: Dependencies = {};
    commonModule.checkConnectionAvailability.mockReturnValue(false);

    // Act
    getConnections(emptyDeps)(mockReq as Request, mockRes as Response);

    // Assert
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.data.connections).toHaveLength(2); // Only credential connections
    expect(response.data.connections[0].name).toBe('git-credentials');
    expect(response.data.connections[1].name).toBe('docker-registry');
  });

  it('should call handleError when an exception occurs', () => {
    // Arrange
    const commonModule = require('./common.js');
    const error = new Error('Test error');
    
    mockDeps.configManager!.getMcpServers = jest.fn().mockImplementation(() => {
      throw error;
    });

    // Act
    getConnections(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(commonModule.handleError).toHaveBeenCalledWith(mockRes, error);
  });

  it('should include all connection types in mixed scenario', () => {
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
    mockDeps.authManager!.isAuthorized = jest.fn().mockReturnValue(true);
    
    commonModule.checkConnectionAvailability.mockImplementation((type: string) => {
      return type === 'git-credentials';
    });

    // Act
    getConnections(mockDeps)(mockReq as Request, mockRes as Response);

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
});
