import { Issuer, generators } from 'openid-client';
import express from 'express';
import open from 'open';
import fetch from 'node-fetch';
import { URL } from 'url';

/**
 * Manages OAuth authorization flows for MCP services
 */
export class AuthManager {
  constructor() {
    this.tokenStore = new Map(); // Maps service name to token data
    this.authSessions = new Map(); // Maps session ID to auth session data
    this.defaultRedirectUri = process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/oauth/callback';
  }

  /**
   * Check if a service is authorized (has valid tokens)
   */
  isAuthorized(serviceName) {
    const tokens = this.tokenStore.get(serviceName);
    if (!tokens) return false;
    
    // Check if token is still valid (basic expiration check)
    if (tokens.expires_at && tokens.expires_at < Date.now()) {
      // Token expired, try to refresh if we have a refresh token
      if (tokens.refresh_token) {
        // TODO: Implement token refresh
        console.log(`⚠️  Token for ${serviceName} expired, refresh needed`);
      }
      return false;
    }
    
    return true;
  }

  /**
   * Get stored tokens for a service
   */
  getTokens(serviceName) {
    return this.tokenStore.get(serviceName);
  }

  /**
   * Store tokens for a service
   */
  storeTokens(serviceName, tokens) {
    // Calculate expiration time if expires_in is provided
    if (tokens.expires_in) {
      tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
    }
    
    this.tokenStore.set(serviceName, tokens);
    console.log(`✅ Stored tokens for ${serviceName}`);
  }

  /**
   * Initiate OAuth authorization flow for an MCP service
   */
  async initiateAuthorization(mcpServer) {
    // If already has authorization token, no need to authorize
    if (mcpServer.authorization_token) {
      throw new Error('Service already has authorization token');
    }

    // Generate session ID for this authorization flow
    const sessionId = generators.random(16);
    
    let authUrl;
    
    if (mcpServer.oauth_provider_configuration) {
      // Use provided OAuth configuration
      authUrl = await this.initiateOAuthWithConfig(mcpServer, sessionId);
    } else {
      // Use MCP URL to discover OAuth endpoints
      authUrl = await this.initiateOAuthWithDiscovery(mcpServer, sessionId);
    }

    return authUrl;
  }

  /**
   * Initiate OAuth with explicit configuration
   */
  async initiateOAuthWithConfig(mcpServer, sessionId) {
    const config = mcpServer.oauth_provider_configuration;
    
    // Create issuer from configuration
    const issuer = new Issuer({
      issuer: config.issuer,
      authorization_endpoint: config.authorization_endpoint,
      token_endpoint: config.token_endpoint,
      userinfo_endpoint: config.userinfo_endpoint,
      jwks_uri: config.jwks_uri
    });

    // Create client
    let clientConfig = {
      client_id: config.client_id,
      redirect_uris: [this.defaultRedirectUri],
      response_types: ['code']
    };

    if (config.client_type === 'confidential' && config.client_secret) {
      clientConfig.client_secret = config.client_secret;
      clientConfig.token_endpoint_auth_method = 'client_secret_post';
    } else {
      clientConfig.token_endpoint_auth_method = 'none';
    }

    const client = new issuer.Client(clientConfig);

    // Generate PKCE parameters if supported
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    // Store session data
    this.authSessions.set(sessionId, {
      mcpServerName: mcpServer.name,
      client,
      codeVerifier,
      timestamp: Date.now()
    });

    // Generate authorization URL
    const authUrl = client.authorizationUrl({
      scope: config.scopes_supported?.join(' ') || 'read',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      redirect_uri: this.defaultRedirectUri,
      state: sessionId
    });

    return authUrl;
  }

  /**
   * Initiate OAuth with endpoint discovery (similar to get-pkce-token.js)
   */
  async initiateOAuthWithDiscovery(mcpServer, sessionId) {
    const discoveryUrl = await this.getAuthorizationServerDiscoveryUrl(mcpServer.url);
    
    // Discover the OAuth issuer
    const issuer = await Issuer.discover(discoveryUrl);
    
    // Dynamic client registration
    const client = await issuer.Client.register({
      client_name: 'AI Coding Agent MCP Client',
      redirect_uris: [this.defaultRedirectUri],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none' // public client
    });

    // Generate PKCE parameters
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    // Store session data
    this.authSessions.set(sessionId, {
      mcpServerName: mcpServer.name,
      client,
      codeVerifier,
      timestamp: Date.now()
    });

    // Generate authorization URL
    const authUrl = client.authorizationUrl({
      scope: 'read:jira-work', // Match the working example scope
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      redirect_uri: this.defaultRedirectUri,
      state: sessionId
    });

    return authUrl;
  }

