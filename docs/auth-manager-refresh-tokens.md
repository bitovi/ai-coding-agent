# AuthManager Refresh Token Enhancement

## Overview

The AuthManager now supports automatic OAuth token refresh functionality. This enhancement allows the system to maintain authorization for MCP services without requiring manual re-authorization when access tokens expire.

## Key Features

### 1. Automatic Token Refresh
- **Lazy Refresh**: Tokens are automatically refreshed when `isAuthorized()` is called and the access token is expired
- **Proactive Refresh**: Tokens can be refreshed before expiration using `refreshIfNeeded()`
- **Metadata Preservation**: OAuth client metadata (token_endpoint, client_id) is stored for refresh operations

### 2. Enhanced Token Storage
- Stores additional metadata required for refresh operations:
  - `token_endpoint`: OAuth token endpoint URL
  - `client_id`: OAuth client identifier
  - `issued_at`: Timestamp when tokens were originally obtained
  - `refreshed_at`: Timestamp of last refresh operation

### 3. New Methods

#### `async isAuthorized(serviceName)`
- **Changed**: Now async to support automatic refresh
- Automatically attempts refresh if token is expired and refresh token is available
- Returns `false` if refresh fails or no refresh token is available

#### `async getValidTokens(serviceName)`
- Returns valid tokens for a service, automatically refreshing if needed
- Returns `null` if service is not authorized or refresh fails

#### `async refreshTokens(serviceName)`
- Manually refresh tokens for a service
- Throws error if no refresh token is available or refresh fails
- Automatically removes tokens if refresh fails (indicating invalid refresh token)

#### `needsRefreshSoon(serviceName)`
- Checks if tokens will expire within 5 minutes
- Useful for proactive refresh strategies

#### `async refreshIfNeeded(serviceName)`
- Proactively refreshes tokens if they expire within 5 minutes
- Safe to call - does nothing if refresh is not needed

#### `cleanupExpiredTokens()`
- Removes expired tokens that cannot be refreshed (no refresh token)
- Useful for periodic cleanup

#### `async getAuthorizationSummary()`
- Returns comprehensive status of all stored tokens
- Includes authorization status, refresh token availability, expiration times

## Usage Examples

### Basic Usage (Automatic Refresh)
```javascript
const authManager = new AuthManager();

// This will automatically refresh if token is expired
const isAuth = await authManager.isAuthorized('jira');
if (isAuth) {
  const tokens = await authManager.getValidTokens('jira');
  // Use tokens.access_token for API calls
}
```

### Proactive Refresh
```javascript
// Refresh tokens before they expire (good for long-running operations)
await authManager.refreshIfNeeded('jira');
const tokens = await authManager.getValidTokens('jira');
```

### Manual Refresh
```javascript
try {
  await authManager.refreshTokens('jira');
  console.log('Tokens refreshed successfully');
} catch (error) {
  console.log('Refresh failed, re-authorization required');
}
```

### Status Monitoring
```javascript
const summary = await authManager.getAuthorizationSummary();
console.log('Authorization Summary:', summary);
// Output:
// {
//   "jira": {
//     "authorized": true,
//     "hasRefreshToken": true,
//     "needsRefreshSoon": false,
//     "expiresAt": "2025-08-10T21:30:00.000Z",
//     "issuedAt": "2025-08-10T20:30:00.000Z",
//     "lastRefreshed": null
//   }
// }
```

## Error Handling

### Refresh Failures
- If refresh fails due to invalid/expired refresh token, the tokens are automatically removed
- Users will need to re-authorize the service
- Errors are logged with appropriate context

### Missing Metadata
- If OAuth metadata is missing (for older stored tokens), refresh will fail with a descriptive error
- This ensures compatibility with existing token storage

## Migration Notes

### Existing Tokens
- Existing tokens without refresh metadata will continue to work until they expire
- When they expire, users will need to re-authorize (since refresh is not possible without metadata)
- New authorizations will include the required metadata

### API Changes
- `isAuthorized()` is now async - update all calls to use `await`
- No other breaking changes to existing functionality

## Configuration

No additional configuration is required. The refresh functionality automatically:
- Stores necessary metadata during initial authorization
- Uses stored metadata for refresh operations
- Falls back gracefully for tokens without refresh capability

## Security Considerations

- Refresh tokens are stored with the same security as access tokens
- Failed refresh attempts automatically clean up invalid tokens
- No additional security risks introduced by the refresh functionality
