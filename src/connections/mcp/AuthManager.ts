import { Issuer, generators, Client, TokenSet } from 'openid-client';
import { Request, Response } from 'express';
import fetch from 'node-fetch';
import { URL } from 'url';
import { EncryptedTokensFolderProvider } from '../../providers/EncryptedTokensFolderProvider.js';

interface MCPServer {
  name: string;
  url?: string;
  authorization_token?: string;
  oauth_provider_configuration?: OAuthProviderConfiguration;
}

interface OAuthProviderConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  client_id: string;
  client_secret?: string;
  client_type?: 'confidential' | 'public';
  scopes_supported?: string[];
}

interface StoredTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  token_endpoint?: string;
  client_id?: string;
  issued_at?: number;
  refreshed_at?: number;
}

interface AuthSession {
  mcpServerName: string;
  client: Client;
  codeVerifier: string;
  timestamp: number;
}

interface AuthorizationSummary {
  [serviceName: string]: {
    authorized: boolean;
    hasRefreshToken: boolean;
    needsRefreshSoon: boolean;
    expiresAt: string | null;
    issuedAt: string | null;
    lastRefreshed: string | null;
  };
}

type TokenStore = EncryptedTokensFolderProvider | Map<string, StoredTokens>;

/**
 * Manages OAuth authorization flows for MCP services
 *
 * Public methods:
 * - isAuthorized
 * - initiateAuthorization
 * - handleOAuthCallback
 * - getTokens - used to decorate a server configuration with the token info on its way to calling 
 *     the ClaudeCodeSDK.
 */
export class AuthManager {
  private tokenStore: TokenStore;
  private authSessions: Map<string, AuthSession>;
  private refreshPromises: Map<string, Promise<boolean>>;
  private defaultRedirectUri: string;

  constructor() {
    // Initialize token storage - use encrypted file storage if configured, otherwise in-memory
    if (process.env.TOKENS_PATH && process.env.TOKENS_ENCRYPTION_KEY) {
      this.tokenStore = new EncryptedTokensFolderProvider(
        process.env.TOKENS_PATH, 
        process.env.TOKENS_ENCRYPTION_KEY
      );
      console.log(`🔐 Using encrypted token storage: ${process.env.TOKENS_PATH}`);
    } else {
      this.tokenStore = new Map<string, StoredTokens>(); // Fallback to in-memory storage
      console.log(`💾 Using in-memory token storage`);
    }
    
    this.authSessions = new Map<string, AuthSession>(); // Maps session ID to auth session data (always in-memory)
    this.refreshPromises = new Map<string, Promise<boolean>>(); // Track ongoing refresh operations to prevent duplicates
    this.defaultRedirectUri = process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/oauth/callback';
  }

  /**
   * Check if a service is authorized (has valid tokens)
   * @param mcpServer - MCP server configuration object (should be from ConfigManager for env var support)
   */
  async isAuthorized(mcpServer: MCPServer): Promise<boolean> {
    if (!mcpServer || !mcpServer.name) {
      throw new Error('mcpServer must be provided with a name property');
    }

    const serviceName = mcpServer.name;

    // Check for authorization_token in MCP server config (includes env vars if from ConfigManager)
    if (mcpServer.authorization_token) {
      return true;
    }

    // Fallback to existing OAuth token logic
    const tokens = this.tokenStore.get(serviceName);
    if (!tokens) return false;
    
    // Check if token is still valid (basic expiration check)
    if (tokens.expires_at && tokens.expires_at < Date.now()) {
      // Token expired, try to refresh if we have a refresh token
      if (tokens.refresh_token) {
        console.log(`🔄 Token for ${serviceName} expired, attempting refresh...`);
        try {
          const refreshed = await this._refreshTokensWithLock(serviceName);
          return refreshed;
        } catch (error: any) {
          console.error(`❌ Token refresh failed for ${serviceName}:`, error.message);
          return false;
        }
      }
      console.log(`⚠️  Token for ${serviceName} expired and no refresh token available`);
      return false;
    }
    
    return true;
  }

