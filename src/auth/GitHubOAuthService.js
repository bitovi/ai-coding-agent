import { generators } from 'openid-client';
import fetch from 'node-fetch';
import { URL } from 'url';

/**
 * Handles GitHub OAuth flows for obtaining access tokens
 * Supports both web application flow and device flow
 */
export class GitHubOAuthService {
  constructor() {
    this.tokenStore = new Map(); // Maps user/session to token data
    this.authSessions = new Map(); // Maps session ID to auth session data
    this.deviceSessions = new Map(); // Maps device code to session data
    
    // GitHub OAuth endpoints
    this.endpoints = {
      authorize: 'https://github.com/login/oauth/authorize',
      token: 'https://github.com/login/oauth/access_token',
      device: 'https://github.com/login/device/code',
      userinfo: 'https://api.github.com/user'
    };
    
    // Default configuration
    this.defaultConfig = {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      redirectUri: process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/oauth/github/callback',
      scopes: ['repo', 'user:email', 'read:org'], // Default scopes for Git operations
      allowSignup: true
    };
    
    this.validateConfig();
  }

  /**
   * Validate required configuration
   */
  validateConfig() {
    if (!this.defaultConfig.clientId) {
      throw new Error('GITHUB_CLIENT_ID environment variable is required');
    }
    
    if (!this.defaultConfig.clientSecret) {
      throw new Error('GITHUB_CLIENT_SECRET environment variable is required');
    }
  }

  /**
   * Check if a user/session has valid GitHub tokens
   */
  isAuthorized(sessionId) {
    const tokens = this.tokenStore.get(sessionId);
    if (!tokens) return false;
    
    // GitHub tokens don't expire by default, but check if manually set
    if (tokens.expires_at && tokens.expires_at < Date.now()) {
      return false;
    }
    
    return true;
  }

  /**
   * Get stored tokens for a session
   */
  getTokens(sessionId) {
    return this.tokenStore.get(sessionId);
  }

  /**
   * Store tokens for a session
   */
  storeTokens(sessionId, tokens) {
    // Add metadata
    tokens.provider = 'github';
    tokens.stored_at = Date.now();
    
    this.tokenStore.set(sessionId, tokens);
    console.log(`✅ Stored GitHub tokens for session: ${sessionId}`);
  }

