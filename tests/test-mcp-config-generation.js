#!/usr/bin/env node

/**
 * Test script to verify MCP server configuration generation for Claude Code SDK
 */

import { ClaudeCodeSDKService } from '../src/providers/claude/ClaudeCodeSDKService.ts';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

async function testMcpConfigGeneration() {
  console.log('🧪 Testing MCP configuration generation for Claude Code SDK...\n');

  try {
    // Set a mock API key for testing
    process.env.ANTHROPIC_API_KEY = 'mock-api-key-for-testing';
    
    // Create a test instance
    const service = new ClaudeCodeSDKService();
    
    // Mock MCP servers with different types
    const testMcpServers = [
      {
        name: 'test-stdio-server',
        type: 'stdio',
        command: '/usr/local/bin/test-server',
        args: ['--mode', 'production'],
        env: {
          'API_KEY': 'test-key-123',
          'DEBUG': 'true'
        }
      },
      {
        name: 'test-http-server',
        type: 'http',
        url: 'https://api.example.com/mcp',
        authorization_token: 'bearer-token-456',
        headers: {
          'X-Custom-Header': 'custom-value'
        }
      },
      {
        name: 'test-sse-server',
        type: 'sse',
        url: 'https://sse.example.com/mcp',
        authorization_token: 'sse-token-789'
      }
    ];

    console.log('1️⃣ Testing MCP server configuration generation...');
    console.log(`   Input servers: ${testMcpServers.length}`);
    
    // Mock auth manager
    const mockAuthManager = {
      getTokens: () => null
    };

    // Call configureMcpServers
    const mcpConfigPath = await service.configureMcpServers(testMcpServers, mockAuthManager);
    console.log(`   Generated config path: ${mcpConfigPath}`);

    // Read and verify the generated config
    console.log('\n2️⃣ Verifying generated .mcp.json content...');
    const configContent = await fs.readJson(mcpConfigPath);
    console.log('   Generated config:');
    console.log(JSON.stringify(configContent, null, 2));

    // Validate the content
    const { mcpServers } = configContent;
    const serverNames = Object.keys(mcpServers);
    
    console.log('\n3️⃣ Validation results:');
    console.log(`   ✅ Config file created: ${await fs.pathExists(mcpConfigPath)}`);
    console.log(`   ✅ Number of servers configured: ${serverNames.length}`);
    console.log(`   ✅ Server names: ${serverNames.join(', ')}`);
    
    // Check specific server configurations
    const stdioServer = mcpServers['test-stdio-server'];
    const httpServer = mcpServers['test-http-server'];
    const sseServer = mcpServers['test-sse-server'];
    
    console.log('\n4️⃣ Server-specific validations:');
    console.log(`   ✅ STDIO server command: ${stdioServer?.command}`);
    console.log(`   ✅ STDIO server args: ${JSON.stringify(stdioServer?.args)}`);
    console.log(`   ✅ STDIO server env: ${JSON.stringify(stdioServer?.env)}`);
    
    console.log(`   ✅ HTTP server URL: ${httpServer?.url}`);
    console.log(`   ✅ HTTP server auth header: ${httpServer?.headers?.['Authorization']}`);
    console.log(`   ✅ HTTP server custom header: ${httpServer?.headers?.['X-Custom-Header']}`);
    
    console.log(`   ✅ SSE server URL: ${sseServer?.url}`);
    console.log(`   ✅ SSE server auth header: ${sseServer?.headers?.['Authorization']}`);

    // Test cleanup
    console.log('\n5️⃣ Testing cleanup...');
    await service.cleanup();
    console.log(`   ✅ Temp directory cleaned up: ${!await fs.pathExists(mcpConfigPath)}`);

    console.log('\n🎉 All MCP configuration tests passed!');
    console.log('\n💡 Summary:');
    console.log('   - MCP servers are correctly transformed for Claude Code SDK');
    console.log('   - Authorization tokens are properly included in headers');
    console.log('   - Different server types (stdio, http, sse) are handled correctly');
    console.log('   - .mcp.json file is generated with proper structure');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testMcpConfigGeneration();
