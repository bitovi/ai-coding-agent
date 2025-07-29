#!/usr/bin/env node

/**
 * Test script to simulate OAuth callback and token exchange
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

// Extract state from the authorization URL generated in the previous test
const STATE = 'x4zzR_R_RVhh-r2y7RaQ9g'; // This would be from the actual authorization URL

async function testOAuthCallback() {
  try {
    console.log('🔍 Testing OAuth callback and token exchange...');
    
    // Simulate OAuth callback with a mock authorization code
    // Note: This will fail at the token exchange step since we don't have a real code,
    // but it will test our manual token exchange implementation
    const mockCode = 'mock_authorization_code_for_testing';
    
    console.log('📤 Simulating OAuth callback...');
    console.log(`📋 Callback URL: ${BASE_URL}/oauth/callback?code=${mockCode}&state=${STATE}`);
    
    const callbackResponse = await fetch(`${BASE_URL}/oauth/callback?code=${mockCode}&state=${STATE}`, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    
    console.log(`📊 Callback response status: ${callbackResponse.status}`);
    
    const responseText = await callbackResponse.text();
    console.log('📄 Callback response:', responseText.substring(0, 200) + '...');
    
    if (callbackResponse.ok) {
      console.log('✅ OAuth callback processed successfully!');
    } else {
      console.log('⚠️  OAuth callback failed (expected with mock code)');
    }
    
  } catch (error) {
    console.error('❌ OAuth callback test failed:', error.message);
  }
}

// Run the test
testOAuthCallback();