  /**
   * Initiate GitHub OAuth web application flow
   * @param {string} sessionId - Unique session identifier
   * @param {Object} options - OAuth options
   * @param {string[]} options.scopes - OAuth scopes to request
   * @param {string} options.redirectUri - Override default redirect URI
   * @param {boolean} options.allowSignup - Whether to allow GitHub signups
   * @returns {string} Authorization URL
   */
  initiateWebFlow(sessionId, options = {}) {
    const config = { ...this.defaultConfig, ...options };
    
    // Generate PKCE parameters for security
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    const state = generators.random(16);
    
    // Store session data
    this.authSessions.set(sessionId, {
      state,
      codeVerifier,
      redirectUri: config.redirectUri,
      scopes: config.scopes,
      sessionId,
      type: 'web_flow',
      timestamp: Date.now()
    });
    
    // Build authorization URL
    const authUrl = new URL(this.endpoints.authorize);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', config.redirectUri);
    authUrl.searchParams.set('scope', config.scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('allow_signup', config.allowSignup.toString());
    
    // Add PKCE parameters
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    
    console.log(`🔗 GitHub OAuth flow initiated for session: ${sessionId}`);
    return authUrl.toString();
  }

  /**
   * Initiate GitHub OAuth device flow
   * @param {string} sessionId - Unique session identifier
   * @param {Object} options - OAuth options
   * @param {string[]} options.scopes - OAuth scopes to request
   * @returns {Object} Device flow response
   */
  async initiateDeviceFlow(sessionId, options = {}) {
    const config = { ...this.defaultConfig, ...options };
    
    const response = await fetch(this.endpoints.device, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        scope: config.scopes.join(' ')
      })
    });
    
    if (!response.ok) {
      throw new Error(`GitHub device flow request failed: ${response.status} ${response.statusText}`);
    }
    
    const deviceData = await response.json();
    
    // Store device session data
    this.deviceSessions.set(deviceData.device_code, {
      sessionId,
      deviceCode: deviceData.device_code,
      userCode: deviceData.user_code,
      verificationUri: deviceData.verification_uri,
      interval: deviceData.interval,
      expiresIn: deviceData.expires_in,
      timestamp: Date.now(),
      type: 'device_flow'
    });
    
    console.log(`📱 GitHub device flow initiated for session: ${sessionId}`);
    console.log(`   User code: ${deviceData.user_code}`);
    console.log(`   Verification URL: ${deviceData.verification_uri}`);
    
    return {
      userCode: deviceData.user_code,
      verificationUri: deviceData.verification_uri,
      expiresIn: deviceData.expires_in,
      interval: deviceData.interval,
      deviceCode: deviceData.device_code
    };
  }

  /**
   * Handle OAuth callback from web flow
   * @param {string} code - Authorization code from GitHub
   * @param {string} state - State parameter for validation
   * @returns {Object} Token response
   */
  async handleCallback(code, state) {
    // Find session by state
    let sessionData = null;
    let sessionId = null;
    
    for (const [id, data] of this.authSessions.entries()) {
      if (data.state === state) {
        sessionData = data;
        sessionId = id;
        break;
      }
    }
    
    if (!sessionData) {
      throw new Error('Invalid or expired OAuth state');
    }
    
    // Exchange code for tokens
    const tokenResponse = await fetch(this.endpoints.token, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: this.defaultConfig.clientId,
        client_secret: this.defaultConfig.clientSecret,
        code: code,
        redirect_uri: sessionData.redirectUri,
        code_verifier: sessionData.codeVerifier
      })
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`GitHub token exchange failed: ${tokenResponse.status} ${tokenResponse.statusText}`);
    }
    
    const tokens = await tokenResponse.json();
    
    if (tokens.error) {
      throw new Error(`GitHub OAuth error: ${tokens.error_description || tokens.error}`);
    }
    
    // Store tokens
    this.storeTokens(sessionId, tokens);
    
    // Clean up session
    this.authSessions.delete(sessionId);
    
    // Get user info
    const userInfo = await this.getUserInfo(sessionId);
    
    console.log(`✅ GitHub OAuth completed for user: ${userInfo.login}`);
    
    return {
      tokens,
      userInfo,
      sessionId
    };
  }

  /**
   * Poll for device flow completion
   * @param {string} deviceCode - Device code from initiateDeviceFlow
   * @returns {Object|null} Token response or null if still pending
   */
  async pollDeviceFlow(deviceCode) {
    const sessionData = this.deviceSessions.get(deviceCode);
    if (!sessionData) {
      throw new Error('Invalid device code');
    }
    
    // Check if expired
    const elapsed = (Date.now() - sessionData.timestamp) / 1000;
    if (elapsed > sessionData.expiresIn) {
      this.deviceSessions.delete(deviceCode);
      throw new Error('Device code expired');
    }
    
    const response = await fetch(this.endpoints.token, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: this.defaultConfig.clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
    });
    
    const result = await response.json();
    
    if (result.error) {
      if (result.error === 'authorization_pending') {
        return null; // Still waiting for user authorization
      } else if (result.error === 'slow_down') {
        // Increase polling interval
        sessionData.interval += 5;
        return null;
      } else if (result.error === 'expired_token') {
        this.deviceSessions.delete(deviceCode);
        throw new Error('Device code expired');
      } else if (result.error === 'access_denied') {
        this.deviceSessions.delete(deviceCode);
        throw new Error('User denied access');
      } else {
        throw new Error(`GitHub device flow error: ${result.error_description || result.error}`);
      }
    }
    
    // Success! Store tokens
    const sessionId = sessionData.sessionId;
    this.storeTokens(sessionId, result);
    
    // Clean up device session
    this.deviceSessions.delete(deviceCode);
    
    // Get user info
    const userInfo = await this.getUserInfo(sessionId);
    
    console.log(`✅ GitHub device flow completed for user: ${userInfo.login}`);
    
    return {
      tokens: result,
      userInfo,
      sessionId
    };
  }

  /**
   * Get user information using stored tokens
   * @param {string} sessionId - Session identifier
   * @returns {Object} User information from GitHub API
   */
  async getUserInfo(sessionId) {
    const tokens = this.getTokens(sessionId);
    if (!tokens) {
      throw new Error('No tokens found for session');
    }
    
    const response = await fetch(this.endpoints.userinfo, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Coding-Agent/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * Revoke stored tokens for a session
   * @param {string} sessionId - Session identifier
   */
  async revokeTokens(sessionId) {
    const tokens = this.getTokens(sessionId);
    if (!tokens) {
      return false;
    }
    
    try {
      // GitHub doesn't have a standard revocation endpoint, 
      // but we can delete the token from our store
      this.tokenStore.delete(sessionId);
      console.log(`🗑️  Revoked GitHub tokens for session: ${sessionId}`);
      return true;
    } catch (error) {
      console.error('Error revoking GitHub tokens:', error);
      return false;
    }
  }

  /**
   * Get all stored sessions
   */
  getSessions() {
    return Array.from(this.tokenStore.keys());
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    let cleaned = 0;
    
    // Clean up expired auth sessions (older than 1 hour)
    for (const [sessionId, data] of this.authSessions.entries()) {
      if (now - data.timestamp > 3600000) {
        this.authSessions.delete(sessionId);
        cleaned++;
      }
    }
    
    // Clean up expired device sessions
    for (const [deviceCode, data] of this.deviceSessions.entries()) {
      if (now - data.timestamp > (data.expiresIn * 1000)) {
        this.deviceSessions.delete(deviceCode);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired OAuth sessions`);
    }
  }

  /**
   * Create a Git credential helper configuration
   * @param {string} sessionId - Session identifier
   * @returns {Object} Git credential configuration
   */
  getGitCredentials(sessionId) {
    const tokens = this.getTokens(sessionId);
    if (!tokens) {
      throw new Error('No tokens found for session');
    }
    
    return {
      username: 'oauth2',
      password: tokens.access_token,
      protocol: 'https',
      host: 'github.com'
    };
  }
}
