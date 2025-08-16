#!/usr/bin/env node

/**
 * Test script for Git credentials validation
 * Tests the hasGitCredentials function with prepared server configurations
 */

import dotenv from 'dotenv';
import { hasGitCredentials, getGitCredentialDetails } from '../src/connections/special/git-credentials.ts';
import { ConfigManager } from '../src/config/ConfigManager.js';

dotenv.config();

/**
 * Create a test server configuration for git-mcp-server
 */
function createTestServerConfig() {
  return {
    command: 'node',
    args: ['/path/to/git-mcp-server'],
    transport: 'stdio',
    env: {
      HOME: process.env.HOME || process.env.GIT_HOME_DIR || '/tmp',
      GIT_WORKING_DIR: process.env.GIT_WORKING_DIR || './shared-repos'
    }
  };
}

/**
 * Test hasGitCredentials with different server configurations
 */
async function testHasGitCredentials() {
  console.log('🔧 Testing hasGitCredentials Function\n');

  try {
    // Test 1: Load actual MCP server configuration
    console.log('📋 Test 1: Using MCP Server Configuration');
    console.log('==========================================');
    
    try {
      const configManager = new ConfigManager();
      await configManager.loadConfigurations();
      
      const actualGitServer = configManager.getMcpServer('git-mcp-server');
      if (actualGitServer) {
        console.log('✅ Found git-mcp-server in MCP configuration');
        console.log(`   Command: ${actualGitServer.command}`);
        console.log(`   Transport: ${actualGitServer.transport}`);
        console.log(`   HOME: ${actualGitServer.env?.HOME || 'Not set'}`);
        
        const result1 = hasGitCredentials(actualGitServer);
        console.log(`   hasGitCredentials result: ${result1 ? '✅ Valid' : '❌ Invalid'}`);
        
        const details1 = getGitCredentialDetails(actualGitServer);
        console.log(`   Git home: ${details1.gitHome || 'Not found'}`);
        console.log(`   Has .git-credentials: ${details1.hasGitCredentialsFile ? '✅' : '❌'}`);
        console.log(`   Has SSH keys: ${details1.hasSshKeys ? '✅' : '❌'}`);
        console.log(`   Credential method: ${details1.credentialMethod}`);
      } else {
        console.log('❌ git-mcp-server not found in MCP configuration');
      }
    } catch (error) {
      console.log(`❌ Error loading MCP configuration: ${error.message}`);
    }

    console.log('\n📋 Test 2: Using Test Server Configuration');
    console.log('==========================================');
    
    // Test 2: Use test server configuration
    const testServer = createTestServerConfig();
    console.log('✅ Created test server configuration');
    console.log(`   HOME: ${testServer.env.HOME}`);
    console.log(`   GIT_WORKING_DIR: ${testServer.env.GIT_WORKING_DIR}`);
    
    const result2 = hasGitCredentials(testServer);
    console.log(`   hasGitCredentials result: ${result2 ? '✅ Valid' : '❌ Invalid'}`);
    
    const details2 = getGitCredentialDetails(testServer);
    console.log(`   Git home: ${details2.gitHome || 'Not found'}`);
    console.log(`   Has .git-credentials: ${details2.hasGitCredentialsFile ? '✅' : '❌'}`);
    console.log(`   Has SSH keys: ${details2.hasSshKeys ? '✅' : '❌'}`);
    console.log(`   Credential method: ${details2.credentialMethod}`);

    console.log('\n📋 Test 3: Testing with Custom HOME Directory');
    console.log('==============================================');
    
    // Test 3: Test with custom home directory
    const customServer = {
      ...testServer,
      env: {
        ...testServer.env,
        HOME: process.env.GIT_HOME_DIR || process.env.HOME
      }
    };
    
    console.log(`   Custom HOME: ${customServer.env.HOME}`);
    const result3 = hasGitCredentials(customServer);
    console.log(`   hasGitCredentials result: ${result3 ? '✅ Valid' : '❌ Invalid'}`);
    
    const details3 = getGitCredentialDetails(customServer);
    console.log(`   Git home: ${details3.gitHome || 'Not found'}`);
    console.log(`   Has .git-credentials: ${details3.hasGitCredentialsFile ? '✅' : '❌'}`);
    console.log(`   Has SSH keys: ${details3.hasSshKeys ? '✅' : '❌'}`);
    console.log(`   Credential method: ${details3.credentialMethod}`);

    console.log('\n📋 Test 4: Testing with Invalid HOME Directory');
    console.log('===============================================');
    
    // Test 4: Test with invalid home directory
    const invalidServer = {
      ...testServer,
      env: {
        ...testServer.env,
        HOME: '/nonexistent/directory'
      }
    };
    
    console.log(`   Invalid HOME: ${invalidServer.env.HOME}`);
    const result4 = hasGitCredentials(invalidServer);
    console.log(`   hasGitCredentials result: ${result4 ? '✅ Valid' : '❌ Invalid'}`);
    
    const details4 = getGitCredentialDetails(invalidServer);
    console.log(`   Git home: ${details4.gitHome || 'Not found'}`);
    console.log(`   Error: ${details4.error || 'None'}`);

    // Summary
    const results = [result2, result3];
    const validCount = results.filter(r => r).length;
    
    console.log('\n🎯 Test Summary');
    console.log('===============');
    console.log(`Valid configurations: ${validCount}/${results.length}`);
    
    return validCount > 0;
    
  } catch (error) {
    console.error('\n❌ Error during testing:', error.message);
    return false;
  }
}