  /**
   * Get stored tokens for a service
   * 
   * use to return the MCP server status
   * and to decorate a server configuration with the token info on its way to calling 
   * the ClaudeCodeSDK
   */
  getTokens(serviceName: string): StoredTokens | undefined {
    const tokens = this.tokenStore.get(serviceName);
    console.log(`🔑 [AUTH-MANAGER] getTokens called for service: ${serviceName}`);
    console.log(`🔑 [AUTH-MANAGER] Found tokens: ${tokens ? 'YES' : 'NO'}`);
    
    if (tokens) {
      // Log token availability without exposing sensitive data
      const now = Date.now() / 1000;
      const isExpired = tokens.expires_at ? now > tokens.expires_at : false;
      
      console.log(`🔍 [AUTH-DEBUG] Token status for ${serviceName}:`, {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        tokenType: tokens.token_type,
        scope: tokens.scope,
        isExpired: isExpired,
        expiresIn: tokens.expires_at ? Math.round(tokens.expires_at - now) : null
      });
    }
    
    return tokens;
  }

  /**
   * Initiate OAuth authorization flow for an MCP service
   */
  async initiateAuthorization(mcpServer: MCPServer): Promise<string> {
    // If already has authorization token, no need to authorize
    if (mcpServer.authorization_token) {
      throw new Error('Service already has authorization token');
    }

    // Generate session ID for this authorization flow
    const sessionId = generators.random(16);
    
    let authUrl: string;
    
    if (mcpServer.oauth_provider_configuration) {
      // Use provided OAuth configuration
      authUrl = await this._initiateOAuthWithConfig(mcpServer, sessionId);
    } else {
      // Use MCP URL to discover OAuth endpoints
      authUrl = await this._initiateOAuthWithDiscovery(mcpServer, sessionId);
    }

    return authUrl;
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(req: Request, res: Response): Promise<void> {
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
    const session = this.authSessions.get(state as string);
    if (!session) {
      throw new Error('Invalid or expired authorization session');
    }

    console.log(`🔄 Processing OAuth callback for ${session.mcpServerName}...`);

    try {
      // Exchange code for tokens
      const tokenSet = await this._exchangeCodeForTokens(session, code as string);
      
      // Store tokens
      this._storeTokens(session.mcpServerName, tokenSet);
      
      // Clean up session
      this.authSessions.delete(state as string);
      
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
      
    } catch (error: any) {
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

  // ==================== PRIVATE METHODS ====================

  /**
   * Get valid tokens for a service, automatically refreshing if needed
   * @param mcpServer - MCP server configuration object
   * @private
   */
  private async _getValidTokens(mcpServer: MCPServer): Promise<StoredTokens | null> {
    const isAuth = await this.isAuthorized(mcpServer);
    if (!isAuth) {
      return null;
    }
    return this.tokenStore.get(mcpServer.name) || null;
  }

  /**
   * Check if tokens need refresh soon (within 5 minutes of expiry)
   * @private
   */
  private _needsRefreshSoon(serviceName: string): boolean {
    const tokens = this.tokenStore.get(serviceName);
    if (!tokens || !tokens.expires_at || !tokens.refresh_token) {
      return false;
    }
    
    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
    return tokens.expires_at < fiveMinutesFromNow;
  }

  /**
   * Proactively refresh tokens if they expire soon
   * @private
   */
  private async _refreshIfNeeded(serviceName: string): Promise<boolean> {
    if (this._needsRefreshSoon(serviceName)) {
      console.log(`🔄 Proactively refreshing tokens for ${serviceName} (expire soon)`);
      try {
        await this._refreshTokens(serviceName);
        return true;
      } catch (error: any) {
        console.error(`❌ Proactive refresh failed for ${serviceName}:`, error.message);
        return false;
      }
    }
    return true; // No refresh needed
  }

  /**
   * Store tokens for a service
   * @private
   */
  private _storeTokens(serviceName: string, tokens: StoredTokens): void {
    // Calculate expiration time if expires_in is provided
    if (tokens.expires_in) {
      tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
    }
    
    this.tokenStore.set(serviceName, tokens);
    console.log(`✅ Stored tokens for ${serviceName}`);
  }

  /**
   * Refresh access tokens using a refresh token
   * @private
   */
  private async _refreshTokens(serviceName: string): Promise<boolean> {
    const tokens = this.tokenStore.get(serviceName);
    if (!tokens || !tokens.refresh_token) {
      throw new Error(`No refresh token available for ${serviceName}`);
    }

    // We need to reconstruct the OAuth client configuration for refresh
    // This is tricky because we don't store the original OAuth config
    // We'll need to discover the token endpoint again
    
    let tokenEndpoint: string;
    let clientId: string;
    
    // Try to get token endpoint from stored metadata or rediscover it
    if (tokens.token_endpoint) {
      tokenEndpoint = tokens.token_endpoint;
    } else {
      // We need to rediscover the token endpoint
      // This requires storing more metadata during initial authorization
      throw new Error(`Token endpoint not available for ${serviceName}. Cannot refresh without stored OAuth metadata.`);
    }
    
    if (tokens.client_id) {
      clientId = tokens.client_id;
    } else {
      throw new Error(`Client ID not available for ${serviceName}. Cannot refresh without stored OAuth metadata.`);
    }

    console.log(`🔄 Refreshing tokens for ${serviceName}...`);

    try {
      const refreshResponse = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
          client_id: clientId
        })
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        throw new Error(`Token refresh failed: ${refreshResponse.status} ${refreshResponse.statusText} - ${errorText}`);
      }

      const newTokens = await refreshResponse.json() as Partial<StoredTokens>;
      
      // Preserve metadata from original tokens and merge with new tokens
      const updatedTokens: StoredTokens = {
        ...tokens, // Keep original metadata like token_endpoint, client_id
        ...newTokens, // Override with new token data
        refreshed_at: Date.now() // Track when refresh occurred
      };
      
      // If no new refresh token provided, keep the old one
      if (!newTokens.refresh_token && tokens.refresh_token) {
        updatedTokens.refresh_token = tokens.refresh_token;
      }
      
      // Store the updated tokens
      this._storeTokens(serviceName, updatedTokens);
      
      console.log(`✅ Successfully refreshed tokens for ${serviceName}`, {
        hasNewAccessToken: !!newTokens.access_token,
        hasNewRefreshToken: !!newTokens.refresh_token,
        expiresIn: newTokens.expires_in
      });
      
      return true;
      
    } catch (error: any) {
      console.error(`❌ Token refresh failed for ${serviceName}:`, error.message);
      
      // If refresh failed, the refresh token might be invalid/expired
      // Remove the tokens so user can re-authorize
      console.log(`🗑️  Removing invalid tokens for ${serviceName}`);
      this.tokenStore.delete(serviceName);
      
      throw error;
    }
  }

