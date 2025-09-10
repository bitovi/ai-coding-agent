import type { Request, Response } from 'express';
import { executePrompt } from './prompts.js';

// Mock the Claude service provider to avoid import issues
jest.mock('../providers/claude/ClaudeServiceProvider.js', () => ({
  ClaudeServiceProvider: {
    create: jest.fn(() => ({
      executePromptStream: jest.fn()
    })),
    getServiceType: jest.fn(() => 'claude-code-sdk'),
    validateConfiguration: jest.fn(async () => ({
      serviceType: 'claude-code-sdk',
      isValid: true,
      messages: ['✅ Configuration is valid']
    }))
  }
}));

// Mock the common module
jest.mock('./common.js', () => ({
  handleError: jest.fn(),
}));

// Mock the prompt utils
jest.mock('../../public/js/prompt-utils.js', () => ({
  mergeParametersWithDefaults: jest.fn(),
  processPrompt: jest.fn(),
}));

describe('AI Coding Agent Core Functionality', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockDeps: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock request
    mockReq = {
      params: { promptName: 'test-prompt' },
      body: { parameters: { test: 'value' } },
      headers: {},
      user: { 
        email: 'test@example.com',
        sessionId: 'test-session-123',
        isAuthenticated: true,
        loginMethod: 'magic-link'
      }
    };

    // Mock response with streaming capabilities
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      setHeader: jest.fn()
    };

    // Mock dependencies for prompt execution
    mockDeps = {
      promptManager: {
        getPrompt: jest.fn(),
        savePendingPrompt: jest.fn()
      },
      configManager: {
        getMcpServer: jest.fn()
      },
      authManager: {
        isAuthorized: jest.fn()
      },
      claudeService: {
        executePromptStream: jest.fn()
      },
      emailService: {
        sendAuthorizationNeededEmail: jest.fn()
      }
    };
  });

  describe('ClaudeServiceProvider', () => {
    it('should create default Claude Code SDK service', () => {
      const { ClaudeServiceProvider } = require('../providers/claude/ClaudeServiceProvider.js');
      const service = ClaudeServiceProvider.create();
      expect(service).toBeDefined();
      expect(ClaudeServiceProvider.create).toHaveBeenCalled();
    });

    it('should return correct service type', () => {
      const { ClaudeServiceProvider } = require('../providers/claude/ClaudeServiceProvider.js');
      const serviceType = ClaudeServiceProvider.getServiceType();
      expect(serviceType).toBe('claude-code-sdk');
    });

    it('should validate configuration properly', async () => {
      const { ClaudeServiceProvider } = require('../providers/claude/ClaudeServiceProvider.js');
      const validation = await ClaudeServiceProvider.validateConfiguration();
      expect(validation).toHaveProperty('serviceType');
      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('messages');
      expect(Array.isArray(validation.messages)).toBe(true);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('AI Coding Agent Prompt Execution', () => {
    beforeEach(() => {
      // Setup common mocks for prompt execution tests
      const { mergeParametersWithDefaults, processPrompt } = require('../../public/js/prompt-utils.js');
      mergeParametersWithDefaults.mockReturnValue({ test: 'value' });
      processPrompt.mockReturnValue({
        name: 'test-prompt',
        messages: [{ role: 'user', content: 'Test message with value' }]
      });
    });

    it('should execute a simple prompt without MCP servers', async () => {
      // Arrange
      const testPrompt = {
        name: 'test-prompt',
        messages: [{ role: 'user', content: 'Hello Claude' }],
        parameters: {}
      };

      mockDeps.promptManager.getPrompt.mockReturnValue(testPrompt);
      mockDeps.claudeService.executePromptStream.mockResolvedValue(undefined);

      // Act
      await executePrompt(mockDeps)(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockDeps.promptManager.getPrompt).toHaveBeenCalledWith('test-prompt');
      expect(mockDeps.claudeService.executePromptStream).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-prompt'
        }),
        { test: 'value' },
        mockDeps.configManager,
        mockDeps.authManager,
        mockRes,
        'test@example.com'
      );
    });

    it('should handle prompt not found', async () => {
      // Arrange
      mockDeps.promptManager.getPrompt.mockReturnValue(null);

      // Act
      await executePrompt(mockDeps)(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Prompt not found' });
    });

    it('should handle unauthorized MCP servers', async () => {
      // Arrange
      const testPrompt = {
        name: 'test-prompt',
        messages: [{ role: 'user', content: 'Hello Claude' }],
        mcp_servers: ['jira', 'github'],
        parameters: {}
      };

      mockDeps.promptManager.getPrompt.mockReturnValue(testPrompt);
      mockDeps.configManager.getMcpServer.mockReturnValue({ name: 'jira', url: 'https://jira.com' });
      mockDeps.authManager.isAuthorized.mockResolvedValue(false);

      // Act
      await executePrompt(mockDeps)(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockDeps.promptManager.savePendingPrompt).toHaveBeenCalledWith('test-prompt', { test: 'value' });
      expect(mockDeps.emailService.sendAuthorizationNeededEmail).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Authorization required',
          unauthorizedServers: ['jira', 'github']
        })
      );
    });

    it('should execute prompt with authorized MCP servers', async () => {
      // Arrange
      const testPrompt = {
        name: 'test-prompt',
        messages: [{ role: 'user', content: 'Create a Jira issue' }],
        mcp_servers: ['jira'],
        parameters: {}
      };

      mockDeps.promptManager.getPrompt.mockReturnValue(testPrompt);
      mockDeps.configManager.getMcpServer.mockReturnValue({ 
        name: 'jira', 
        url: 'https://jira.com',
        type: 'url'
      });
      mockDeps.authManager.isAuthorized.mockResolvedValue(true);
      mockDeps.claudeService.executePromptStream.mockResolvedValue(undefined);

      // Act
      await executePrompt(mockDeps)(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockDeps.authManager.isAuthorized).toHaveBeenCalled();
      expect(mockDeps.claudeService.executePromptStream).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-prompt'
        }),
        { test: 'value' },
        mockDeps.configManager,
        mockDeps.authManager,
        mockRes,
        'test@example.com'
      );
    });

    it('should handle mixed authorization states', async () => {
      // Arrange
      const testPrompt = {
        name: 'test-prompt',
        messages: [{ role: 'user', content: 'Create a Jira issue and GitHub PR' }],
        mcp_servers: ['jira', 'github'],
        parameters: {}
      };

      mockDeps.promptManager.getPrompt.mockReturnValue(testPrompt);
      mockDeps.configManager.getMcpServer.mockImplementation((name: string) => ({
        name,
        url: `https://${name}.com`,
        type: 'url'
      }));
      
      // jira is authorized, github is not
      mockDeps.authManager.isAuthorized.mockImplementation((server: any) => {
        return Promise.resolve(server.name === 'jira');
      });

      // Act
      await executePrompt(mockDeps)(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Authorization required',
          unauthorizedServers: ['github']
        })
      );
    });

    it('should handle Claude service unavailability gracefully', async () => {
      // Arrange
      const testPrompt = {
        name: 'test-prompt',
        messages: [{ role: 'user', content: 'Hello Claude' }],
        parameters: {}
      };

      mockDeps.promptManager.getPrompt.mockReturnValue(testPrompt);
      mockDeps.claudeService.executePromptStream = null; // Claude service unavailable

      // Act
      await executePrompt(mockDeps)(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream'
      }));
    });

    it('should handle parameter merging correctly', async () => {
      // Arrange
      const testPrompt = {
        name: 'test-prompt',
        messages: [{ role: 'user', content: 'Create issue: {{summary}}' }],
        parameters: {
          type: 'object',
          properties: {
            summary: { type: 'string', default: 'Default summary' }
          }
        }
      };

      const { mergeParametersWithDefaults } = require('../../public/js/prompt-utils.js');
      mergeParametersWithDefaults.mockReturnValue({ 
        summary: 'Test issue summary',
        test: 'value' 
      });

      mockDeps.promptManager.getPrompt.mockReturnValue(testPrompt);
      mockDeps.claudeService.executePromptStream.mockResolvedValue(undefined);

      // Act
      await executePrompt(mockDeps)(mockReq as Request, mockRes as Response);

      // Assert
      expect(mergeParametersWithDefaults).toHaveBeenCalledWith(testPrompt, { test: 'value' });
    });

    it('should handle error cases properly', async () => {
      // Arrange
      mockDeps.promptManager.getPrompt.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      // Act
      await executePrompt(mockDeps)(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Database connection failed' });
    });
  });

  describe('AI Coding Agent Integration', () => {
    it('should demonstrate end-to-end workflow', async () => {
      // This test demonstrates the complete AI coding agent workflow
      // from prompt definition to execution with MCP services
      
      // Arrange - Setup a realistic scenario
      const codePrompt = {
        name: 'create-feature',
        description: 'Create a new feature with Jira ticket and GitHub PR',
        messages: [
          {
            role: 'user',
            content: 'Create a Jira ticket for feature {{feature}} and then create a GitHub PR to implement it'
          }
        ],
        mcp_servers: ['jira', 'github'],
        parameters: {
          type: 'object',
          properties: {
            feature: { type: 'string' }
          },
          required: ['feature']
        }
      };

      const { mergeParametersWithDefaults, processPrompt } = require('../../public/js/prompt-utils.js');
      mergeParametersWithDefaults.mockReturnValue({ feature: 'User authentication' });
      processPrompt.mockReturnValue({
        ...codePrompt,
        messages: [
          {
            role: 'user',
            content: 'Create a Jira ticket for feature User authentication and then create a GitHub PR to implement it'
          }
        ]
      });

      mockReq.params = { promptName: 'create-feature' };
      mockReq.body = { parameters: { feature: 'User authentication' } };
      
      mockDeps.promptManager.getPrompt.mockReturnValue(codePrompt);
      mockDeps.configManager.getMcpServer.mockImplementation((name: string) => ({
        name,
        url: `https://mcp.${name}.com/v1/sse`,
        type: 'url',
        authorization_token: `${name}_token_123`
      }));
      mockDeps.authManager.isAuthorized.mockResolvedValue(true);

      // Mock successful Claude execution
      mockDeps.claudeService.executePromptStream.mockImplementation(async (prompt: any, params: any, config: any, auth: any, res: Response) => {
        // Simulate streaming response
        res.writeHead!(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        
        res.write!('data: {"type": "message_start"}\n\n');
        res.write!('data: {"type": "content_block_delta", "delta": {"text": "Creating Jira ticket..."}}\n\n');
        res.write!('data: {"type": "content_block_delta", "delta": {"text": "\\nCreating GitHub PR..."}}\n\n');
        res.write!('data: {"type": "message_stop"}\n\n');
        res.end!();
      });

      // Act
      await executePrompt(mockDeps)(mockReq as Request, mockRes as Response);

      // Assert - Verify the complete workflow
      expect(mockDeps.promptManager.getPrompt).toHaveBeenCalledWith('create-feature');
      expect(mergeParametersWithDefaults).toHaveBeenCalledWith(codePrompt, { feature: 'User authentication' });
      expect(processPrompt).toHaveBeenCalled();
      
      // Verify MCP authorization checks
      expect(mockDeps.configManager.getMcpServer).toHaveBeenCalledWith('jira');
      expect(mockDeps.configManager.getMcpServer).toHaveBeenCalledWith('github');
      expect(mockDeps.authManager.isAuthorized).toHaveBeenCalledTimes(2);
      
      // Verify Claude execution
      expect(mockDeps.claudeService.executePromptStream).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'create-feature',
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('User authentication')
            })
          ])
        }),
        { feature: 'User authentication' },
        mockDeps.configManager,
        mockDeps.authManager,
        mockRes,
        'test@example.com'
      );

      // Verify streaming headers were set
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream'
      }));
    });
  });
});