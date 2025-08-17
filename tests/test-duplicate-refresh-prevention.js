#!/usr/bin/env node

/**
 * Test duplicate refresh prevention in AuthManager
 */

import { AuthManager } from '../src/connections/mcp/AuthManager.js';

async function testDuplicateRefreshPrevention() {
  console.log('🧪 Testing Duplicate Refresh Prevention\n');

  const authManager = new AuthManager();

  // Store expired tokens to trigger refresh
  const expiredTokens = {
    access_token: 'expired_access_token_123',
    refresh_token: 'refresh_token_456', 
    token_type: 'Bearer',
    expires_in: -1, // Negative expires_in to ensure expiration
    scope: 'read:jira-work',
    // OAuth metadata for refresh (mock endpoints that will fail)
    token_endpoint: 'https://httpbin.org/status/500', // This will fail, but that's okay for testing
    client_id: 'mock_client_id',
    issued_at: Date.now(),
    expires_at: Date.now() - 1000, // Force expiration
  };

  authManager._storeTokens('test-service', expiredTokens);
  console.log('✅ Stored expired tokens for test-service');

  const mockServer = { 
    name: 'test-service', 
    type: 'url',
    authorization_token: null 
  };

  console.log('\n📋 Test: Concurrent authorization checks');
  console.log('Starting 5 concurrent isAuthorized() calls...');

  // Start multiple concurrent authorization checks
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(
      authManager.isAuthorized(mockServer).catch(error => {
        console.log(`Call ${i + 1} failed (expected):`, error.message.substring(0, 50) + '...');
        return false;
      })
    );
  }

  // Wait for all to complete
  const results = await Promise.all(promises);
  console.log('✅ All concurrent calls completed');
  console.log('Results:', results);

  console.log('\n💡 Expected behavior:');
  console.log('- First call detects expired token and starts refresh');
  console.log('- Subsequent calls wait for the first refresh to complete');
  console.log('- Only one actual refresh request is made to the token endpoint');
  console.log('- All calls get the same result');

  console.log('\n🎉 Duplicate refresh prevention test completed!');
  console.log('Check the logs above to verify only one refresh attempt was made.');
}

// Run the test
testDuplicateRefreshPrevention().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
