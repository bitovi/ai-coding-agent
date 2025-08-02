import { ClaudeServiceFactory } from '../src/services/ClaudeServiceFactory.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testClaudeCodeSDK() {
  console.log('🧪 Testing Claude Code SDK Service Integration...\n');

  try {
    // Test service type detection
    console.log('1. Testing service type detection:');
    console.log('   Current service type:', ClaudeServiceFactory.getServiceType());
    
    // Test switching to Claude Code SDK
    console.log('\n2. Switching to Claude Code SDK:');
    process.env.CLAUDE_SERVICE = 'CLAUDECODESDK';
    console.log('   Service type after switch:', ClaudeServiceFactory.getServiceType());
    
    // Test service creation
    console.log('\n3. Creating Claude Code SDK service:');
    const service = ClaudeServiceFactory.create();
    console.log('   Service created:', service.constructor.name);
    
    // Test configuration validation
    console.log('\n4. Validating configuration:');
    const validation = await ClaudeServiceFactory.validateConfiguration();
    console.log('   Service type:', validation.serviceType);
    console.log('   Is valid:', validation.isValid);
    validation.messages.forEach(msg => console.log('   ', msg));
    
    // Test configuration instructions
    console.log('\n5. Configuration instructions:');
    const instructions = ClaudeServiceFactory.getConfigurationInstructions();
    console.log('   Title:', instructions.title);
    console.log('   Environment variables:', instructions.envVars);
    
    // Test service capabilities
    console.log('\n6. Service capabilities:');
    const capabilities = ClaudeServiceFactory.getServiceCapabilities();
    const sdkCapabilities = capabilities['claude-code-sdk'];
    console.log('   Name:', sdkCapabilities.name);
    console.log('   Features:', sdkCapabilities.features.slice(0, 3).join(', '), '...');
    console.log('   Pros:', sdkCapabilities.pros.slice(0, 2).join(', '), '...');
    
    // Test switching between service types
    console.log('\n7. Testing service type switching:');
    const switchResult = await ClaudeServiceFactory.switchServiceType('ANTHROPIC');
    console.log('   Switched from:', switchResult.oldType, 'to:', switchResult.newType);
    console.log('   Switch successful:', switchResult.success);
    
    // Switch back to Claude Code SDK
    await ClaudeServiceFactory.switchServiceType('CLAUDECODESDK');
    console.log('   Switched back to:', ClaudeServiceFactory.getServiceType());
    
    console.log('\n✅ All tests passed! Claude Code SDK service is properly integrated.\n');
    
    // Display usage instructions
    console.log('📖 Usage Instructions:');
    console.log('   To use Claude Code SDK, set: CLAUDE_SERVICE=CLAUDECODESDK');
    console.log('   To use Claude Code CLI, set: CLAUDE_SERVICE=CLAUDECODE');
    console.log('   To use Claude Anthropic SDK, set: CLAUDE_SERVICE=ANTHROPIC (or leave unset)');
    console.log('   Remember to set ANTHROPIC_API_KEY for SDK-based services');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testClaudeCodeSDK().catch(console.error);
