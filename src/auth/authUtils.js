import { hasGitCredentials } from '../connections/special/git-credentials.js';

/**
 * Utility functions for authentication checking
 */

// Global GitHub auth integration instance (set by main application)
let githubAuthIntegration = null;

/**
 * Set the GitHub auth integration instance
 * @param {GitHubAuthIntegration} integration - The GitHub auth integration instance
 */
export function setGitHubAuthIntegration(integration) {
  githubAuthIntegration = integration;
}

/**
 * Validate GitHub repository authorization
 * @param {Object} server - Server configuration object
 * @returns {boolean} True if GitHub repo is authorized
 */
function validateGitHubCredentials(server) {
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
 * 
 * @param {string} serverName - Name of the MCP server
 * @param {Object} server - Server configuration object (should be from ConfigManager for env var support)
 * @param {Object} authManager - AuthManager instance
 * @returns {Promise<boolean>} True if the server is authorized
 */
export async function isServerAuthorized(serverName, server, authManager) {
  const hasConfigToken = server && server.authorization_token;
  const hasOAuthToken = await authManager.isAuthorized(server);
  
  // Check standard auth methods first
  if (hasConfigToken || hasOAuthToken) {
    return true;
  }
  
  // Check server-specific credential validation
  const hasCustomCredentials = checkCustomCredentials(serverName, server);
  
  return hasCustomCredentials;
}

/**
 * Check for server-specific credentials using registered validators
 * 
 * @param {string} serverName - Name of the MCP server
 * @param {Object} server - Server configuration object
 * @returns {boolean} True if custom credentials are available
 */
function checkCustomCredentials(serverName, server) {
  const validator = credentialValidators[serverName];
  if (validator && typeof validator === 'function') {
    try {
      return validator(server);
    } catch (error) {
      console.warn(`Error checking credentials for ${serverName}:`, error);
      return false;
    }
  }
  return false;
}

/**
 * Registry of server-specific credential validators
 * Each validator function takes the server config and returns boolean
 */
const credentialValidators = {
  'git-mcp-server': hasGitCredentials,
  'github-repo': validateGitHubCredentials,
  'github': validateGitHubCredentials
};

/**
 * Get authorization status details for debugging/logging
 * 
 * @param {string} serverName - Name of the MCP server
 * @param {Object} server - Server configuration object (should be from ConfigManager for env var support)
 * @param {Object} authManager - AuthManager instance
 * @returns {Promise<Object>} Object with detailed authorization status
 */
export async function getAuthorizationDetails(serverName, server, authManager) {
  const hasConfigToken = server && server.authorization_token;
  const hasOAuthToken = await authManager.isAuthorized(server);
  const hasCustomCredentials = checkCustomCredentials(serverName, server);
  
  // Check if the config token came from environment variable
  const envTokenKey = `MCP_${serverName}_authorization_token`;
  const hasEnvToken = process.env[envTokenKey];
  const isEnvToken = hasConfigToken && hasEnvToken && server.authorization_token === hasEnvToken;
  
  const authMethod = hasConfigToken ? (isEnvToken ? 'environment' : 'config') : 
                    hasOAuthToken ? 'oauth' : 
                    hasCustomCredentials ? 'custom' : 'none';
  
  return {
    serverName,
    isAuthorized: hasConfigToken || hasOAuthToken || hasCustomCredentials,
    authMethod,
    hasConfigToken,
    hasEnvToken: isEnvToken,
    hasOAuthToken,
    hasCustomCredentials,
    envTokenKey
  };
}


