#!/usr/bin/env node

/**
 * Test script to verify Claude service switching with the new CLAUDE_SERVICE environment variable
 */

import { ClaudeServiceFactory } from './ClaudeServiceFactory.js';

async function testServiceSwitching() {
  console.log('🧪 Testing Claude Service Factory with new CLAUDE_SERVICE environment variable\n');

  // Test all three service types
  const serviceTypes = ['ANTHROPIC', 'CLAUDECODE', 'CLAUDECODESDK'];

  for (const serviceType of serviceTypes) {
    console.log(`\n📋 Testing CLAUDE_SERVICE=${serviceType}`);
    console.log('=' + '='.repeat(50));

    // Set environment variable
    process.env.CLAUDE_SERVICE = serviceType;

    try {
      // Get service info
      const currentType = ClaudeServiceFactory.getServiceType();
      console.log(`🔧 Current service type: ${currentType}`);

      // Create service instance
      const service = ClaudeServiceFactory.create();
      console.log(`✅ Service created: ${service.constructor.name}`);

      // Validate configuration
      const validation = await ClaudeServiceFactory.validateConfiguration();
      console.log(`🔍 Configuration valid: ${validation.isValid}`);
      
      for (const message of validation.messages) {
        console.log(`   ${message}`);
      }

      // Get configuration instructions
      const instructions = ClaudeServiceFactory.getConfigurationInstructions();
      console.log(`📖 Configuration title: ${instructions.title}`);
      console.log(`📝 Environment variables: ${instructions.envVars.join(', ')}`);

    } catch (error) {
      console.error(`❌ Error testing ${serviceType}:`, error.message);
    }
  }

  console.log('\n🎯 Testing service capabilities...');
  const capabilities = ClaudeServiceFactory.getServiceCapabilities();
  
  for (const [key, capability] of Object.entries(capabilities)) {
    console.log(`\n${capability.name}:`);
    console.log(`  Pros: ${capability.pros.slice(0, 2).join(', ')}`);
    console.log(`  Features: ${capability.features.filter(f => f.startsWith('✅')).length} enabled, ${capability.features.filter(f => f.startsWith('❌')).length} disabled`);
  }

  console.log('\n✅ All tests completed!');
}

// Run tests
testServiceSwitching().catch(console.error);
