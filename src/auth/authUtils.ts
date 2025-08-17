/**
 * Utility functions for authentication checking
 */

export interface Server {
  name: string;
  type?: string;
  authorization_token?: string;
  authorization?: {
    session_id?: string;
  };
  repository?: {
    url?: string;
  };
}

export interface AuthManager {
  isAuthorized(server: Server): Promise<boolean>;
}

export interface AuthorizationDetails {
  serverName: string;
  isAuthorized: boolean;
  authMethod: 'environment' | 'config' | 'oauth' | 'none';
  hasConfigToken: boolean;
  hasEnvToken: boolean;
  hasOAuthToken: boolean;
  envTokenKey: string;
}

/**
 * Get authorization status details for debugging/logging
 */
export async function getAuthorizationDetails(server: Server, authManager: AuthManager): Promise<AuthorizationDetails> {
  const hasConfigToken = Boolean(server && server.authorization_token);
  const hasOAuthToken = await authManager.isAuthorized(server);
  
  // Check if the config token came from environment variable
  const envTokenKey = `MCP_${server.name}_authorization_token`;
  const hasEnvToken = Boolean(process.env[envTokenKey]);
  const isEnvToken = hasConfigToken && hasEnvToken && server.authorization_token === process.env[envTokenKey];
  
  const authMethod = hasConfigToken ? (isEnvToken ? 'environment' : 'config') : 
                    hasOAuthToken ? 'oauth' : 'none';
  
  return {
    serverName: server.name,
    isAuthorized: await authManager.isAuthorized(server),
    authMethod,
    hasConfigToken,
    hasEnvToken: isEnvToken,
    hasOAuthToken,
    envTokenKey
  };
}
