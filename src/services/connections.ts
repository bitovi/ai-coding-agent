import type { Request, Response, Express } from 'express';
import type { Connection, ApiResponse } from '../types/index.js';
import { 
  handleError, 
  checkConnectionAvailability,
  getConnectionDetails,
  setupGitCredentials,
  setupDockerCredentials
} from './common.js';

export interface GetConnectionsDeps {
  configManager: {
    getMcpServers: () => any[];
  };
  authManager: {
    isAuthorized: (serverName: string) => boolean;
  };
}

export function getConnections(deps: GetConnectionsDeps) {
  const { configManager, authManager } = deps;
  
  return (req: Request, res: Response) => {
    try {
      const connections: Connection[] = [];
      const mcpServers = configManager.getMcpServers() || [];

      // Add MCP server connections
      mcpServers.forEach((server: any) => {
        const isAvailable = authManager.isAuthorized(server.name) || false;
        
        connections.push({
          name: server.name,
          type: 'mcp-server',
          description: server.description || `${server.name} integration`,
          isAvailable,
          authUrl: `/api/connections/mcp/${server.name}/authorize`,
          details: {
            url: server.url,
            scopes: server.scopes,
            lastAuthorized: isAvailable ? new Date().toISOString() : null,
            tokenExpiry: null,
            hasRefreshToken: false
          }
        });
      });

      // Add known credential connections
      const credentialConnections = [
        {
          name: 'git-credentials',
          description: 'Git credentials for repository access',
          method: 'token'
        },
        {
          name: 'docker-registry',
          description: 'Docker registry credentials',
          method: 'credentials'
        }
      ];

      credentialConnections.forEach(cred => {
        const isAvailable = checkConnectionAvailability(cred.name);
        const connectionDetails = getConnectionDetails(cred.name);
        
        connections.push({
          name: cred.name,
          type: 'credential',
          description: cred.description,
          isAvailable,
          setupUrl: `/api/connections/credential/${cred.name}/setup`,
          details: {
            lastConfigured: isAvailable ? new Date().toISOString() : null,
            method: cred.method,
            ...connectionDetails
          }
        });
      });

      const response: ApiResponse = {
        success: true,
        data: { connections },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      handleError(res, error);
    }
  };
}

export interface AuthorizeMcpServerDeps {
  configManager: {
    getMcpServers: () => any[];
  };
  authManager: {
    isAuthorized: (serverName: string) => boolean;
    initiateAuthorization: (server: any) => Promise<string>;
  };
}

export function authorizeMcpServer(deps: AuthorizeMcpServerDeps) {
  const { configManager, authManager } = deps;
  
  return async (req: Request, res: Response) => {
    try {
      const { mcpName } = req.params;
      const mcpServers = configManager.getMcpServers() || [];
      const server = mcpServers.find((s: any) => s.name === mcpName);
      
      if (!server) {
        return res.status(404).json({
          error: 'Not Found',
          message: `MCP server '${mcpName}' not found`,
          timestamp: new Date().toISOString()
        });
      }

      if (authManager.isAuthorized(mcpName)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `MCP server '${mcpName}' is already authorized`,
          timestamp: new Date().toISOString()
        });
      }

      // Initiate authorization
      const authUrl = await authManager.initiateAuthorization(server);
      
      if (!authUrl) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Failed to initiate authorization for '${mcpName}'`,
          timestamp: new Date().toISOString()
        });
      }

      const response: ApiResponse = {
        success: true,
        data: { authUrl },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      handleError(res, error);
    }
  };
}

export interface GetMcpServerStatusDeps {
  configManager: {
    getMcpServers: () => any[];
  };
  authManager: {
    isAuthorized: (serverName: string) => boolean;
    getTokens: (serverName: string) => any;
  };
}

export function getMcpServerStatus(deps: GetMcpServerStatusDeps) {
  const { configManager, authManager } = deps;
  
  return (req: Request, res: Response) => {
    try {
      const { mcpName } = req.params;
      const mcpServers = configManager.getMcpServers() || [];
      const server = mcpServers.find((s: any) => s.name === mcpName);
      
      if (!server) {
        return res.status(404).json({
          error: 'Not Found',
          message: `MCP server '${mcpName}' not found`,
          timestamp: new Date().toISOString()
        });
      }

      const isAvailable = authManager.isAuthorized(mcpName) || false;
      const tokens = authManager.getTokens(mcpName);

      const response: ApiResponse = {
        success: true,
        data: {
          name: mcpName,
          type: 'mcp-server',
          isAvailable,
          details: {
            lastAuthorized: isAvailable ? new Date().toISOString() : null,
            tokenExpiry: tokens?.expires_at ? new Date(tokens.expires_at).toISOString() : null,
            hasRefreshToken: !!tokens?.refresh_token,
            needsReauthorization: false
          }
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      handleError(res, error);
    }
  };
}

export function setupCredentialConnection() {
  return async (req: Request, res: Response) => {
    try {
      const { credentialType } = req.params;
      const { token, username, password } = req.body;

      // Handle different credential types
      let success = false;
      let message = '';

      switch (credentialType) {
        case 'git-credentials':
          if (!token) {
            return res.status(400).json({
              error: 'Bad Request',
              message: 'Token is required for git credentials',
              timestamp: new Date().toISOString()
            });
          }
          success = await setupGitCredentials(token);
          message = success ? 'Git credentials configured successfully' : 'Failed to configure git credentials';
          break;
        case 'docker-registry':
          if (!username || !password) {
            return res.status(400).json({
              error: 'Bad Request',
              message: 'Username and password are required for docker credentials',
              timestamp: new Date().toISOString()
            });
          }
          success = await setupDockerCredentials({ username, password });
          message = success ? 'Docker credentials configured successfully' : 'Failed to configure docker credentials';
          break;
        default:
          return res.status(400).json({
            error: 'Bad Request',
            message: `Unknown credential type: ${credentialType}`,
            timestamp: new Date().toISOString()
          });
      }

      if (!success) {
        return res.status(500).json({
          error: 'Internal Server Error',
          message,
          timestamp: new Date().toISOString()
        });
      }

      const response: ApiResponse = {
        success: true,
        message,
        data: {
          connection: {
            name: credentialType,
            type: 'credential',
            isAvailable: true
          }
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
 * Wire up connection-related routes to the Express app
 * @param app - Express application instance 
 * @param deps - Dependencies for dependency injection
 */
export function setupConnectionRoutes(
  app: Express, 
  deps: GetConnectionsDeps & AuthorizeMcpServerDeps & GetMcpServerStatusDeps
) {
  // GET /api/connections - Get all available connections and their status
  app.get('/api/connections', getConnections(deps));
  
  // POST /api/connections/mcp/:mcpName/authorize - Initiate OAuth authorization for an MCP server
  app.post('/api/connections/mcp/:mcpName/authorize', authorizeMcpServer(deps));
  
  // GET /api/connections/mcp/:mcpName/status - Get authorization status for a specific MCP server
  app.get('/api/connections/mcp/:mcpName/status', getMcpServerStatus(deps));
  
  // POST /api/connections/credential/:credentialType/setup - Configure credential-based connections
  app.post('/api/connections/credential/:credentialType/setup', setupCredentialConnection());
}
