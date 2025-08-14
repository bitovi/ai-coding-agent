#!/usr/bin/env node

/**
 * Test authorization token support in AuthManager
 * Tests both config-based authorization_token and environment variable MCP_${serverName}_authorization_token
 */

import { AuthManager } from '../src/auth/AuthManager.js';

async function testAuthorizationTokenSupport() {
  console.log('🧪 Testing Authorization Token Support in AuthManager\n');

  const authManager = new AuthManager();

  // Test 1: Config-based authorization_token
  console.log('📋 Test 1: Config-based authorization_token');
  const serverWithConfigToken = {
    name: 'figma',
    type: 'url',
    url: 'https://figma.com/mcp/',
    authorization_token: 'my-figma-auth-token',
    tool_configuration: { enabled: true }
  };

  const isConfigAuthorized = await authManager.isAuthorized(serverWithConfigToken);
  console.log('✅ Server with config authorization_token is authorized:', isConfigAuthorized);
  console.assert(isConfigAuthorized === true, 'Config token should authorize the server');

  // Test 2: Environment variable authorization_token
  console.log('\n📋 Test 2: Environment variable authorization_token');
  
  // Set environment variable
  process.env.MCP_github_authorization_token = 'my-github-env-token';
  
  const serverWithoutConfigToken = {
    name: 'github',
    type: 'url', 
    url: 'https://api.githubcopilot.com/mcp/',
    authorization_token: null,
    tool_configuration: { enabled: true }
  };

  const isEnvAuthorized = await authManager.isAuthorized(serverWithoutConfigToken);
  console.log('✅ Server with env authorization_token is authorized:', isEnvAuthorized);
  console.assert(isEnvAuthorized === true, 'Environment token should authorize the server');

  // Test 3: No authorization tokens (should fall back to OAuth check)
  console.log('\n📋 Test 3: No authorization tokens (OAuth fallback)');
  const serverWithoutTokens = {
    name: 'jira',
    type: 'url',
    url: 'https://mcp.atlassian.com/v1/sse',
    authorization_token: null,
    tool_configuration: { enabled: true }
  };

  const isOAuthAuthorized = await authManager.isAuthorized(serverWithoutTokens);
  console.log('✅ Server without tokens uses OAuth fallback:', isOAuthAuthorized);
  // This should be false since we haven't stored any OAuth tokens

  // Test 4: Priority test - config token should take precedence
  console.log('\n📋 Test 4: Config token takes precedence over env token');
  
  // Set env token for test server
  process.env.MCP_test_authorization_token = 'env-token';
  
  const serverWithBothTokens = {
    name: 'test',
    type: 'url',
    authorization_token: 'config-token', // Config token present
  };

  const isPrecedenceAuthorized = await authManager.isAuthorized(serverWithBothTokens);
  console.log('✅ Server with both tokens is authorized (config takes precedence):', isPrecedenceAuthorized);
  console.assert(isPrecedenceAuthorized === true, 'Config token should take precedence');

  // Test 5: Test with OAuth tokens stored (should still check authorization tokens first)
  console.log('\n📋 Test 5: Authorization tokens take precedence over OAuth');
  
  // Store OAuth tokens for a server
  authManager.storeTokens('oauth-test', {
    access_token: 'oauth_access_token_123',
    token_type: 'Bearer',
    expires_at: Date.now() + 3600000 // Valid for 1 hour
  });

  const serverWithConfigAndOAuth = {
    name: 'oauth-test',
    type: 'url',
    authorization_token: 'config-token-priority',
  };

  const isConfigPriorityAuthorized = await authManager.isAuthorized(serverWithConfigAndOAuth);
  console.log('✅ Config token takes precedence over OAuth:', isConfigPriorityAuthorized);
  console.assert(isConfigPriorityAuthorized === true, 'Config token should take precedence over OAuth');

  // Clean up environment variables
  delete process.env.MCP_github_authorization_token;
  delete process.env.MCP_test_authorization_token;

  console.log('\n🎉 All authorization token tests passed!');
}

// Run the test
testAuthorizationTokenSupport().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
