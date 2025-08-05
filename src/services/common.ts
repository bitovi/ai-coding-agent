import type { Request, Response } from 'express';
import type { ApiResponse } from '../types/index.js';
import { 
  validateGitCredentials, 
  getGitCredentialDetails, 
  isConnectionAvailable as checkConnectionValidator,
  type GitCredentialDetails 
} from '../auth/connectionValidators.js';

// Dependencies interface for dependency injection
export interface Dependencies {
  authService?: any;
  authMiddleware?: any;
  promptManager?: any;
  configManager?: any;
  authManager?: any;
  executionHistoryService?: any;
  claudeService?: any;
  emailService?: any;
}

// Helper function to handle errors consistently
export function handleError(res: Response, error: any, statusCode = 500): void {
  console.error('API Error:', error);
  
  const errorResponse: ApiResponse = {
    error: error.name || 'Internal Server Error',
    message: error.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  };

  res.status(statusCode).json(errorResponse);
}

// Helper function to check if request is from browser (for redirects vs JSON)
export function isBrowserRequest(req: Request): boolean {
  return !req.xhr && 
         !req.headers.accept?.includes('application/json') && 
         !req.headers['content-type']?.includes('application/json');
}

// Helper functions for connection management
export function checkConnectionAvailability(connectionType: string): boolean {
  switch (connectionType) {
    case 'git-credentials':
      return validateGitCredentials();
    case 'docker-registry':
      return !!(process.env.DOCKER_USERNAME && process.env.DOCKER_PASSWORD);
    default:
      return checkConnectionValidator(connectionType);
  }
}

export function getConnectionDescription(connectionType: string): string {
  switch (connectionType) {
    case 'git-credentials':
      return 'Git credentials for repository access';
    case 'docker-registry':
      return 'Docker registry credentials';
    default:
      return `${connectionType} connection`;
  }
}

export function getConnectionMethod(connectionType: string): string {
  switch (connectionType) {
    case 'git-credentials':
      return 'token';
    case 'docker-registry':
      return 'credentials';
    default:
      return 'unknown';
  }
}

export async function setupGitCredentials(token: string): Promise<boolean> {
  try {
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
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

export async function setupDockerCredentials(credentials: any): Promise<boolean> {
  try {
    // Implementation would save docker credentials
    return typeof credentials === 'object' && credentials.username && credentials.password;
  } catch (error) {
    console.error('Failed to setup docker credentials:', error);
    return false;
  }
}

export function getConnectionDetails(connectionType: string): any {
  switch (connectionType) {
    case 'git-credentials':
      return getGitCredentialDetails();
    default:
      return { available: checkConnectionAvailability(connectionType) };
  }
}
