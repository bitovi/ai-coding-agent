#!/usr/bin/env node

/**
 * Utility script to validate configuration files
 */

import dotenv from 'dotenv';
import { ConfigManager } from '../src/config/ConfigManager.js';
import { PromptManager } from '../src/prompts/PromptManager.js';
import { EmailProvider } from '../src/providers/EmailProvider.js';

dotenv.config();

async function validateEnvironment() {
  console.log('🔍 Validating environment variables...\n');

  const required = [
    'EMAIL',
    'ANTHROPIC_API_KEY'
  ];

  const optional = [
    'ACCESS_TOKEN',
    'MCP_SERVERS', 
    'PROMPTS',
    'BASE_URL',
    'PORT',
    'OAUTH_REDIRECT_URI'
  ];

  // Check required variables
  for (const variable of required) {
    if (process.env[variable]) {
      console.log(`✅ ${variable}: Set`);
    } else {
      console.log(`❌ ${variable}: Missing (required)`);
    }
  }

  // Check optional variables  
  for (const variable of optional) {
    if (process.env[variable]) {
      console.log(`✅ ${variable}: Set`);
    } else {
      console.log(`⚠️  ${variable}: Not set (optional)`);
    }
  }

  console.log('');
}

async function validateConfigurations() {
  console.log('📋 Validating configurations...\n');

  try {
    // Test ConfigManager
    console.log('🔧 Testing ConfigManager...');
    const configManager = new ConfigManager();
    await configManager.loadConfigurations();
    console.log(`✅ Loaded ${configManager.getMcpServers().length} MCP servers`);

    // Test PromptManager
    console.log('📝 Testing PromptManager...');
    const promptManager = new PromptManager();
    await promptManager.loadPrompts();
    console.log(`✅ Loaded ${promptManager.getPrompts().length} prompts`);

    // Test EmailProvider
    console.log('📧 Testing EmailProvider...');
    const emailService = new EmailProvider();
    const emailTest = await emailService.testEmailConfiguration();
    if (emailTest.success) {
      console.log(`✅ Email service: ${emailTest.message}`);
    } else {
      console.log(`⚠️  Email service: ${emailTest.message}`);
    }

    console.log('\n✅ All configurations valid');

  } catch (error) {
    console.error('\n❌ Configuration validation failed:', error.message);
    return false;
  }

  return true;
}

async function main() {
  console.log('🔧 AI Coding Agent - Configuration Validator\n');

  await validateEnvironment();
  const configValid = await validateConfigurations();

  if (!configValid) {
    process.exit(1);
  }

  console.log('\n🎉 Configuration validation completed successfully!');
}

main().catch(console.error);
