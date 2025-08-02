import fs from 'fs';
import path from 'path';

/**
 * Git credential validation utilities
 */

/**
 * Check if git-mcp-server has valid credentials by looking for actual credential files
 * 
 * @param {Object} server - Server configuration object
 * @returns {boolean} True if git credentials are available
 */
export function validateGitCredentials(server) {
  // Determine the home directory to check for credentials
  const gitHome = getGitHomeDirectory(server);
  
  if (!gitHome) {
    return false;
  }
  
  // Check for .git-credentials file
  if (hasGitCredentialsFile(gitHome)) {
    return true;
  }
  
  // Check for SSH keys
  if (hasValidSshKeys(gitHome)) {
    return true;
  }
  
  return false;
}

/**
 * Get the git home directory from server config or environment
 * 
 * @param {Object} server - Server configuration object
 * @returns {string|null} Git home directory path or null
 */
function getGitHomeDirectory(server) {
  // Priority order for determining git home:
  // 1. Server env.HOME
  // 2. GIT_HOME_DIR environment variable
  // 3. System HOME environment variable
  
  const serverHome = server?.env?.HOME;
  if (serverHome && fs.existsSync(serverHome)) {
    return serverHome;
  }
  
  const gitHomeDir = process.env.GIT_HOME_DIR;
  if (gitHomeDir && fs.existsSync(gitHomeDir)) {
    return gitHomeDir;
  }
  
  const systemHome = process.env.HOME;
  if (systemHome && fs.existsSync(systemHome)) {
    return systemHome;
  }
  
  return null;
}

/**
 * Check if .git-credentials file exists and is readable
 * 
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
 * 
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
 * 
 * @param {Object} server - Server configuration object
 * @returns {Object} Detailed credential status
 */
export function getGitCredentialDetails(server) {
  const gitHome = getGitHomeDirectory(server);
  
  if (!gitHome) {
    return {
      hasCredentials: false,
      gitHome: null,
      hasGitCredentialsFile: false,
      hasSshKeys: false,
      error: 'No valid git home directory found'
    };
  }
  
  const hasGitCreds = hasGitCredentialsFile(gitHome);
  const hasSshKeys = hasValidSshKeys(gitHome);
  
  return {
    hasCredentials: hasGitCreds || hasSshKeys,
    gitHome,
    hasGitCredentialsFile: hasGitCreds,
    hasSshKeys,
    credentialMethod: hasGitCreds ? 'git-credentials' : 
                     hasSshKeys ? 'ssh-keys' : 'none'
  };
}
