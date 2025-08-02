#!/usr/bin/env node

/**
 * Test script for Claude Code Service integration
 * Demonstrates switching between Claude SDK and Claude Code CLI
 */

import { ClaudeServiceFactory } from '../src/services/ClaudeServiceFactory.js';
import { ConfigManager } from '../src/config/ConfigManager.js';
import { AuthManager } from '../src/auth/AuthManager.js';
import { PromptManager } from '../src/prompts/PromptManager.js';

async function testClaudeServices() {
  console.log('🧪 Testing Claude Service Integration\\n');

  // Show current configuration
  console.log('📋 Current Configuration:');
  const currentValidation = await ClaudeServiceFactory.validateConfiguration();
  console.log(`   Service Type: ${currentValidation.serviceType}`);
  for (const message of currentValidation.messages) {
    console.log(`   ${message}`);
  }
  console.log('');

  // Show service capabilities
  console.log('⚡ Service Capabilities:');
  const capabilities = ClaudeServiceFactory.getServiceCapabilities();
  for (const [serviceType, info] of Object.entries(capabilities)) {
    console.log(`\\n   ${info.name}:`);
    for (const feature of info.features) {
      console.log(`     ${feature}`);
    }
  }
  console.log('');

  // Test service creation
  console.log('🔧 Testing Service Creation:');
  try {
    const service = ClaudeServiceFactory.create();
    console.log(`   ✅ Successfully created ${ClaudeServiceFactory.getServiceType()} service`);
    
    if (ClaudeServiceFactory.getServiceType() === 'claude-code') {
      console.log('   🔍 Testing Claude Code CLI availability...');
      const isAvailable = await ClaudeServiceFactory.isClaudeCodeAvailable();
      console.log(`   ${isAvailable ? '✅' : '❌'} Claude Code CLI ${isAvailable ? 'is' : 'is not'} available`);
      
      if (isAvailable && service.listMcpServers) {
        try {
          console.log('   📋 Listing current MCP servers...');
          const servers = await service.listMcpServers();
          console.log(`   MCP Servers: ${servers || 'None configured'}`);
        } catch (error) {
          console.log(`   ⚠️  Could not list MCP servers: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.log(`   ❌ Failed to create service: ${error.message}`);
  }
  console.log('');

  // Test switching services
  console.log('🔄 Testing Service Switching:');
  const currentType = ClaudeServiceFactory.getServiceType();
  const targetType = currentType === 'claude-code' ? 'claude-sdk' : 'claude-code';
  
  console.log(`   Current: ${currentType}`);
  console.log(`   Switching to: ${targetType}`);
  
  const switchResult = await ClaudeServiceFactory.switchServiceType(targetType);
  console.log(`   Switch ${switchResult.success ? 'successful' : 'failed'}`);
  
  for (const message of switchResult.validation.messages) {
    console.log(`   ${message}`);
  }
  
  // Switch back
  await ClaudeServiceFactory.switchServiceType(currentType);
  console.log(`   Switched back to: ${currentType}`);
  console.log('');

  // Show configuration instructions
  console.log('📖 Configuration Instructions:');
  const instructions = ClaudeServiceFactory.getConfigurationInstructions();
  console.log(`   ${instructions.title}`);
  console.log('   Environment Variables:');
  for (const envVar of instructions.envVars) {
    console.log(`     ${envVar}`);
  }
  console.log('');

  // Test with actual prompt (if available)
  console.log('🎯 Testing with Sample Configuration:');
  try {
    const configManager = new ConfigManager();
    const authManager = new AuthManager();
    const promptManager = new PromptManager();
    
    // Try to load configurations
    console.log('   Loading configurations...');
    // Note: These might fail if not properly configured, which is expected
    
    console.log('   ✅ Configuration managers created successfully');
    console.log('   💡 To test actual prompt execution, ensure:');
    console.log('      - MCP_SERVERS environment variable is set');
    console.log('      - PROMPTS environment variable is set');
    console.log('      - Appropriate authentication is configured');
    
  } catch (error) {
    console.log(`   ⚠️  Configuration test: ${error.message}`);
  }
  console.log('');

  console.log('✅ Claude Service Integration Test Complete');
  console.log('\\n💡 Next Steps:');
  console.log('   1. Set USE_CLAUDE_CODE=true to use Claude Code CLI');
  console.log('   2. Set USE_CLAUDE_CODE=false (or unset) to use Claude SDK');
  console.log('   3. Ensure proper authentication is configured');
  console.log('   4. Test with actual prompts and MCP servers');
}

// Handle cleanup for Claude Code service
async function cleanup() {
  if (ClaudeServiceFactory.getServiceType() === 'claude-code') {
    try {
      const service = ClaudeServiceFactory.create();
      if (service.cleanup) {
        await service.cleanup();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Run the test
testClaudeServices()
  .then(() => cleanup())
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
