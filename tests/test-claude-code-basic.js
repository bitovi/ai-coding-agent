#!/usr/bin/env node

/**
 * Simple test for Claude Code Service
 * Tests basic functionality without full app initialization
 */

import { ClaudeCodeService } from '../src/services/ClaudeCodeService.js';

async function testClaudeCodeBasics() {
  console.log('🧪 Testing Claude Code Service Basics\\n');

  try {
    // Test 1: Service creation
    console.log('1️⃣ Testing service creation...');
    const service = new ClaudeCodeService();
    console.log('   ✅ ClaudeCodeService created successfully');

    // Test 2: CLI validation
    console.log('\\n2️⃣ Testing CLI validation...');
    await service.validateCLI();
    console.log('   ✅ Claude CLI is available');

    // Test 3: Basic MCP configuration
    console.log('\\n3️⃣ Testing MCP configuration...');
    const testMcpServers = [
      {
        name: 'test-server',
        type: 'stdio',
        command: 'echo',
        args: ['hello'],
        env: { TEST_VAR: 'test_value' }
      }
    ];

    const configPath = await service.configureMcpServers(testMcpServers, {});
    console.log(`   ✅ MCP config written to: ${configPath}`);

    // Test 4: List MCP servers (if available)
    try {
      console.log('\\n4️⃣ Testing MCP server listing...');
      const servers = await service.listMcpServers();
      console.log(`   📋 Current MCP servers: ${servers || 'None'}`);
    } catch (error) {
      console.log(`   ⚠️  Could not list servers: ${error.message}`);
    }

    // Test 5: Cleanup
    console.log('\\n5️⃣ Testing cleanup...');
    await service.cleanup();
    console.log('   ✅ Cleanup completed');

    console.log('\\n🎉 All basic tests passed!');
    console.log('\\n💡 To test full integration:');
    console.log('   1. Set USE_CLAUDE_CODE=true');
    console.log('   2. Configure MCP_SERVERS and PROMPTS');
    console.log('   3. Run: node index.js');
    console.log('   4. Test prompt execution via web interface');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\\n🔧 Troubleshooting:');
    console.log('   - Ensure Claude Code CLI is installed');
    console.log('   - Visit: https://docs.anthropic.com/en/docs/claude-code/quickstart');
    console.log('   - Run: claude --version');
    console.log('   - Run: claude auth login');
    process.exit(1);
  }
}

testClaudeCodeBasics();
