/**
 * Tests for the test service functionality
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { testConnections, validateConfiguration, runSystemTest } from './tests.js';

// Mock the AuthManager module
jest.mock('../connections/mcp/AuthManager.js', () => {
  return {
    AuthManager: jest.fn().mockImplementation(() => ({
      isAuthorized: jest.fn().mockImplementation((server: any) => {
        // Mock figma as authorized, others as not authorized
        return Promise.resolve(server.name === 'figma');
      })
    }))
  };
});

// Mock ConfigManager
class MockConfigManager {
  getMcpServers() {
    return [
      {
        name: 'bitovi-jira',
        type: 'url',
        url: 'https://mcp.atlassian.com/v1/sse',
        proxy: true
      },
      {
        name: 'github',
        type: 'url',
        url: 'https://api.github.com/mcp'
      },
      {
        name: 'figma',
        type: 'url',
        url: 'https://api.figma.com/mcp',
        authorization_token: 'test-token'
      }
    ];
  }
}

describe('Tests Service', () => {
  let mockConfigManager: MockConfigManager;

  beforeEach(() => {
    mockConfigManager = new MockConfigManager();
  });

  describe('testConnections', () => {
    it('should return connection test results', async () => {
      const results = await testConnections(mockConfigManager);
      
      expect(results).toHaveLength(3);
      
      // Check bitovi-jira (not authorized)
      const jiraResult = results.find(r => r.connectionName === 'bitovi-jira');
      expect(jiraResult).toBeDefined();
      expect(jiraResult?.success).toBe(false);
      expect(jiraResult?.hasAuth).toBe(false);
      expect(jiraResult?.message).toContain('requires authorization');
      
      // Check github (not authorized)
      const githubResult = results.find(r => r.connectionName === 'github');
      expect(githubResult).toBeDefined();
      expect(githubResult?.success).toBe(false);
      expect(githubResult?.hasAuth).toBe(false);
      
      // Check figma (authorized via static token)
      const figmaResult = results.find(r => r.connectionName === 'figma');
      expect(figmaResult).toBeDefined();
      expect(figmaResult?.success).toBe(true);
      expect(figmaResult?.hasAuth).toBe(true);
      expect(figmaResult?.authMethod).toBe('static_token');
    });

    it('should handle errors gracefully', async () => {
      const errorConfigManager = {
        getMcpServers() {
          throw new Error('Config error');
        }
      };

      const results = await testConnections(errorConfigManager);
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].connectionName).toBe('system');
      expect(results[0].message).toContain('Error testing connections');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate environment variables', async () => {
      // Set required env vars for the test
      const originalEmail = process.env.EMAIL;
      const originalApiKey = process.env.ANTHROPIC_API_KEY;
      
      process.env.EMAIL = 'test@example.com';
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const results = await validateConfiguration();
      
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('Environment Variables');
      expect(results[0].success).toBe(true);
      
      const emailItem = results[0].items.find(item => item.name === 'EMAIL');
      expect(emailItem?.status).toBe('success');
      
      const apiKeyItem = results[0].items.find(item => item.name === 'ANTHROPIC_API_KEY');
      expect(apiKeyItem?.status).toBe('success');

      // Restore original env vars
      if (originalEmail) process.env.EMAIL = originalEmail;
      else delete process.env.EMAIL;
      if (originalApiKey) process.env.ANTHROPIC_API_KEY = originalApiKey;
      else delete process.env.ANTHROPIC_API_KEY;
    });
  });

  describe('runSystemTest', () => {
    it('should run comprehensive system test', async () => {
      // Set required env vars for the test
      const originalEmail = process.env.EMAIL;
      const originalApiKey = process.env.ANTHROPIC_API_KEY;
      
      process.env.EMAIL = 'test@example.com';
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const result = await runSystemTest(mockConfigManager);
      
      expect(result.overall).toBeDefined();
      expect(result.connections).toHaveLength(3);
      expect(result.configuration).toHaveLength(1);
      
      // Should have some failing connection tests (bitovi-jira, github not authorized)
      expect(result.overall.success).toBe(false);
      expect(result.overall.message).toContain('issues that need attention');

      // Restore original env vars
      if (originalEmail) process.env.EMAIL = originalEmail;
      else delete process.env.EMAIL;
      if (originalApiKey) process.env.ANTHROPIC_API_KEY = originalApiKey;
      else delete process.env.ANTHROPIC_API_KEY;
    });
  });
});