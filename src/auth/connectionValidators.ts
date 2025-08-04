import fs from 'fs';
import path from 'path';
import os from 'os';

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
  // Check multiple possible locations for git credentials
  const possibleHomes = [
    process.env.HOME,
    os.homedir(),
    '/home/appuser', // Docker container path
    process.env.GIT_HOME_DIR
  ].filter(Boolean);

  for (const homeDir of possibleHomes) {
    if (hasGitCredentialsFile(homeDir) || hasValidSshKeys(homeDir)) {
      return true;
    }
  }

  // Also check if GIT_TOKEN environment variable is available
  return !!process.env.GIT_TOKEN;
}

/**
 * Check if .git-credentials file exists and is readable
 * @param homeDir - Home directory path
 * @returns True if .git-credentials file exists
 */
function hasGitCredentialsFile(homeDir: string): boolean {
  try {
    const gitCredentialsPath = path.join(homeDir, '.git-credentials');
    return fs.existsSync(gitCredentialsPath) && fs.statSync(gitCredentialsPath).isFile();
  } catch (error) {
    return false;
  }
}

/**
 * Check if valid SSH keys exist
 * @param homeDir - Home directory path
 * @returns True if SSH keys are available
 */
function hasValidSshKeys(homeDir: string): boolean {
  try {
    const sshDir = path.join(homeDir, '.ssh');
    
    if (!fs.existsSync(sshDir)) {
      return false;
    }
    
    // Common SSH key file names
    const sshKeyFiles = ['id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'];
    
    for (const keyFile of sshKeyFiles) {
      const keyPath = path.join(sshDir, keyFile);
      if (fs.existsSync(keyPath) && fs.statSync(keyPath).isFile()) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Get detailed git credential status for debugging
 * @returns Detailed credential status
 */
export function getGitCredentialDetails(): GitCredentialDetails {
  const possibleHomes = [
    process.env.HOME,
    os.homedir(),
    '/home/appuser',
    process.env.GIT_HOME_DIR
  ].filter(Boolean);

  const details: GitCredentialDetails = {
    hasCredentials: false,
    hasGitToken: !!process.env.GIT_TOKEN,
    credentialSources: [],
    checkedPaths: []
  };

  for (const homeDir of possibleHomes) {
    details.checkedPaths.push(homeDir);
    
    if (hasGitCredentialsFile(homeDir)) {
      details.hasCredentials = true;
      details.credentialSources.push(`git-credentials in ${homeDir}`);
    }
    
    if (hasValidSshKeys(homeDir)) {
      details.hasCredentials = true;
      details.credentialSources.push(`SSH keys in ${homeDir}`);
    }
  }

  if (details.hasGitToken) {
    details.hasCredentials = true;
    details.credentialSources.push('GIT_TOKEN environment variable');
  }

  return details;
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