/**
 * Provide usage instructions and recommendations
 */
function showUsageInstructions(hasValidCredentials) {
  console.log('\n💡 Usage Instructions');
  console.log('====================');
  
  if (hasValidCredentials) {
    console.log('✅ Your Git credentials are properly configured!');
    console.log('   The git-mcp-server should work correctly.');
  } else {
    console.log('❌ No valid Git credentials found.');
    console.log('   To set up Git authentication, choose one of these methods:');
    console.log('');
    console.log('   🔐 Method 1: Git Credentials File');
    console.log('   --------------------------------');
    console.log('   1. Run: git config --global credential.helper store');
    console.log('   2. Clone or pull from a private repo to trigger credential storage');
    console.log('   3. Your credentials will be saved to ~/.git-credentials');
    console.log('');
    console.log('   🔑 Method 2: SSH Keys');
    console.log('   -------------------');
    console.log('   1. Generate SSH key: ssh-keygen -t ed25519 -C "your_email@example.com"');
    console.log('   2. Add to SSH agent: ssh-add ~/.ssh/id_ed25519');
    console.log('   3. Add public key to GitHub: https://github.com/settings/keys');
    console.log('');
    console.log('   🌍 Method 3: Environment Variables (for Docker)');
    console.log('   ----------------------------------------------');
    console.log('   Set GIT_HOME_DIR to a directory containing .git-credentials or .ssh keys');
  }
  
  console.log('\n🏠 Git Home Directory Priority:');
  console.log('   1. Server env.HOME (from MCP server config)');
  console.log('   2. GIT_HOME_DIR environment variable');
  console.log('   3. System HOME environment variable');
}

/**
 * Main test function
 */
async function main() {
  const hasValidCredentials = await testHasGitCredentials();
  
  showUsageInstructions(hasValidCredentials);
  
  console.log('\n📊 Final Result');
  console.log('===============');
  
  if (hasValidCredentials) {
    console.log('🎉 Git credentials validation: PASSED');
    console.log('   The hasGitCredentials function is working correctly!');
    return true;
  } else {
    console.log('⚠️  Git credentials validation: FAILED');
    console.log('   Set up Git credentials and run the test again.');
    return false;
  }
}

// Run the script
main().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});
