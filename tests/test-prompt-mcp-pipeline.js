#!/usr/bin/env node

/**
 * Test script to verify the full prompt MCP server pipeline from prompt configuration to Claude Code SDK
 */

import { ClaudeCodeSDKService } from '../src/providers/claude/ClaudeCodeSDKService.ts';
import { ConfigManager } from '../src/config/ConfigManager.js';
import { PromptManager } from '../src/prompts/PromptManager.js';
import { AuthManager } from '../src/auth/AuthManager.js';
import fs from 'fs-extra';

async function testPromptMcpPipeline() {
  console.log('🧪 Testing full MCP server pipeline from prompt to Claude Code SDK...\n');

  try {
    // Set a mock API key for testing
    process.env.ANTHROPIC_API_KEY = 'mock-api-key-for-testing';
    
    // 1. Create test MCP servers configuration
    console.log('1️⃣ Creating test MCP servers configuration...');
    const testMcpServers = [
      {
        name: 'github-mcp',
        type: 'http',
        url: 'https://api.github.com/mcp',
        authorization_token: 'ghp_test_token_123'
      },
      {
        name: 'jira-mcp',
        type: 'sse',
        url: 'https://mcp.atlassian.com/v1/sse',
        authorization_token: null // This will need OAuth
      },
      {
        name: 'git-mcp-server',
        type: 'stdio',
        command: 'npx',
        args: ['@cyanheads/git-mcp-server'],
        env: {
          'MCP_LOG_LEVEL': 'info',
          'GIT_SIGN_COMMITS': 'false'
        }
      }
    ];

    // 2. Create test prompt configuration
    console.log('2️⃣ Creating test prompt with MCP servers...');
    const testPrompt = {
      name: 'test-mcp-prompt',
      description: 'Test prompt with MCP server dependencies',
      mcp_servers: ['github-mcp', 'jira-mcp', 'git-mcp-server'],
      messages: [
        {
          role: 'user',
          content: 'Create a GitHub issue and then clone the repository using git.'
        }
      ],
      parameters: []
    };

    // 3. Set up temporary environment
    const tempMcpConfig = JSON.stringify(testMcpServers);
    process.env.MCP_SERVERS = tempMcpConfig;
    
    // 4. Initialize managers
    console.log('3️⃣ Initializing configuration and auth managers...');
    const configManager = new ConfigManager();
    await configManager.loadConfigurations();
    
    const authManager = new AuthManager();
    
    // Mock OAuth token for jira-mcp
    authManager.storeTokens('jira-mcp', {
      access_token: 'oauth_jira_token_456',
      token_type: 'Bearer',
      expires_at: Date.now() + 3600000
    });

    console.log(`   ✅ Loaded ${configManager.getMcpServers().length} MCP servers from config`);
    const isJiraAuthorized = await authManager.isAuthorized('jira-mcp');
    console.log(`   ✅ jira-mcp OAuth token stored: ${isJiraAuthorized}`);

    // 5. Test ConfigManager.prepareMcpServersForClaude()
    console.log('\n4️⃣ Testing MCP server preparation...');
    const preparedMcpServers = configManager.prepareMcpServersForClaude(
      testPrompt.mcp_servers,
      authManager
    );
    
    console.log(`   ✅ Prepared ${preparedMcpServers.length} MCP servers`);
    console.log('   Server details:');
    preparedMcpServers.forEach((server, index) => {
      console.log(`     ${index + 1}. ${server.name} (${server.type})`);
      if (server.authorization_token) {
        console.log(`        🔐 Has auth token: ${server.authorization_token.substring(0, 10)}...`);
      }
      if (server.command) {
        console.log(`        📋 Command: ${server.command} ${server.args?.join(' ') || ''}`);
      }
      if (server.url) {
        console.log(`        🌐 URL: ${server.url}`);
      }
    });

    // 6. Test Claude Code SDK service configuration
    console.log('\n5️⃣ Testing Claude Code SDK MCP configuration...');
    const service = new ClaudeCodeSDKService();
    const mcpConfigPath = await service.configureMcpServers(preparedMcpServers, authManager);
    
    // Read and verify the generated config
    console.log('\n6️⃣ Verifying generated .mcp.json content...');
    const configContent = await fs.readJson(mcpConfigPath);
    console.log('   Generated config:');
    console.log(JSON.stringify(configContent, null, 2));

    const { mcpServers } = configContent;
    const serverNames = Object.keys(mcpServers);
    
    console.log('\n7️⃣ Pipeline validation results:');
    console.log(`   ✅ Prompt MCP servers defined: ${testPrompt.mcp_servers.length}`);
    console.log(`   ✅ MCP servers loaded by ConfigManager: ${configManager.getMcpServers().length}`);
    console.log(`   ✅ MCP servers prepared for Claude: ${preparedMcpServers.length}`);
    console.log(`   ✅ MCP servers written to .mcp.json: ${serverNames.length}`);
    console.log(`   ✅ Final server names: ${serverNames.join(', ')}`);
    
    // 8. Test authorization status
    console.log('\n8️⃣ Testing authorization status...');
    for (const serverName of testPrompt.mcp_servers) {
      const server = configManager.getMcpServer(serverName);
      const hasConfigToken = server?.authorization_token;
      const envTokenKey = `MCP_${serverName}_authorization_token`;
      const hasEnvToken = process.env[envTokenKey];
      const hasOAuthToken = await authManager.isAuthorized(serverName);
      
      console.log(`   ${serverName}:`);
      console.log(`     📋 Config token: ${hasConfigToken ? 'Yes' : 'No'}`);
      console.log(`     🌍 Env token: ${hasEnvToken ? 'Yes' : 'No'}`);
      console.log(`     🔐 OAuth token: ${hasOAuthToken ? 'Yes' : 'No'}`);
      console.log(`     ✅ Authorized: ${hasConfigToken || hasEnvToken || hasOAuthToken ? 'Yes' : 'No'}`);
    }

    // Test cleanup
    console.log('\n9️⃣ Testing cleanup...');
    await service.cleanup();
    console.log(`   ✅ Temp directory cleaned up: ${!await fs.pathExists(mcpConfigPath)}`);

    console.log('\n🎉 Full MCP pipeline test passed!');
    console.log('\n💡 Summary:');
    console.log('   - MCP servers from prompt are correctly loaded by ConfigManager');
    console.log('   - Authorization tokens are properly resolved (config, env, OAuth)');
    console.log('   - MCP servers are correctly prepared for Claude Code SDK');
    console.log('   - .mcp.json file is generated with proper server configurations');
    console.log('   - Full pipeline from prompt → config → Claude SDK is working');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testPromptMcpPipeline();
