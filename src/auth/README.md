# GitHub OAuth Integration

This directory contains a comprehensive GitHub OAuth implementation that integrates with the existing AI Coding Agent authentication system.

## Components

### GitHubOAuthService.js
Core OAuth service that handles:
- **Web Application Flow**: Browser-based OAuth for web applications
- **Device Flow**: CLI/headless OAuth for command-line tools
- **Token Management**: Secure storage and retrieval of access tokens
- **User Information**: Fetching GitHub user data
- **Git Credentials**: Providing tokens for Git operations

### GitHubAuthIntegration.js
Integration layer that bridges GitHub OAuth with the existing MCP auth system:
- Registers GitHub as an OAuth provider
- Creates GitHub MCP server configurations
- Validates GitHub authorization for MCP servers
- Provides unified interface for GitHub operations

### Configuration Files
- `config/github-oauth-provider.json`: OAuth provider configuration
- `tests/test-github-oauth.js`: Comprehensive test suite

## Setup

### 1. Create GitHub OAuth App
1. Go to [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/applications/new)
2. Create a new OAuth App with these settings:
   - **Application name**: Your application name
   - **Homepage URL**: `http://localhost:3000` (or your domain)
   - **Authorization callback URL**: `http://localhost:3000/oauth/github/callback`

### 2. Environment Variables
```bash
export GITHUB_CLIENT_ID="your_github_client_id"
export GITHUB_CLIENT_SECRET="your_github_client_secret"
export GITHUB_REDIRECT_URI="http://localhost:3000/oauth/github/callback"  # Optional
```

### 3. Integration with Existing System
```javascript
import { AuthManager } from '../connections/mcp/AuthManager.js';
import { GitHubAuthIntegration } from './GitHubAuthIntegration.js';

const authManager = new AuthManager();
const githubAuth = new GitHubAuthIntegration(authManager);
```

## Usage Examples

### Web Application Flow
```javascript
// Initiate OAuth flow
const sessionId = 'user-session-123';
const authUrl = await githubAuth.initiateGitHubAuth(sessionId, {
  scopes: ['repo', 'user:email', 'read:org']
});

// Redirect user to authUrl...

// Handle callback
const result = await githubAuth.handleGitHubCallback(code, state);
console.log('User:', result.userInfo.login);
console.log('Token:', result.tokens.access_token);
```

### Device Flow (CLI)
```javascript
// Start device flow
const deviceFlow = await githubAuth.initiateGitHubDeviceFlow(sessionId);
console.log('Go to:', deviceFlow.verificationUri);
console.log('Enter code:', deviceFlow.userCode);

// Poll for completion
const result = await githubAuth.pollGitHubDeviceFlow(deviceFlow.deviceCode);
if (result) {
  console.log('Authorized!', result.userInfo.login);
}
```

### Git Operations
```javascript
// Get credentials for Git
const credentials = githubAuth.getGitCredentials(sessionId);

// Use with git clone
const cloneUrl = `https://${credentials.username}:${credentials.password}@github.com/owner/repo.git`;

// Or set up git credential helper
process.env.GIT_ASKPASS = 'echo';
process.env.GIT_USERNAME = credentials.username;
process.env.GIT_PASSWORD = credentials.password;
```

### MCP Server Integration
```javascript
// Create GitHub repo as MCP server
const mcpServer = githubAuth.createGitHubMcpServer(
  'https://github.com/owner/repo',
  sessionId,
  {
    name: 'my-repo',
    branch: 'main'
  }
);

// Validate authorization
const isValid = githubAuth.validateGitHubMcpServer(mcpServer);

// Refresh if needed
if (!isValid) {
  await githubAuth.refreshGitHubMcpServer(mcpServer);
}
```

### Integration with PromptManager
```javascript
// In your prompt execution system
async function executePrompt(promptName, parameters, sessionId) {
  const prompt = promptManager.getPrompt(promptName);
  
  // Check if prompt requires GitHub access
  const needsGitHub = prompt.mcp_servers.some(server => 
    configManager.getMcpServer(server)?.type === 'github-repo'
  );
  
  if (needsGitHub && !githubAuth.isGitHubAuthorized(sessionId)) {
    // Save as pending and initiate GitHub auth
    promptManager.savePendingPrompt(promptName, parameters);
    const authUrl = await githubAuth.initiateGitHubAuth(sessionId);
    return { requiresAuth: true, authUrl };
  }
  
  // Execute normally
  return await executePromptWithServers(prompt, parameters);
}
```

## Testing

Run the comprehensive test suite:
```bash
node tests/test-github-oauth.js
```

This will start a test server at `http://localhost:3000` where you can test both OAuth flows.

## Security Features

- **PKCE Support**: Proof Key for Code Exchange for enhanced security
- **State Validation**: Prevents CSRF attacks
- **Scope Management**: Request only necessary permissions
- **Token Expiration**: Automatic cleanup of expired sessions
- **Secure Storage**: Tokens stored in memory (implement persistent storage as needed)

## Scopes

Common GitHub OAuth scopes:
- `repo`: Full repository access
- `public_repo`: Public repository access only
- `user`: User profile information
- `user:email`: User email addresses
- `read:org`: Read organization membership
- `write:org`: Write organization membership
- `admin:org`: Admin organization access

## Error Handling

The service provides comprehensive error handling for:
- Invalid credentials
- Expired tokens
- Network failures
- Invalid OAuth states
- User denial of access

## Production Considerations

1. **Persistent Storage**: Implement database storage for tokens
2. **Token Refresh**: Add automatic token refresh logic
3. **Rate Limiting**: Implement GitHub API rate limit handling
4. **Logging**: Add proper logging for audit trails
5. **Encryption**: Encrypt stored tokens
6. **Session Management**: Integrate with your user session system