  /**
   * Refresh tokens with lock to prevent concurrent refresh attempts
   * @param serviceName - Name of the service
   * @returns True if refresh succeeded
   * @private
   */
  private async _refreshTokensWithLock(serviceName: string): Promise<boolean> {
    // Check if there's already a refresh in progress for this service
    if (this.refreshPromises.has(serviceName)) {
      console.log(`⏳ Token refresh already in progress for ${serviceName}, waiting...`);
      try {
        // Wait for the existing refresh to complete
        const result = await this.refreshPromises.get(serviceName)!;
        console.log(`✅ Waited for existing refresh for ${serviceName}, result: ${result}`);
        return result;
      } catch (error: any) {
        console.error(`❌ Existing refresh failed for ${serviceName}:`, error.message);
        return false;
      }
    }

    // Start a new refresh operation
    const refreshPromise = this._refreshTokens(serviceName)
      .then(() => {
        // Clean up the promise after successful refresh
        this.refreshPromises.delete(serviceName);
        return true;
      })
      .catch((error: any) => {
        // Clean up the promise after failed refresh
        this.refreshPromises.delete(serviceName);
        throw error;
      });

    // Store the promise so other concurrent requests can wait for it
    this.refreshPromises.set(serviceName, refreshPromise);

    try {
      return await refreshPromise;
    } catch (error) {
      return false;
    }
  }

