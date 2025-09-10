import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { getPrompts, getPrompt, setupPromptRoutes } from './prompts.js';

describe('Jira Integration', () => {
  let app: express.Application;
  let mockPromptManager: any;
  let mockConfigManager: any;
  let mockAuthManager: any;
  let mockClaudeService: any;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock the bitovi-jira server
    const mockMcpServers = [
      {
        name: 'bitovi-jira',
        type: 'url',
        url: 'https://jira-mcp-auth-bridge-staging.bitovi.com/mcp',
        authorization_token: null,
        proxy: true,
        tool_configuration: { enabled: true },
        oauth_provider_configuration: null
      }
    ];
    
    // Mock the create-jira-issue prompt
    const mockPrompts = [
      {
        name: 'create-jira-issue',
        mcp_servers: ['bitovi-jira'],
        messages: [
          {
            role: 'user',
            content: "Create a Jira issue in the project '{{projectKey}}' with summary '{{summary}}' and description '{{description}}'. Use issue type '{{issueType}}' if specified, otherwise use 'Task'.",
            parameters: {
              type: 'object',
              properties: {
                summary: {
                  type: 'string',
                  description: 'Brief summary of the issue'
                },
                description: {
                  type: 'string',
                  description: 'Detailed description of the issue'
                },
                issueType: {
                  type: 'string',
                  description: 'Type of issue (Task, Bug, Story, etc.)',
                  default: 'Task'
                },
                projectKey: {
                  type: 'string',
                  description: 'Project key for the Jira project'
                }
              },
              required: ['summary', 'description', 'projectKey']
            }
          }
        ]
      }
    ];
    
    mockPromptManager = {
      getPrompts: jest.fn(() => mockPrompts),
      getPrompt: jest.fn((name: string) => mockPrompts.find(p => p.name === name)),
      savePendingPrompt: jest.fn()
    };
    
    mockConfigManager = {
      getMcpServers: jest.fn(() => mockMcpServers),
      getMcpServer: jest.fn((name: string) => mockMcpServers.find(s => s.name === name))
    };
    
    mockAuthManager = {
      isAuthorized: jest.fn(() => Promise.resolve(false))
    };
    
    mockClaudeService = {
      executePromptStream: jest.fn()
    };
    
    const deps = {
      promptManager: mockPromptManager,
      configManager: mockConfigManager,
      authManager: mockAuthManager,
      claudeService: mockClaudeService
    };
    
    setupPromptRoutes(app as any, deps);
  });
  
  describe('Jira Prompt Configuration', () => {
    it('should load the create-jira-issue prompt correctly', async () => {
      const response = await request(app)
        .get('/api/prompts')
        .expect(200);
      
      expect(response.body.prompts).toHaveLength(1);
      const jiraPrompt = response.body.prompts[0];
      
      expect(jiraPrompt.name).toBe('create-jira-issue');
      expect(jiraPrompt.mcp_servers).toEqual(['bitovi-jira']);
      expect(jiraPrompt.canRun).toBe(false); // Not authorized yet
      expect(jiraPrompt.connections).toHaveLength(1);
      expect(jiraPrompt.connections[0].name).toBe('bitovi-jira');
      expect(jiraPrompt.connections[0].type).toBe('mcp-server');
      expect(jiraPrompt.connections[0].isAvailable).toBe(false);
      expect(jiraPrompt.connections[0].authUrl).toBe('/api/connections/mcp/bitovi-jira/authorize');
    });
    
    it('should get specific Jira prompt details', async () => {
      const response = await request(app)
        .get('/api/prompts/create-jira-issue')
        .expect(200);
      
      expect(response.body.name).toBe('create-jira-issue');
      expect(response.body.mcp_servers).toEqual(['bitovi-jira']);
      expect(response.body.messages).toHaveLength(1);
      
      const message = response.body.messages[0];
      expect(message.role).toBe('user');
      expect(message.content).toContain('Create a Jira issue');
      expect(message.content).toContain('{{projectKey}}');
      expect(message.content).toContain('{{summary}}');
      expect(message.content).toContain('{{description}}');
      
      expect(message.parameters.required).toEqual(['summary', 'description', 'projectKey']);
      expect(message.parameters.properties.summary).toBeDefined();
      expect(message.parameters.properties.description).toBeDefined();
      expect(message.parameters.properties.projectKey).toBeDefined();
      expect(message.parameters.properties.issueType).toBeDefined();
      expect(message.parameters.properties.issueType.default).toBe('Task');
    });
    
    it('should return 404 for non-existent prompt', async () => {
      const response = await request(app)
        .get('/api/prompts/non-existent-prompt')
        .expect(404);
      
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toContain("Prompt 'non-existent-prompt' does not exist");
    });
  });
  
  describe('Jira Prompt Execution', () => {
    it('should require authorization for Jira prompt execution', async () => {
      const response = await request(app)
        .post('/api/prompts/create-jira-issue/run')
        .send({
          parameters: {
            summary: 'Test Issue',
            description: 'This is a test issue',
            projectKey: 'TEST',
            issueType: 'Bug'
          }
        })
        .expect(401);
      
      expect(response.body.error).toBe('Authorization required');
      expect(response.body.unauthorizedServers).toEqual(['bitovi-jira']);
      expect(response.body.message).toContain('Please authorize the required MCP servers');
    });
    
    it('should save pending prompt when authorization is required', async () => {
      const parameters = {
        summary: 'Test Issue',
        description: 'This is a test issue',
        projectKey: 'TEST',
        issueType: 'Bug'
      };
      
      await request(app)
        .post('/api/prompts/create-jira-issue/run')
        .send({ parameters })
        .expect(401);
      
      expect(mockPromptManager.savePendingPrompt).toHaveBeenCalledWith(
        'create-jira-issue',
        expect.objectContaining(parameters)
      );
    });
    
    it('should execute prompt when authorized', async () => {
      // Mock authorization as successful
      mockAuthManager.isAuthorized.mockResolvedValue(true);
      
      const response = await request(app)
        .post('/api/prompts/create-jira-issue/run')
        .send({
          parameters: {
            summary: 'Test Issue',
            description: 'This is a test issue',
            projectKey: 'TEST',
            issueType: 'Bug'
          }
        });
      
      // Should not return 401 when authorized
      expect(response.status).not.toBe(401);
      expect(mockClaudeService.executePromptStream).toHaveBeenCalled();
    });
  });
  
  describe('Jira MCP Server Configuration', () => {
    it('should recognize bitovi-jira as a proxy server', () => {
      const mcpServers = mockConfigManager.getMcpServers();
      const jiraServer = mcpServers.find((s: any) => s.name === 'bitovi-jira');
      
      expect(jiraServer).toBeDefined();
      expect(jiraServer.proxy).toBe(true);
      expect(jiraServer.url).toBe('https://jira-mcp-auth-bridge-staging.bitovi.com/mcp');
      expect(jiraServer.authorization_token).toBe(null); // Requires OAuth
      expect(jiraServer.tool_configuration.enabled).toBe(true);
    });
  });
});