  /**
   * Get OAuth authorization server discovery URL from MCP endpoint
   */
  async getAuthorizationServerDiscoveryUrl(mcpUrl) {
    // First, try to get the metadata URL from WWW-Authenticate header (RFC9728)
    try {
      const res = await fetch(mcpUrl, { method: 'GET' });
      const wwwAuth = res.headers.get('www-authenticate');
      
      if (wwwAuth) {
        const resourceMatch = wwwAuth.match(/resource="([^"]+)"/);
        if (resourceMatch) {
          console.log('✅ Found resource metadata URL in WWW-Authenticate header');
          return resourceMatch[1];
        }
      }
    } catch (error) {
      console.log('⚠️  Could not get resource metadata from WWW-Authenticate header:', error.message);
    }
    
    // Fallback: Try the standard OAuth Authorization Server Metadata endpoint
    const mcpUrlObj = new URL(mcpUrl);
    const authServerMetadataUrl = `${mcpUrlObj.protocol}//${mcpUrlObj.host}/.well-known/oauth-authorization-server`;
    
    try {
      const res = await fetch(authServerMetadataUrl);
      if (res.ok) {
        console.log('✅ Found OAuth Authorization Server Metadata endpoint');
        return authServerMetadataUrl;
      }
    } catch (error) {
      // Continue to other fallbacks
    }
    
    // Additional fallback: Try OpenID Connect Discovery
    const oidcDiscoveryUrl = `${mcpUrlObj.protocol}//${mcpUrlObj.host}/.well-known/openid-configuration`;
    
    try {
      const res = await fetch(oidcDiscoveryUrl);
      if (res.ok) {
        console.log('✅ Found OpenID Connect Discovery endpoint');
        return oidcDiscoveryUrl;
      }
    } catch (error) {
      // Continue
    }
    
    throw new Error('Could not find OAuth Authorization Server Metadata or OpenID Connect Discovery endpoint');
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(req, res) {
    const { code, state, error, error_description } = req.query;
    
    if (error) {
      const errorMsg = error_description || error;
      console.error('❌ OAuth authorization error:', errorMsg);
      throw new Error(`OAuth error: ${errorMsg}`);
    }
    
    if (!code || !state) {
      throw new Error('Missing authorization code or state parameter');
    }

    // Retrieve session data
    const session = this.authSessions.get(state);
    if (!session) {
      throw new Error('Invalid or expired authorization session');
    }

    console.log(`🔄 Processing OAuth callback for ${session.mcpServerName}...`);

    try {
      // Exchange code for tokens
      const tokenSet = await this.exchangeCodeForTokens(session, code);
      
      // Store tokens
      this.storeTokens(session.mcpServerName, tokenSet);
      
      // Clean up session
      this.authSessions.delete(state);
      
      console.log(`✅ OAuth authorization completed for ${session.mcpServerName}`);
      
      // Send success response
      res.send(`
        <html>
          <head><title>Authorization Successful</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: green;">🎉 Authorization Successful!</h1>
            <p>Successfully authorized <strong>${session.mcpServerName}</strong></p>
            <p>You may close this tab and return to your application.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
        </html>
      `);
      
    } catch (error) {
      console.error('❌ Token exchange failed:', error);
      res.status(500).send(`
        <html>
          <head><title>Authorization Failed</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: red;">❌ Authorization Failed</h1>
            <p>Failed to authorize <strong>${session.mcpServerName}</strong></p>
            <p>Please try again.</p>
            <details style="margin-top: 20px; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
              <summary>Error Details</summary>
              <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">${error.message}</pre>
            </details>
            <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer;">Close Window</button>
          </body>
        </html>
      `);
    }
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(session, code) {
    const { client, codeVerifier } = session;
    
    try {
      // Manual token exchange for pure OAuth 2.0 (following get-pkce-token.js approach)
      console.log('🔄 Performing manual token exchange...');
      
      const tokenResponse = await fetch(client.issuer.token_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.defaultRedirectUri,
          client_id: client.client_id,
          code_verifier: codeVerifier
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${tokenResponse.status} ${tokenResponse.statusText} - ${errorText}`);
      }

      const tokenSet = await tokenResponse.json();
      
      console.log('✅ Received token set:', {
        hasAccessToken: !!tokenSet.access_token,
        hasRefreshToken: !!tokenSet.refresh_token,
        hasIdToken: !!tokenSet.id_token,
        tokenType: tokenSet.token_type,
        expiresIn: tokenSet.expires_in,
        scope: tokenSet.scope
      });
      
      // Return the complete token set as received from the OAuth provider
      return tokenSet;
      
    } catch (error) {
      console.error('❌ Token exchange error details:', {
        error: error.message,
        stack: error.stack,
        tokenEndpoint: client.issuer.token_endpoint
      });
      throw error;
    }
  }

  /**
   * Clean up expired sessions periodically
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    
    for (const [sessionId, session] of this.authSessions.entries()) {
      if (now - session.timestamp > maxAge) {
        this.authSessions.delete(sessionId);
      }
    }
  }
}