  /**
   * Initiate OAuth with explicit configuration
   * @private
   */
  private async _initiateOAuthWithConfig(mcpServer: MCPServer, sessionId: string): Promise<string> {
    const config = mcpServer.oauth_provider_configuration!;
    
    // Create issuer from configuration
    const issuer = new Issuer({
      issuer: config.issuer,
      authorization_endpoint: config.authorization_endpoint,
      token_endpoint: config.token_endpoint,
      userinfo_endpoint: config.userinfo_endpoint,
      jwks_uri: config.jwks_uri
    });

    // Create client
    let clientConfig: any = {
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
   * @private
   */
  private async _initiateOAuthWithDiscovery(mcpServer: MCPServer, sessionId: string): Promise<string> {
    const discoveryUrl = await this._getAuthorizationServerDiscoveryUrl(mcpServer.url!);
    
    // Discover the OAuth issuer
    const issuer = await Issuer.discover(discoveryUrl);
    
    // Dynamic client registration
    const client = await (issuer.Client as any).register({
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
   * @private
   */
  private async _getAuthorizationServerDiscoveryUrl(mcpUrl: string): Promise<string> {
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
    } catch (error: any) {
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
   * Exchange authorization code for access tokens
   * @private
   */
  private async _exchangeCodeForTokens(session: AuthSession, code: string): Promise<StoredTokens> {
    const { client, codeVerifier } = session;
    
    try {
      // Manual token exchange for pure OAuth 2.0 (following get-pkce-token.js approach)
      console.log('🔄 Performing manual token exchange...');
      
      const tokenResponse = await fetch(client.issuer.token_endpoint as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.defaultRedirectUri,
          client_id: client.client_id as string,
          code_verifier: codeVerifier
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${tokenResponse.status} ${tokenResponse.statusText} - ${errorText}`);
      }

      const tokenSet = await tokenResponse.json() as any;
      
      console.log('✅ Received token set:', {
        hasAccessToken: !!tokenSet.access_token,
        hasRefreshToken: !!tokenSet.refresh_token,
        hasIdToken: !!tokenSet.id_token,
        tokenType: tokenSet.token_type,
        expiresIn: tokenSet.expires_in,
        scope: tokenSet.scope
      });
      
      // Add OAuth metadata needed for token refresh
      const enhancedTokenSet: StoredTokens = {
        access_token: tokenSet.access_token,
        refresh_token: tokenSet.refresh_token,
        expires_in: tokenSet.expires_in,
        token_type: tokenSet.token_type,
        scope: tokenSet.scope,
        id_token: tokenSet.id_token,
        // Store OAuth client metadata for future refresh operations
        token_endpoint: client.issuer.token_endpoint as string,
        client_id: client.client_id as string,
        // Track when tokens were originally obtained
        issued_at: Date.now()
      };
      
      // Return the enhanced token set with refresh metadata
      return enhancedTokenSet;
      
    } catch (error: any) {
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
   * @private
   */
  private _cleanupExpiredSessions(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    
    for (const [sessionId, session] of this.authSessions.entries()) {
      if (now - session.timestamp > maxAge) {
        this.authSessions.delete(sessionId);
      }
    }
  }

  /**
   * Clean up expired tokens that cannot be refreshed
   * @private
   */
  private _cleanupExpiredTokens(): void {
    const now = Date.now();
    const servicesToRemove: string[] = [];
    
    if (this.tokenStore instanceof Map) {
      // Handle Map-based token store
      for (const [serviceName, tokens] of this.tokenStore.entries()) {
        // If token is expired and we don't have a refresh token, remove it
        if (tokens.expires_at && tokens.expires_at < now && !tokens.refresh_token) {
          servicesToRemove.push(serviceName);
        }
      }
    } else {
      // Handle EncryptedTokensFolderProvider
      const serviceNames = this.tokenStore.getServiceNames();
      for (const serviceName of serviceNames) {
        const tokens = this.tokenStore.get(serviceName);
        if (tokens && tokens.expires_at && tokens.expires_at < now && !tokens.refresh_token) {
          servicesToRemove.push(serviceName);
        }
      }
    }
    
    for (const serviceName of servicesToRemove) {
      console.log(`🗑️  Removing expired tokens for ${serviceName} (no refresh token)`);
      this.tokenStore.delete(serviceName);
    }
  }

  /**
   * Check if a service has valid OAuth tokens (internal method for stored tokens only)
   * @param serviceName - Name of the service
   * @private
   */
  private async _isOAuthAuthorized(serviceName: string): Promise<boolean> {
    const tokens = this.tokenStore.get(serviceName);
    if (!tokens) return false;
    
    // Check if token is still valid (basic expiration check)
    if (tokens.expires_at && tokens.expires_at < Date.now()) {
      // Token expired, try to refresh if we have a refresh token
      if (tokens.refresh_token) {
        console.log(`🔄 Token for ${serviceName} expired, attempting refresh...`);
        try {
          const refreshed = await this._refreshTokensWithLock(serviceName);
          return refreshed;
        } catch (error: any) {
          console.error(`❌ Token refresh failed for ${serviceName}:`, error.message);
          return false;
        }
      }
      console.log(`⚠️  Token for ${serviceName} expired and no refresh token available`);
      return false;
    }
    
    return true;
  }

  /**
   * Get authorization status summary for all services
   * @private
   */
  private async _getAuthorizationSummary(): Promise<AuthorizationSummary> {
    const summary: AuthorizationSummary = {};
    
    if (this.tokenStore instanceof Map) {
      // Handle Map-based token store
      for (const [serviceName, tokens] of this.tokenStore.entries()) {
        const isAuth = await this._isOAuthAuthorized(serviceName);
        const needsRefresh = this._needsRefreshSoon(serviceName);
        
        summary[serviceName] = {
          authorized: isAuth,
          hasRefreshToken: !!tokens.refresh_token,
          needsRefreshSoon: needsRefresh,
          expiresAt: tokens.expires_at ? new Date(tokens.expires_at).toISOString() : null,
          issuedAt: tokens.issued_at ? new Date(tokens.issued_at).toISOString() : null,
          lastRefreshed: tokens.refreshed_at ? new Date(tokens.refreshed_at).toISOString() : null
        };
      }
    } else {
      // Handle EncryptedTokensFolderProvider
      const serviceNames = this.tokenStore.getServiceNames();
      for (const serviceName of serviceNames) {
        const tokens = this.tokenStore.get(serviceName);
        if (tokens) {
          const isAuth = await this._isOAuthAuthorized(serviceName);
          const needsRefresh = this._needsRefreshSoon(serviceName);
          
          summary[serviceName] = {
            authorized: isAuth,
            hasRefreshToken: !!tokens.refresh_token,
            needsRefreshSoon: needsRefresh,
            expiresAt: tokens.expires_at ? new Date(tokens.expires_at).toISOString() : null,
            issuedAt: tokens.issued_at ? new Date(tokens.issued_at).toISOString() : null,
            lastRefreshed: tokens.refreshed_at ? new Date(tokens.refreshed_at).toISOString() : null
          };
        }
      }
    }
    
    return summary;
  }
}
