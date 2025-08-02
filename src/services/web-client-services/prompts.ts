import type { Request, Response, Express } from 'express';
import type { Prompt, Connection, ApiResponse } from '../../types/index.js';
import { 
  handleError, 
  checkConnectionAvailability, 
  getConnectionDescription, 
  getConnectionMethod,
  type Dependencies 
} from './common.js';

export function getPrompts(deps: Dependencies = {}) {
  const { promptManager, configManager, authManager } = deps;
  
  return (req: Request, res: Response) => {
    try {
      const prompts = promptManager?.getPrompts() || [];
      const mcpServers = configManager?.getMcpServers() || [];

      const promptsWithConnections = prompts.map((prompt: any) => {
        const connections: Connection[] = [];

        // Add MCP server connections
        if (prompt.mcp_servers) {
          prompt.mcp_servers.forEach((serverName: string) => {
            const server = mcpServers.find((s: any) => s.name === serverName);
            const isAvailable = authManager?.isAuthorized(serverName) || false;
            
            connections.push({
              name: serverName,
              type: 'mcp-server',
              description: server?.description || `${serverName} integration`,
              isAvailable,
              authUrl: `/api/connections/mcp/${serverName}/authorize`,
              details: server ? {
                url: server.url,
                scopes: server.scopes,
                lastAuthorized: isAvailable ? new Date().toISOString() : null,
                tokenExpiry: null,
                hasRefreshToken: false
              } : undefined
            });
          });
        }

        // Add credential connections (if specified in prompt config)
        if (prompt.connections) {
          Object.entries(prompt.connections).forEach(([env, connectionTypes]) => {
            (connectionTypes as string[]).forEach((connectionType: string) => {
              // Check if connection is available (implement validation logic)
              const isAvailable = checkConnectionAvailability(connectionType);
              
              connections.push({
                name: connectionType,
                type: 'credential',
                description: getConnectionDescription(connectionType),
                isAvailable,
                setupUrl: `/api/connections/credential/${connectionType}/setup`,
                details: {
                  lastConfigured: isAvailable ? new Date().toISOString() : null,
                  method: getConnectionMethod(connectionType)
                }
              });
            });
          });
        }

        const canRun = connections.length === 0 || connections.every(conn => conn.isAvailable);

        return {
          name: prompt.name,
          description: prompt.description,
          messages: prompt.messages,
          parameters: prompt.parameters,
          canRun,
          connections
        };
      });

      const response: ApiResponse<{ prompts: Prompt[] }> = {
        success: true,
        data: { prompts: promptsWithConnections },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      handleError(res, error);
    }
  };
}

export function getPrompt(deps: Dependencies = {}) {
  const { promptManager, configManager, authManager } = deps;
  
  return (req: Request, res: Response) => {
    try {
      const { promptName } = req.params;
      const prompt = promptManager?.getPrompt(promptName);
      
      if (!prompt) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Prompt '${promptName}' does not exist`,
          timestamp: new Date().toISOString()
        });
      }

      // Apply same connection logic as getPrompts
      const mcpServers = configManager?.getMcpServers() || [];
      const connections: Connection[] = [];

      if (prompt.mcp_servers) {
        prompt.mcp_servers.forEach((serverName: string) => {
          const server = mcpServers.find((s: any) => s.name === serverName);
          const isAvailable = authManager?.isAuthorized(serverName) || false;
          
          connections.push({
            name: serverName,
            type: 'mcp-server',
            description: server?.description || `${serverName} integration`,
            isAvailable,
            authUrl: `/api/connections/mcp/${serverName}/authorize`
          });
        });
      }

      const canRun = connections.every(conn => conn.isAvailable);

      const response: ApiResponse<Prompt> = {
        success: true,
        data: {
          ...prompt,
          canRun,
          connections
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      handleError(res, error);
    }
  };
}

export function executePrompt(deps: Dependencies = {}) {
  const { promptManager, configManager, authManager, claudeService } = deps;
  
  return async (req: Request, res: Response) => {
    try {
      const { promptName } = req.params;
      const { parameters } = req.body;
      
      const prompt = promptManager?.getPrompt(promptName);
      if (!prompt) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Prompt '${promptName}' does not exist`,
          timestamp: new Date().toISOString()
        });
      }

      // Check if all required connections are available
      const unavailableConnections: Connection[] = [];
      
      if (prompt.mcp_servers) {
        prompt.mcp_servers.forEach((serverName: string) => {
          if (!authManager?.isAuthorized(serverName)) {
            unavailableConnections.push({
              name: serverName,
              type: 'mcp-server',
              description: `${serverName} integration`,
              isAvailable: false,
              authUrl: `/api/connections/mcp/${serverName}/authorize`
            });
          }
        });
      }

      if (unavailableConnections.length > 0) {
        return res.status(401).json({
          error: 'Authorization required',
          requiredConnections: unavailableConnections,
          message: 'Please authorize the required connections',
          timestamp: new Date().toISOString()
        });
      }

      // Set up SSE
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send start event
      res.write(`data: ${JSON.stringify({
        type: 'start',
        promptName: promptName,
        timestamp: new Date().toISOString()
      })}\n\n`);

      // Execute prompt via Claude service
      const userEmail = req.user?.email || 'unknown';
      
      if (claudeService?.executePromptStream) {
        await claudeService.executePromptStream(
          prompt,
          parameters,
          configManager,
          authManager,
          res,
          userEmail
        );
      } else {
        // Fallback if claude service not available
        res.write(`data: ${JSON.stringify({
          type: 'output',
          content: 'Claude service not available',
          timestamp: new Date().toISOString()
        })}\n\n`);
        
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          success: false,
          timestamp: new Date().toISOString()
        })}\n\n`);
      }

      res.end();
    } catch (error) {
      console.error('Prompt execution error:', error);
      
      if (!res.headersSent) {
        handleError(res, error);
      } else {
        // Send error via SSE
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: error.message,
          timestamp: new Date().toISOString()
        })}\n\n`);
        res.end();
      }
    }
  };
}

/**
 * Wire up prompt-related routes to the Express app
 * @param app - Express application instance
 * @param deps - Dependencies for dependency injection
 */
export function setupPromptRoutes(app: Express, deps: Dependencies = {}) {
  // GET /api/prompts - Get all available prompts with their authorization status
  app.get('/api/prompts', getPrompts(deps));
  
  // GET /api/prompts/:promptName - Get details for a specific prompt
  app.get('/api/prompts/:promptName', getPrompt(deps));
  
  // POST /api/prompts/:promptName/run - Execute a prompt with streaming response
  app.post('/api/prompts/:promptName/run', executePrompt(deps));
}


