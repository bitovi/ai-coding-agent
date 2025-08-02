import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Connection validators for different types of environment dependencies
 */

/**
 * Check if git credentials are available for Claude Code operations
 * @returns {boolean} True if git credentials are configured
 */
export function validateGitCredentials() {
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
 * @param {string} homeDir - Home directory path
 * @returns {boolean} True if .git-credentials file exists
 */
function hasGitCredentialsFile(homeDir) {
  try {
    const gitCredentialsPath = path.join(homeDir, '.git-credentials');
    return fs.existsSync(gitCredentialsPath) && fs.statSync(gitCredentialsPath).isFile();
  } catch (error) {
    return false;
  }
}

/**
 * Check if valid SSH keys exist
 * @param {string} homeDir - Home directory path
 * @returns {boolean} True if SSH keys are available
 */
function hasValidSshKeys(homeDir) {
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
 * @returns {Object} Detailed credential status
 */
export function getGitCredentialDetails() {
  const possibleHomes = [
    process.env.HOME,
    os.homedir(),
    '/home/appuser',
    process.env.GIT_HOME_DIR
  ].filter(Boolean);

  const details = {
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
 * Registry of connection validators
 * Maps connection names to their validator functions
 */
export const connectionValidators = {
  'git-credentials': validateGitCredentials
};

/**
 * Check if a specific connection type is available
 * @param {string} connectionType - Type of connection to validate
 * @returns {boolean} True if the connection is available
 */
export function isConnectionAvailable(connectionType) {
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
 * @returns {Object} Object mapping connection types to their status
 */
export function getAllConnectionStatuses() {
  const statuses = {};
  
  for (const [connectionType, validator] of Object.entries(connectionValidators)) {
    statuses[connectionType] = {
      available: isConnectionAvailable(connectionType),
      type: connectionType
    };
  }
  
  return statuses;
}
