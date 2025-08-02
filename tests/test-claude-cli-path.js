#!/usr/bin/env node

/**
 * Test script to validate Claude Code CLI path resolution
 */

import { ClaudeCodeService } from '../src/services/ClaudeCodeService.js';
import { ClaudeServiceFactory } from '../src/services/ClaudeServiceFactory.js';

async function testClaudeCommandPath() {
  console.log('🧪 Testing Claude Code CLI path resolution...\n');

  try {
    // Test factory availability check
    console.log('1. Testing ClaudeServiceFactory.isClaudeCodeAvailable()...');
    const isAvailable = await ClaudeServiceFactory.isClaudeCodeAvailable();
    console.log(`   Result: ${isAvailable ? '✅ Available' : '❌ Not available'}\n`);

    if (!isAvailable) {
      console.log('❌ Claude Code CLI not found. Please install it:');
      console.log('   npm install @anthropic-ai/claude-code');
      return;
    }

    // Test service command path resolution
    console.log('2. Testing ClaudeCodeService.getClaudeCommand()...');
    const service = new ClaudeCodeService();
    const commandPath = await service.getClaudeCommand();
    console.log(`   Command path: ${commandPath}`);
    console.log(`   Uses local installation: ${commandPath.includes('node_modules') ? '✅ Yes' : '❌ No'}\n`);

    // Test CLI version check
    console.log('3. Testing CLI version check...');
    await service.validateCLI();
    console.log('   ✅ CLI validation passed\n');

    console.log('🎉 All tests passed! Claude Code CLI is properly configured.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('not installed')) {
      console.log('\n💡 Install Claude Code CLI with:');
      console.log('   npm install @anthropic-ai/claude-code');
    }
  }
}

// Run the test
testClaudeCommandPath().catch(console.error);
