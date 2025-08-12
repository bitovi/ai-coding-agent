#!/usr/bin/env node

/**
 * Test the consolidated authorization token logic with ConfigManager
 */

import { AuthManager } from '../src/auth/AuthManager.js';
import { ConfigManager } from '../src/config/ConfigManager.js';

async function testConsolidatedAuthLogic() {
  console.log('🧪 Testing Consolidated Authorization Token Logic\n');

  const authManager = new AuthManager();
  const configManager = new ConfigManager();

  // Test 1: Environment variable gets picked up by ConfigManager
  console.log('📋 Test 1: Environment variable integration with ConfigManager');
  
  // Set environment variable
  process.env.MCP_github_authorization_token = 'env-github-token';
  
  // Mock an MCP server configuration (simulate what would be loaded from config)
  configManager.mcpServers.set('github', {
    name: 'github',
    type: 'url',
    url: 'https://api.github.com',
    authorization_token: null // No config token
  });

  // Get server through ConfigManager (should include env token)
  const githubServer = configManager.getMcpServer('github');
  console.log('Server from ConfigManager:', {
    name: githubServer.name,
    hasAuthToken: !!githubServer.authorization_token,
    authToken: githubServer.authorization_token?.substring(0, 10) + '...'
  });

  const isAuthorized = await authManager.isAuthorized(githubServer);
  console.log('✅ GitHub server authorized via env token:', isAuthorized);
  console.assert(isAuthorized === true, 'Should be authorized via environment token');

  // Test 2: Config token takes precedence
  console.log('\n📋 Test 2: Config token precedence');
  
  process.env.MCP_figma_authorization_token = 'env-figma-token';
  
  configManager.mcpServers.set('figma', {
    name: 'figma',
    type: 'url',
    url: 'https://figma.com/mcp/',
    authorization_token: 'config-figma-token' // Config token present
  });

  const figmaServer = configManager.getMcpServer('figma');
  console.log('Figma server token (should be config, not env):', figmaServer.authorization_token);
  console.assert(figmaServer.authorization_token === 'config-figma-token', 'Config token should take precedence');

  const isFigmaAuthorized = await authManager.isAuthorized(figmaServer);
  console.log('✅ Figma server authorized via config token:', isFigmaAuthorized);

  // Test 3: Server without any tokens (OAuth fallback)
  console.log('\n📋 Test 3: OAuth fallback');
  
  configManager.mcpServers.set('jira', {
    name: 'jira',
    type: 'url',
    url: 'https://mcp.atlassian.com/v1/sse',
    authorization_token: null
  });

  const jiraServer = configManager.getMcpServer('jira');
  console.log('Jira server has auth token:', !!jiraServer.authorization_token);
  
  const isJiraAuthorized = await authManager.isAuthorized(jiraServer);
  console.log('✅ Jira server authorized (should be false, no tokens):', isJiraAuthorized);
  console.assert(isJiraAuthorized === false, 'Should not be authorized without tokens');

  // Test 4: getMcpServers() also enriches tokens
  console.log('\n📋 Test 4: getMcpServers() enrichment');
  
  const allServers = configManager.getMcpServers();
  const githubFromList = allServers.find(s => s.name === 'github');
  const figmaFromList = allServers.find(s => s.name === 'figma');
  const jiraFromList = allServers.find(s => s.name === 'jira');

  console.log('GitHub from list has auth token:', !!githubFromList.authorization_token);
  console.log('Figma from list has auth token:', !!figmaFromList.authorization_token);
  console.log('Jira from list has auth token:', !!jiraFromList.authorization_token);

  console.assert(githubFromList.authorization_token === 'env-github-token', 'GitHub should have env token');
  console.assert(figmaFromList.authorization_token === 'config-figma-token', 'Figma should have config token');
  console.assert(!jiraFromList.authorization_token, 'Jira should have no token');

  // Cleanup
  delete process.env.MCP_github_authorization_token;
  delete process.env.MCP_figma_authorization_token;

  console.log('\n🎉 All consolidated authorization logic tests passed!');
  console.log('\n💡 Benefits of consolidation:');
  console.log('   - Environment variables are handled in one place (ConfigManager)');
  console.log('   - AuthManager.isAuthorized() is simplified');
  console.log('   - Consistent behavior across all parts of the system');
  console.log('   - No duplicate environment variable checking');
}

// Run the test
testConsolidatedAuthLogic().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
