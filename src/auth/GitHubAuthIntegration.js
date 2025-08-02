import { GitHubOAuthService } from './GitHubOAuthService.js';

/**
 * Integration helper for GitHub OAuth with the existing AuthManager
 * This bridges the GitHub OAuth service with the MCP auth system
 */
export class GitHubAuthIntegration {
  constructor(authManager) {
    this.authManager = authManager;
    this.githubOAuth = new GitHubOAuthService();
    
    // Register GitHub as a known OAuth provider
    this.registerGitHubProvider();
  }

  /**
   * Register GitHub as an OAuth provider in the auth manager
   */
  registerGitHubProvider() {
    // Create a GitHub server configuration that can be used with existing auth flow
    const githubServerConfig = {
      name: 'github',
      type: 'oauth',
      provider: 'github',
      oauth_provider_configuration: {
        provider: 'GitHub',
        issuer: 'https://github.com',
        authorization_endpoint: 'https://github.com/login/oauth/authorize',
        token_endpoint: 'https://github.com/login/oauth/access_token',
        userinfo_endpoint: 'https://api.github.com/user',
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        client_type: 'confidential',
        scopes_supported: ['repo', 'user', 'user:email', 'read:org'],
        default_scopes: ['repo', 'user:email', 'read:org'],
        supports_pkce: true,
        supports_device_flow: true
      }
    };

    console.log('📋 Registered GitHub as OAuth provider');
    return githubServerConfig;
  }

  /**
   * Check if GitHub is authorized for a user session
   */
  isGitHubAuthorized(sessionId) {
    return this.githubOAuth.isAuthorized(sessionId);
  }

  /**
   * Get GitHub tokens for a session
   */
  getGitHubTokens(sessionId) {
    return this.githubOAuth.getTokens(sessionId);
  }

  /**
   * Initiate GitHub OAuth flow (web-based)
   */
  async initiateGitHubAuth(sessionId, options = {}) {
    const defaultOptions = {
      scopes: ['repo', 'user:email', 'read:org'],
      allowSignup: true
    };
    
    return this.githubOAuth.initiateWebFlow(sessionId, { ...defaultOptions, ...options });
  }

  /**
   * Initiate GitHub device flow (for CLI/headless)
   */
  async initiateGitHubDeviceFlow(sessionId, options = {}) {
    const defaultOptions = {
      scopes: ['repo', 'user:email', 'read:org']
    };
    
    return this.githubOAuth.initiateDeviceFlow(sessionId, { ...defaultOptions, ...options });
  }

  /**
   * Handle GitHub OAuth callback
   */
  async handleGitHubCallback(code, state) {
    return this.githubOAuth.handleCallback(code, state);
  }

  /**
   * Poll GitHub device flow for completion
   */
  async pollGitHubDeviceFlow(deviceCode) {
    return this.githubOAuth.pollDeviceFlow(deviceCode);
  }

  /**
   * Get Git credentials for GitHub operations
   */
  getGitCredentials(sessionId) {
    if (!this.isGitHubAuthorized(sessionId)) {
      throw new Error('GitHub not authorized for this session');
    }
    
    return this.githubOAuth.getGitCredentials(sessionId);
  }

  /**
   * Get user information from GitHub
   */
  async getGitHubUserInfo(sessionId) {
    return this.githubOAuth.getUserInfo(sessionId);
  }

  /**
   * Revoke GitHub authorization
   */
  async revokeGitHubAuth(sessionId) {
    return this.githubOAuth.revokeTokens(sessionId);
  }

  /**
   * Create an MCP server configuration for a GitHub repository
   * This allows GitHub repos to be treated as MCP servers in your prompt system
   */
  createGitHubMcpServer(repoUrl, sessionId, options = {}) {
    if (!this.isGitHubAuthorized(sessionId)) {
      throw new Error('GitHub authorization required');
    }

    const tokens = this.getGitHubTokens(sessionId);
    const credentials = this.getGitCredentials(sessionId);
    
    // Parse repository URL
    const repoMatch = repoUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
    if (!repoMatch) {
      throw new Error('Invalid GitHub repository URL');
    }
    
    const [, owner, repo] = repoMatch;
    const serverName = options.name || `github-${owner}-${repo}`;
    
    return {
      name: serverName,
      type: 'github-repo',
      repository: {
        url: repoUrl,
        owner,
        repo,
        branch: options.branch || 'main'
      },
      authorization: {
        type: 'oauth',
        provider: 'github',
        token: tokens.access_token,
        scopes: tokens.scope?.split(' ') || [],
        session_id: sessionId
      },
      git_credentials: credentials,
      capabilities: [
        'read_files',
        'write_files',
        'create_branch',
        'create_pr',
        'list_files',
        'get_commits'
      ],
      description: `GitHub repository: ${owner}/${repo}`,
      ...options
    };
  }

  /**
   * Validate that a GitHub MCP server is still authorized
   */
  validateGitHubMcpServer(mcpServer) {
    if (mcpServer.type !== 'github-repo') {
      return true; // Not a GitHub server, skip validation
    }

    const sessionId = mcpServer.authorization?.session_id;
    if (!sessionId) {
      return false;
    }

    return this.isGitHubAuthorized(sessionId);
  }

  /**
   * Refresh GitHub authorization for an MCP server
   */
  async refreshGitHubMcpServer(mcpServer) {
    if (mcpServer.type !== 'github-repo') {
      throw new Error('Not a GitHub MCP server');
    }

    const sessionId = mcpServer.authorization?.session_id;
    if (!sessionId || !this.isGitHubAuthorized(sessionId)) {
      throw new Error('GitHub authorization invalid or expired');
    }

    // Update credentials
    const tokens = this.getGitHubTokens(sessionId);
    const credentials = this.getGitCredentials(sessionId);
    
    mcpServer.authorization.token = tokens.access_token;
    mcpServer.authorization.scopes = tokens.scope?.split(' ') || [];
    mcpServer.git_credentials = credentials;
    
    return mcpServer;
  }

  /**
   * Get all GitHub-authorized sessions
   */
  getGitHubSessions() {
    return this.githubOAuth.getSessions().filter(sessionId => 
      this.isGitHubAuthorized(sessionId)
    );
  }

  /**
   * Cleanup expired GitHub sessions
   */
  cleanup() {
    this.githubOAuth.cleanupExpiredSessions();
  }
}
