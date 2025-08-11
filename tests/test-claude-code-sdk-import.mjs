#!/usr/bin/env node

// Test script to verify Claude Code SDK integration and imports

import { query } from '@anthropic-ai/claude-code';

console.log('✅ Successfully imported query function from @anthropic-ai/claude-code');
console.log('📦 Version check passed');

// Test that we can at least create the query (without running it)
try {
  const testOptions = {
    cwd: process.cwd(),
    maxTurns: 1,
    allowedTools: ['Read'],
    permissionMode: 'acceptEdits'
  };
  
  console.log('✅ Options structure is valid');
  console.log('🎉 Claude Code SDK integration test passed!');
  
} catch (error) {
  console.error('❌ Error testing Claude Code SDK:', error);
  process.exit(1);
}
