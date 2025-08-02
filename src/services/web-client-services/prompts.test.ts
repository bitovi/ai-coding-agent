import type { Request, Response } from 'express';
import { getPrompts } from './prompts.js';
import type { Dependencies } from './common.js';

// Mock the common module
jest.mock('./common.js', () => ({
  handleError: jest.fn(),
  checkConnectionAvailability: jest.fn(),
  getConnectionDescription: jest.fn(),
  getConnectionMethod: jest.fn(),
}));

describe('getPrompts', () => {
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
      headers: {}
    };

    // Mock response
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      redirect: jest.fn()
    };

    // Mock dependencies
    mockDeps = {
      promptManager: {
        getPrompts: jest.fn()
      },
      configManager: {
        getMcpServers: jest.fn()
      },
      authManager: {
        isAuthorized: jest.fn()
      }
    };
  });

  it('should return empty prompts array when no prompts exist', () => {
    // Arrange
    mockDeps.promptManager!.getPrompts = jest.fn().mockReturnValue([]);
    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue([]);

    // Act
    getPrompts(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: { prompts: [] },
      timestamp: expect.any(String)
    });
  });

  it('should return prompts with basic information when no connections required', () => {
    // Arrange
    const mockPrompts = [
      {
        name: 'simple-prompt',
        description: 'A simple prompt without connections',
        messages: [{ role: 'user', content: 'Hello' }],
        parameters: {}
      }
    ];

    mockDeps.promptManager!.getPrompts = jest.fn().mockReturnValue(mockPrompts);
    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue([]);

    // Act
    getPrompts(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: {
        prompts: [
          {
            name: 'simple-prompt',
            description: 'A simple prompt without connections',
            messages: [{ role: 'user', content: 'Hello' }],
            parameters: {},
            canRun: true,
            connections: []
          }
        ]
      },
      timestamp: expect.any(String)
    });
  });

  it('should return prompts with MCP server connections', () => {
    // Arrange
    const mockPrompts = [
      {
        name: 'mcp-prompt',
        description: 'A prompt with MCP server',
        messages: [{ role: 'user', content: 'Hello' }],
        parameters: {},
        mcp_servers: ['jira', 'github']
      }
    ];

    const mockMcpServers = [
      {
        name: 'jira',
        description: 'Jira integration',
        url: 'https://api.atlassian.com',
        scopes: ['read:jira-work']
      },
      {
        name: 'github',
        description: 'GitHub integration',
        url: 'https://api.github.com',
        scopes: ['repo']
      }
    ];

    mockDeps.promptManager!.getPrompts = jest.fn().mockReturnValue(mockPrompts);
    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue(mockMcpServers);
    mockDeps.authManager!.isAuthorized = jest.fn()
      .mockReturnValueOnce(true)  // jira authorized
      .mockReturnValueOnce(false); // github not authorized

    // Act
    getPrompts(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: {
        prompts: [
          {
            name: 'mcp-prompt',
            description: 'A prompt with MCP server',
            messages: [{ role: 'user', content: 'Hello' }],
            parameters: {},
            canRun: false, // Because github is not authorized
            connections: [
              {
                name: 'jira',
                type: 'mcp-server',
                description: 'Jira integration',
                isAvailable: true,
                authUrl: '/api/connections/mcp/jira/authorize',
                details: {
                  url: 'https://api.atlassian.com',
                  scopes: ['read:jira-work'],
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
              }
            ]
          }
        ]
      },
      timestamp: expect.any(String)
    });

    expect(mockDeps.authManager!.isAuthorized).toHaveBeenCalledWith('jira');
    expect(mockDeps.authManager!.isAuthorized).toHaveBeenCalledWith('github');
  });

  it('should return prompts with credential connections', () => {
    // Arrange - Import and mock the common functions dynamically
    const commonModule = require('./common.js');
    commonModule.checkConnectionAvailability.mockImplementation((type: string) => {
      return type === 'git-credentials';
    });
    
    commonModule.getConnectionDescription.mockImplementation((type: string) => {
      return type === 'git-credentials' ? 'Git credentials for repository access' : 'Unknown connection';
    });
    
    commonModule.getConnectionMethod.mockImplementation((type: string) => {
      return type === 'git-credentials' ? 'token' : 'unknown';
    });

    const mockPrompts = [
      {
        name: 'git-prompt',
        description: 'A prompt with git credentials',
        messages: [{ role: 'user', content: 'Clone repo' }],
        parameters: {},
        connections: {
          dev: ['git-credentials'],
          prod: ['docker-registry']
        }
      }
    ];

    mockDeps.promptManager!.getPrompts = jest.fn().mockReturnValue(mockPrompts);
    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue([]);

    // Act
    getPrompts(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: {
        prompts: [
          {
            name: 'git-prompt',
            description: 'A prompt with git credentials',
            messages: [{ role: 'user', content: 'Clone repo' }],
            parameters: {},
            canRun: false, // Because docker-registry is not available
            connections: [
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
                description: 'Unknown connection',
                isAvailable: false,
                setupUrl: '/api/connections/credential/docker-registry/setup',
                details: {
                  lastConfigured: null,
                  method: 'unknown'
                }
              }
            ]
          }
        ]
      },
      timestamp: expect.any(String)
    });
  });

  it('should handle prompts with missing MCP server configurations', () => {
    // Arrange
    const mockPrompts = [
      {
        name: 'missing-mcp-prompt',
        description: 'A prompt with missing MCP server config',
        messages: [{ role: 'user', content: 'Hello' }],
        parameters: {},
        mcp_servers: ['nonexistent-server']
      }
    ];

    mockDeps.promptManager!.getPrompts = jest.fn().mockReturnValue(mockPrompts);
    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue([]);
    mockDeps.authManager!.isAuthorized = jest.fn().mockReturnValue(false);

    // Act
    getPrompts(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: {
        prompts: [
          {
            name: 'missing-mcp-prompt',
            description: 'A prompt with missing MCP server config',
            messages: [{ role: 'user', content: 'Hello' }],
            parameters: {},
            canRun: false,
            connections: [
              {
                name: 'nonexistent-server',
                type: 'mcp-server',
                description: 'nonexistent-server integration',
                isAvailable: false,
                authUrl: '/api/connections/mcp/nonexistent-server/authorize',
                details: undefined
              }
            ]
          }
        ]
      },
      timestamp: expect.any(String)
    });
  });

  it('should handle missing dependencies gracefully', () => {
    // Arrange
    const emptyDeps: Dependencies = {};

    // Act
    getPrompts(emptyDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: { prompts: [] },
      timestamp: expect.any(String)
    });
  });

  it('should call handleError when an exception occurs', () => {
    // Arrange
    const commonModule = require('./common.js');
    const error = new Error('Test error');
    
    mockDeps.promptManager!.getPrompts = jest.fn().mockImplementation(() => {
      throw error;
    });

    // Act
    getPrompts(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(commonModule.handleError).toHaveBeenCalledWith(mockRes, error);
  });

  it('should mark canRun as true when all connections are available', () => {
    // Arrange
    const mockPrompts = [
      {
        name: 'all-available-prompt',
        description: 'A prompt with all connections available',
        messages: [{ role: 'user', content: 'Hello' }],
        parameters: {},
        mcp_servers: ['jira']
      }
    ];

    const mockMcpServers = [
      {
        name: 'jira',
        description: 'Jira integration',
        url: 'https://api.atlassian.com',
        scopes: ['read:jira-work']
      }
    ];

    mockDeps.promptManager!.getPrompts = jest.fn().mockReturnValue(mockPrompts);
    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue(mockMcpServers);
    mockDeps.authManager!.isAuthorized = jest.fn().mockReturnValue(true);

    // Act
    getPrompts(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(response.data.prompts[0].canRun).toBe(true);
  });

  it('should handle mixed MCP servers and credentials', () => {
    // Arrange
    const commonModule = require('./common.js');
    
    commonModule.checkConnectionAvailability.mockReturnValue(true);
    commonModule.getConnectionDescription.mockReturnValue('Git credentials');
    commonModule.getConnectionMethod.mockReturnValue('token');

    const mockPrompts = [
      {
        name: 'mixed-prompt',
        description: 'A prompt with both MCP and credentials',
        messages: [{ role: 'user', content: 'Hello' }],
        parameters: {},
        mcp_servers: ['jira'],
        connections: {
          dev: ['git-credentials']
        }
      }
    ];

    const mockMcpServers = [
      {
        name: 'jira',
        description: 'Jira integration',
        url: 'https://api.atlassian.com'
      }
    ];

    mockDeps.promptManager!.getPrompts = jest.fn().mockReturnValue(mockPrompts);
    mockDeps.configManager!.getMcpServers = jest.fn().mockReturnValue(mockMcpServers);
    mockDeps.authManager!.isAuthorized = jest.fn().mockReturnValue(true);

    // Act
    getPrompts(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(response.data.prompts[0].connections).toHaveLength(2);
    expect(response.data.prompts[0].connections[0].type).toBe('mcp-server');
    expect(response.data.prompts[0].connections[1].type).toBe('credential');
    expect(response.data.prompts[0].canRun).toBe(true);
  });
});
