import { 
  hasGitCredentials as hasGitCredentialsCore,
  getGitCredentialDetails as getGitCredentialDetailsCore 
} from '../connections/special/git-credentials.js';

/**
 * Connection validators for different types of environment dependencies
 */

/**
 * Detailed credential status interface
 */
export interface GitCredentialDetails {
  hasCredentials: boolean;
  hasGitToken: boolean;
  credentialSources: string[];
  checkedPaths: string[];
  error?: string;
}

/**
 * Connection status interface
 */
export interface ConnectionStatus {
  available: boolean;
  type: string;
  details?: any;
}

/**
 * Check if git credentials are available for Claude Code operations
 * @returns True if git credentials are configured
 */
export function validateGitCredentials(): boolean {
  return hasGitCredentialsCore();
}

/**
 * Get detailed git credential status for debugging
 * @returns Detailed credential status
 */
export function getGitCredentialDetails(): GitCredentialDetails {
  return getGitCredentialDetailsCore();
}

/**
 * Validate Docker registry credentials
 * @returns True if docker credentials are available
 */
export function validateDockerCredentials(): boolean {
  return !!(process.env.DOCKER_USERNAME && process.env.DOCKER_PASSWORD);
}

/**
 * Registry of connection validators
 * Maps connection names to their validator functions
 */
export const connectionValidators: Record<string, () => boolean> = {
  'git-credentials': validateGitCredentials,
  'docker-registry': validateDockerCredentials
};

/**
 * Check if a specific connection type is available
 * @param connectionType - Type of connection to validate
 * @returns True if the connection is available
 */
export function isConnectionAvailable(connectionType: string): boolean {
  const validator = connectionValidators[connectionType];
  if (validator && typeof validator === 'function') {
    try {
      return validator();
    } catch (error) {
      console.warn(`Error checking connection ${connectionType}:`, error);
      return false;
    }
  }
  return false;
}

/**
 * Get connection status details for all registered connection types
 * @returns Object mapping connection types to their status
 */
export function getAllConnectionStatuses(): Record<string, ConnectionStatus> {
  const statuses: Record<string, ConnectionStatus> = {};
  
  for (const [connectionType, validator] of Object.entries(connectionValidators)) {
    statuses[connectionType] = {
      available: isConnectionAvailable(connectionType),
      type: connectionType
    };
  }
  
  return statuses;
}
