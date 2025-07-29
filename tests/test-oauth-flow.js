#!/usr/bin/env node

/**
 * Test script to trigger OAuth flow for Atlassian MCP service
 */

import fetch from 'node-fetch';
import open from 'open';

const BASE_URL = 'http://localhost:3000';

async function testOAuthFlow() {
  try {
    console.log('🔍 Testing Atlassian MCP OAuth flow...');
    
    // Step 1: Trigger authorization for jira service
    console.log('📤 Triggering OAuth authorization for Jira service...');
    
    const authResponse = await fetch(`${BASE_URL}/mcp/jira/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test_access_token'
      }
    });
    
    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      throw new Error(`Authorization request failed: ${authResponse.status} ${authResponse.statusText} - ${errorText}`);
    }
    
    const authData = await authResponse.json();
    console.log('✅ Authorization URL generated:', authData.authUrl);
    
    // Step 2: Open the authorization URL in browser
    console.log('🌐 Opening authorization URL in browser...');
    await open(authData.authUrl);
    
    console.log('✅ OAuth flow initiated successfully!');
    console.log('👆 Please complete the authorization in your browser.');
    console.log('📋 The callback will be handled at: http://localhost:3000/oauth/callback');
    
  } catch (error) {
    console.error('❌ OAuth flow test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testOAuthFlow();
