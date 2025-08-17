import { hasGitCredentials } from '../connections/special/git-credentials.js';

/**
 * Utility functions for authentication checking
 */

export interface GitHubAuthIntegration {
  isGitHubAuthorized(sessionId: string): boolean;
}

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
  authMethod: 'environment' | 'config' | 'oauth' | 'custom' | 'none';
  hasConfigToken: boolean;
  hasEnvToken: boolean;
  hasOAuthToken: boolean;
  hasCustomCredentials: boolean;
  envTokenKey: string;
}

type CredentialValidator = (server: Server) => boolean;

// Global GitHub auth integration instance (set by main application)
let githubAuthIntegration: GitHubAuthIntegration | null = null;

/**
 * Set the GitHub auth integration instance
 */
export function setGitHubAuthIntegration(integration: GitHubAuthIntegration): void {
  githubAuthIntegration = integration;
}

/**
 * Validate GitHub repository authorization
 */
function validateGitHubCredentials(server: Server): boolean {
  if (!githubAuthIntegration) {
    return false;
  }
  
  // Check if this is a GitHub repository server
  if (server.type === 'github-repo' || server.repository?.url?.includes('github.com')) {
    const sessionId = server.authorization?.session_id;
    if (sessionId) {
      return githubAuthIntegration.isGitHubAuthorized(sessionId);
    }
  }
  
  return false;
}

/**
 * Check if an MCP server is authorized using priority order:
 * 1. Pre-configured authorization_token in config (includes env vars if from ConfigManager)
 * 2. OAuth tokens from AuthManager
 * 3. Custom credential validation (server-specific)
 */
export async function isServerAuthorized(server: Server, authManager: AuthManager): Promise<boolean> {
  const hasConfigToken = Boolean(server && server.authorization_token);
  const hasOAuthToken = await authManager.isAuthorized(server);
  
  // Check standard auth methods first
  if (hasConfigToken || hasOAuthToken) {
    return true;
  }
  
  // Check server-specific credential validation
  const hasCustomCredentials = checkCustomCredentials(server);
  
  return hasCustomCredentials;
}

/**
 * Check for server-specific credentials using registered validators
 */
function checkCustomCredentials(server: Server): boolean {
  const validator = credentialValidators[server.name];
  if (validator && typeof validator === 'function') {
    try {
      return validator(server);
    } catch (error) {
      console.warn(`Error checking credentials for ${server.name}:`, error);
      return false;
    }
  }
  return false;
}

/**
 * Registry of server-specific credential validators
 * Each validator function takes the server config and returns boolean
 */
const credentialValidators: Record<string, CredentialValidator> = {
  'git-mcp-server': hasGitCredentials,
  'github-repo': validateGitHubCredentials,
  'github': validateGitHubCredentials
};

/**
 * Get authorization status details for debugging/logging
 */
export async function getAuthorizationDetails(server: Server, authManager: AuthManager): Promise<AuthorizationDetails> {
  const hasConfigToken = Boolean(server && server.authorization_token);
  const hasOAuthToken = await authManager.isAuthorized(server);
  const hasCustomCredentials = checkCustomCredentials(server);
  
  // Check if the config token came from environment variable
  const envTokenKey = `MCP_${server.name}_authorization_token`;
  const hasEnvToken = Boolean(process.env[envTokenKey]);
  const isEnvToken = hasConfigToken && hasEnvToken && server.authorization_token === process.env[envTokenKey];
  
  const authMethod = hasConfigToken ? (isEnvToken ? 'environment' : 'config') : 
                    hasOAuthToken ? 'oauth' : 
                    hasCustomCredentials ? 'custom' : 'none';
  
  return {
    serverName: server.name,
    isAuthorized: hasConfigToken || hasOAuthToken || hasCustomCredentials,
    authMethod,
    hasConfigToken,
    hasEnvToken: isEnvToken,
    hasOAuthToken,
    hasCustomCredentials,
    envTokenKey
  };
}
