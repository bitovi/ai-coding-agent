import type { Request, Response } from 'express';
import type { ApiResponse } from '../../types/index.js';

// Dependencies interface for dependency injection
export interface Dependencies {
  authService?: any;
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
      return !!(process.env.GIT_TOKEN || process.env.GITHUB_TOKEN);
    case 'docker-registry':
      return !!(process.env.DOCKER_USERNAME && process.env.DOCKER_PASSWORD);
    default:
      return false;
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
    // Implementation would save git credentials
    // For now, just validate token format
    return token.startsWith('ghp_') || token.startsWith('github_pat_');
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
