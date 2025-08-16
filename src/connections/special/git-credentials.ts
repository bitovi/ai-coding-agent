import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Local Git credential validation utilities
 * Handles checking for git credentials on the local system
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
 * Check if git credentials are available for Claude Code operations
 * @param server - Optional server configuration for server-specific validation
 * @returns True if git credentials are configured
 */
export function hasGitCredentials(server?: any): boolean {
  // For server-specific validation
  if (server) {
    const gitHome = getGitHomeDirectory(server);
    if (!gitHome) {
      return false;
    }
    
    // Check for .git-credentials file or SSH keys
    return hasGitCredentialsFile(gitHome) || hasValidSshKeys(gitHome);
  }

  // For system-wide validation (Claude Code operations)
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
 * Get the git home directory from server config or environment
 * @param server - Server configuration object
 * @returns Git home directory path or null
 */
function getGitHomeDirectory(server: any): string | null {
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
 * @param server - Optional server configuration for server-specific validation
 * @returns Detailed credential status
 */
export function getGitCredentialDetails(server?: any): GitCredentialDetails {
  if (server) {
    // Server-specific validation
    const gitHome = getGitHomeDirectory(server);
    
    if (!gitHome) {
      return {
        hasCredentials: false,
        hasGitToken: !!process.env.GIT_TOKEN,
        credentialSources: process.env.GIT_TOKEN ? ['GIT_TOKEN environment variable'] : [],
        checkedPaths: [],
        error: 'No valid git home directory found'
      };
    }
    
    const hasGitCreds = hasGitCredentialsFile(gitHome);
    const hasSshKeys = hasValidSshKeys(gitHome);
    const credentialSources: string[] = [];
    
    if (hasGitCreds) {
      credentialSources.push(`git-credentials in ${gitHome}`);
    }
    if (hasSshKeys) {
      credentialSources.push(`SSH keys in ${gitHome}`);
    }
    if (process.env.GIT_TOKEN) {
      credentialSources.push('GIT_TOKEN environment variable');
    }
    
    return {
      hasCredentials: hasGitCreds || hasSshKeys || !!process.env.GIT_TOKEN,
      hasGitToken: !!process.env.GIT_TOKEN,
      credentialSources,
      checkedPaths: [gitHome]
    };
  }

  // System-wide validation (original logic)
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
