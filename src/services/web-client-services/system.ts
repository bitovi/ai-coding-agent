import type { Request, Response, Express } from 'express';
import type { ApiResponse } from '../../types/index.js';
import { handleError, type Dependencies } from './common.js';

// === SYSTEM INFORMATION ===

export function getSystemHealth() {
  return (req: Request, res: Response): void => {
    try {
      const response: ApiResponse = {
        success: true,
        data: {
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0',
          uptime: Math.floor(process.uptime())
        }
      };

      res.json(response);
    } catch (error) {
      handleError(res, error);
    }
  };
}

export function getSystemStatus(deps: Dependencies = {}) {
  const { configManager, claudeService, authService } = deps;
  
  return (req: Request, res: Response): void => {
    try {
      const mcpServers = configManager?.getMcpServers() || [];
      const prompts = configManager?.getPrompts?.() || [];
      
      const response: ApiResponse = {
        success: true,
        data: {
          claudeService: {
            type: process.env.CLAUDE_SERVICE || 'claude-code',
            available: !!claudeService,
            capabilities: ['streaming', 'mcp-servers', 'git-integration']
          },
          authentication: {
            method: 'session',
            emailLoginEnabled: !!authService,
            tokenAuthEnabled: !!process.env.ACCESS_TOKEN
          },
          mcpServersConfigured: mcpServers.length,
          promptsLoaded: prompts.length,
          uptime: Math.floor(process.uptime())
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      handleError(res, error);
    }
  };
}

export function getSystemConfig(deps: Dependencies = {}) {
  const { configManager, emailService } = deps;
  
  return (req: Request, res: Response): void => {
    try {
      const response: ApiResponse = {
        success: true,
        data: {
          promptSources: ['examples/prompts.json'],
          mcpServerSources: ['examples/mcp-servers.json'],
          claudeService: process.env.CLAUDE_SERVICE || 'claude-code',
          authorizationEnabled: !!process.env.ACCESS_TOKEN || !!process.env.AUTHORIZED_EMAILS,
          emailServiceConfigured: !!emailService
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      handleError(res, error);
    }
  };
}

/**
 * Wire up system-related routes to the Express app
 * @param app - Express application instance
 * @param deps - Dependencies for dependency injection  
 */
export function setupSystemRoutes(app: Express, deps: Dependencies = {}) {
  // GET /api/system/health - Health check endpoint
  app.get('/api/system/health', getSystemHealth());
  
  // GET /api/system/status - Get system configuration and status
  app.get('/api/system/status', getSystemStatus(deps));
  
  // GET /api/system/config - Get configuration information (non-sensitive)
  app.get('/api/system/config', getSystemConfig(deps));
}
