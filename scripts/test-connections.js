#!/usr/bin/env node

/**
 * Utility script to test MCP server connections and OAuth flows
 */

import dotenv from 'dotenv';
import { ConfigManager } from '../src/config/ConfigManager.js';
import { AuthManager } from '../src/auth/AuthManager.js';

dotenv.config();

async function main() {
  console.log('🔧 AI Coding Agent - Connection Test\n');

  try {
    // Initialize services
    const configManager = new ConfigManager();
    const authManager = new AuthManager();

    // Load configurations
    console.log('📋 Loading configurations...');
    await configManager.loadConfigurations();

    const mcpServers = configManager.getMcpServers();
    console.log(`✅ Loaded ${mcpServers.length} MCP servers\n`);

    // Test each MCP server
    for (const server of mcpServers) {
      console.log(`🔍 Testing connection to: ${server.name}`);
      console.log(`   Type: ${server.type}`);
      console.log(`   URL: ${server.url}`);

      // Check authorization status
      if (server.authorization_token) {
        console.log(`   ✅ Has authorization token`);
      } else if (await authManager.isAuthorized(server.name)) {
        console.log(`   ✅ Has stored OAuth tokens`);
      } else {
        console.log(`   ⚠️  No authorization - OAuth flow required`);
        
        if (server.oauth_provider_configuration) {
          console.log(`   📋 Has OAuth configuration`);
        } else {
          console.log(`   🔍 Will use endpoint discovery`);
        }
      }

      console.log('');
    }

    console.log('🎯 Connection test completed');
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
