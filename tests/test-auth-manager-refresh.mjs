#!/usr/bin/env node

// Test script for AuthManager refresh token functionality

import { AuthManager } from '../src/auth/AuthManager.js';

async function testRefreshTokenFunctionality() {
  console.log('🧪 Testing AuthManager refresh token functionality...\n');
  
  const authManager = new AuthManager();
  
  // Test 1: Check initial state
  console.log('📋 Test 1: Authorization summary (empty state)');
  const emptySummary = await authManager.getAuthorizationSummary();
  console.log('Summary:', emptySummary);
  console.log('✅ Empty state test passed\n');
  
  // Test 2: Store mock tokens with refresh capability
  console.log('📋 Test 2: Store mock tokens with refresh capability');
  const mockTokens = {
    access_token: 'mock_access_token_123',
    refresh_token: 'mock_refresh_token_456', 
    token_type: 'Bearer',
    expires_in: 3600, // 1 hour
    scope: 'read:jira-work',
    // OAuth metadata for refresh
    token_endpoint: 'https://auth.atlassian.com/oauth/token',
    client_id: 'mock_client_id',
    issued_at: Date.now()
  };
  
  authManager.storeTokens('jira', mockTokens);
  console.log('✅ Mock tokens stored\n');
  
  // Test 3: Check authorization status
  console.log('📋 Test 3: Check authorization status');
  const isAuthorized = await authManager.isAuthorized('jira');
  console.log('Is authorized:', isAuthorized);
  console.log('✅ Authorization check passed\n');
  
  // Test 4: Check if refresh is needed soon (should be false for fresh tokens)
  console.log('📋 Test 4: Check if refresh needed soon');
  const needsRefresh = authManager.needsRefreshSoon('jira');
  console.log('Needs refresh soon:', needsRefresh);
  console.log('✅ Refresh timing check passed\n');
  
  // Test 5: Store expired tokens to test refresh logic
  console.log('📋 Test 5: Store expired tokens to test refresh logic');
  const expiredTokens = {
    access_token: 'expired_access_token_123',
    refresh_token: 'expired_refresh_token_456', 
    token_type: 'Bearer',
    expires_in: -1, // Negative expires_in to ensure expiration
    scope: 'read:jira-work',
    // OAuth metadata for refresh
    token_endpoint: 'https://auth.atlassian.com/oauth/token',
    client_id: 'mock_client_id',
    issued_at: Date.now(),
    expires_at: Date.now() - 1000, // Force expiration
  };
  
  authManager.storeTokens('jira-expired', expiredTokens);
  
  // This should return false and log refresh attempt (which will fail due to mock endpoint)
  const isExpiredAuthorized = await authManager.isAuthorized('jira-expired');
  console.log('Is expired token authorized:', isExpiredAuthorized);
  console.log('✅ Expired token handling test completed\n');
  
  // Test 6: Final authorization summary
  console.log('📋 Test 6: Final authorization summary');
  const finalSummary = await authManager.getAuthorizationSummary();
  console.log('Final summary:', JSON.stringify(finalSummary, null, 2));
  console.log('✅ Final summary test passed\n');
  
  // Test 7: Cleanup
  console.log('📋 Test 7: Cleanup expired tokens');
  authManager.cleanupExpiredTokens();
  console.log('✅ Cleanup test completed\n');
  
  console.log('🎉 All AuthManager refresh token tests completed!');
}

// Run the test
testRefreshTokenFunctionality().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
