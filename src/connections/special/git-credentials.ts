import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Git credential management module
 * Handles checking, validating, and setting up git credentials
 */

/**
 * Detailed credential status interface
 */
export interface CredentialDetails {
  hasCredentials: boolean;
  hasGitToken: boolean;
  credentialSources: string[];
  checkedPaths: string[];
  error?: string;
}

/**
 * Setup configuration for git credentials
 */
export interface SetupConfig {
  token?: string;
}

/**
 * Check if git credentials are available (generic interface)
 * @returns True if git credentials are configured
 */
export function isAuthorized(): boolean {
  return hasGitCredentials();
}

/**
 * Get detailed credential status (generic interface)
 * @returns Detailed credential status
 */
export function getDetails(): CredentialDetails {
  return getGitCredentialDetails();
}

/**
 * Set up git credentials (generic interface)
 * @param config - Setup configuration
 * @returns True if setup was successful
 */
export async function setup(config: SetupConfig): Promise<boolean> {
  if (!config.token) {
    throw new Error('Token is required for git credentials');
  }
  return await setupGitCredentials(config.token);
}

/**
 * Set up git credentials with a token
 * @param token - Git token to configure
 * @returns True if setup was successful
 */
async function setupGitCredentials(token: string): Promise<boolean> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // Validate token format first
    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
      console.error('Invalid GitHub token format');
      return false;
    }
    
    // Determine the appropriate home directory
    const homeDir = process.env.HOME || os.homedir() || '/home/appuser';
    
    // Create .git-credentials file
    const gitCredentialsPath = path.join(homeDir, '.git-credentials');
    const username = process.env.GIT_USERNAME || 'token';
    const credentialsContent = `https://${username}:${token}@github.com\n`;
    
    // Write the credentials file with proper permissions
    await fs.promises.writeFile(gitCredentialsPath, credentialsContent, { mode: 0o600 });
    
    // Configure git to use the credential store
    await execAsync('git config --global credential.helper store');
    
    console.log(`✅ Git credentials configured at: ${gitCredentialsPath}`);
    console.log(`✅ Git credential helper configured to use store`);
    return true;
  } catch (error) {
    console.error('Failed to setup git credentials:', error);
    return false;
  }
}

/**
 * Check if git credentials are available for Claude Code operations
 * @returns True if git credentials are configured
 * @internal Used internally by isAuthorized function
 */
function hasGitCredentials(): boolean {
  // For Claude Code SDK git operations - check system-wide
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
 * @internal Used internally by getDetails function
 */
function getGitCredentialDetails(): CredentialDetails {
  // System-wide validation for Claude Code SDK
  const possibleHomes = [
    process.env.HOME,
    os.homedir(),
    '/home/appuser',
    process.env.GIT_HOME_DIR
  ].filter(Boolean);

  const details: CredentialDetails = {
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
