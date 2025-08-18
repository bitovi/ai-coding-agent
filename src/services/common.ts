import type { Request, Response } from 'express';
import type { ApiResponse } from '../types/index.js';
import { 
  type CredentialDetails 
} from '../connections/special/git-credentials.js';

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



export function getConnectionDescription(connectionType: string): string {
  switch (connectionType) {
    case 'git-credentials':
      return 'Git credentials for repository access';
    default:
      return `${connectionType} connection`;
  }
}

export function getConnectionMethod(connectionType: string): string {
  switch (connectionType) {
    case 'git-credentials':
      return 'token';
    default:
      return 'unknown';
  }
}


