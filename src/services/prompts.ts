import type { Request, Response, Express } from 'express';
import type { Prompt, Connection, ApiResponse } from '../types/index.js';
import { 
  handleError, 
  checkConnectionAvailability, 
  getConnectionDescription, 
  getConnectionMethod
} from './common.js';
import { mergeParametersWithDefaults, processPrompt } from '../../public/js/prompt-utils.js';
import { isServerAuthorized } from '../auth/authUtils.js';

export interface GetPromptsDeps {
  promptManager: {
    getPrompts: () => any[];
  };
  configManager: {
    getMcpServers: () => any[];
  };
  authManager: {
    isAuthorized: (mcpServer: any) => Promise<boolean>;
  };
}

export function getPrompts(deps: GetPromptsDeps) {
  const { promptManager, configManager, authManager } = deps;
  
  return async (req: Request, res: Response) => {
    try {
      const prompts = promptManager.getPrompts() || [];
      const mcpServers = configManager.getMcpServers() || [];

      const promptsWithConnections = await Promise.all(prompts.map(async (prompt: any) => {
        const connections: Connection[] = [];

        // Add MCP server connections
        if (prompt.mcp_servers) {
          for (const serverName of prompt.mcp_servers) {
            const server = mcpServers.find((s: any) => s.name === serverName);
            const isAvailable = server ? await authManager.isAuthorized(server) || false : false;
            
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
          }
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
      }));

      // Return prompts data directly according to API specification
      res.json({ prompts: promptsWithConnections });
    } catch (error) {
      handleError(res, error);
    }
  };
}

export interface GetPromptDeps {
  promptManager: {
    getPrompt: (name: string) => any;
  };
  configManager: {
    getMcpServers: () => any[];
  };
  authManager: {
    isAuthorized: (mcpServer: any) => Promise<boolean>;
  };
}

export function getPrompt(deps: GetPromptDeps) {
  const { promptManager, configManager, authManager } = deps;
  
  return async (req: Request, res: Response) => {
    try {
      const { promptName } = req.params;
      const prompt = promptManager.getPrompt(promptName);
      
      if (!prompt) {
        return res.status(404).json({
          error: 'Not Found',  
          message: `Prompt '${promptName}' does not exist`,
          timestamp: new Date().toISOString()
        });
      }

      // Apply same connection logic as getPrompts
      const mcpServers = configManager.getMcpServers() || [];
      const connections: Connection[] = [];

      if (prompt.mcp_servers) {
        for (const serverName of prompt.mcp_servers) {
          const server = mcpServers.find((s: any) => s.name === serverName);
          const isAvailable = server ? await authManager.isAuthorized(server) || false : false;
          
          connections.push({
            name: serverName,
            type: 'mcp-server',
            description: server?.description || `${serverName} integration`,
            isAvailable,
            authUrl: `/api/connections/mcp/${serverName}/authorize`
          });
        }
      }

      const canRun = connections.every(conn => conn.isAvailable);

      // Return prompt data directly according to API specification
      const promptWithConnections: Prompt = {
        ...prompt,
        canRun,
        connections
      };

      res.json(promptWithConnections);
    } catch (error) {
      handleError(res, error);
    }
  };
}

export interface ExecutePromptDeps {
  promptManager: {
    getPrompt: (name: string) => any;
    savePendingPrompt: (name: string, parameters: any) => void;
  };
  configManager: {
    getMcpServer: (name: string) => any;
  };
  authManager: any; // Keep flexible for isServerAuthorized function
  claudeService: {
    executePromptStream: (prompt: any, parameters: any, configManager: any, authManager: any, res: Response, userEmail: string) => Promise<void>;
  };
  emailService?: {
    sendAuthorizationNeededEmail?: (email: string, servers: string[]) => Promise<void>;
  };
}

export function executePrompt(deps: ExecutePromptDeps) {
  const { promptManager, configManager, authManager, claudeService, emailService } = deps;
  
  return async (req: Request, res: Response) => {
    try {
      const { promptName } = req.params;
      
      
      const requestParameters = req.body.parameters || {};

      
      const prompt = promptManager.getPrompt(promptName);
      if (!prompt) {
        return res.status(404).json({ error: 'Prompt not found' });
      }      // Merge request parameters with defaults from prompt schema (match legacy behavior)
      const parameters = mergeParametersWithDefaults(prompt, requestParameters);

      // Process the prompt to substitute parameters into the template (THIS WAS MISSING!)
      const processedPrompt = processPrompt(prompt, parameters);

      
      // Check if all required MCP servers are authorized (match legacy behavior)
      const unauthorizedServers: string[] = [];


      if (prompt.mcp_servers) {
        for (const mcpServerName of prompt.mcp_servers) {
          const mcpServer = configManager.getMcpServer(mcpServerName);
          
          // Use the same authUtils function as legacy endpoint
          const isAuthorized = await isServerAuthorized(mcpServer, authManager);
          if (!isAuthorized) {
            unauthorizedServers.push(mcpServerName);
          }
        }
      }

      if (unauthorizedServers.length > 0) {
        // Save prompt for later execution (match legacy behavior)
        promptManager.savePendingPrompt(promptName, parameters);
        
        // Send email notification (match legacy behavior)
        if (emailService?.sendAuthorizationNeededEmail) {
          await emailService.sendAuthorizationNeededEmail(
            process.env.EMAIL || '',
            unauthorizedServers
          );
        }
        
        return res.status(401).json({
          error: 'Authorization required',
          unauthorizedServers,
          message: 'Please authorize the required MCP servers. An email has been sent with instructions.'
        });
      }

      // Execute prompt via Claude service (match legacy behavior - let Claude service handle SSE headers)
      const userEmail = req.user?.email || 'unknown';
      
      if (claudeService?.executePromptStream) {
        await claudeService.executePromptStream(
          processedPrompt, // Use the processed prompt with parameters substituted
          parameters,
          configManager,
          authManager,
          res,
          userEmail
        );
      } else {
        // Fallback if claude service not available - only set headers if claude service unavailable
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        });
        
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
        
        res.end();
      }
    } catch (error: any) {
      console.error('❌ Prompt execution error:', error);
      
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
      // Note: Don't try to write SSE errors if headers are already sent
      // The Claude service handles its own error responses via SSE
    }
  };
}

/**
 * Debug endpoint to test body parsing
 */
export function debugBody(deps: {} = {}) {
  return (req: Request, res: Response) => {
    console.log('=== DEBUG ENDPOINT ===');
    console.log('Method:', req.method);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Raw body:', req.body);
    console.log('Body type:', typeof req.body);
    console.log('Body stringified:', JSON.stringify(req.body));
    
    res.json({
      method: req.method,
      contentType: req.headers['content-type'],
      body: req.body,
      bodyType: typeof req.body,
      parameters: req.body?.parameters
    });
  };
}

/**
 * Wire up prompt-related routes to the Express app
 * @param app - Express application instance
 * @param deps - Dependencies for dependency injection
 */
export function setupPromptRoutes(
  app: Express, 
  deps: GetPromptsDeps & GetPromptDeps & ExecutePromptDeps
) {
  // GET /api/prompts - Get all available prompts with their authorization status
  app.get('/api/prompts', getPrompts(deps));
  
  // GET /api/prompts/:promptName - Get details for a specific prompt
  app.get('/api/prompts/:promptName', getPrompt(deps));
  
  // POST /api/prompts/:promptName/run - Execute a prompt with streaming response
  app.post('/api/prompts/:promptName/run', executePrompt(deps));
  
  // POST /api/debug/body - Debug endpoint to test body parsing
  app.post('/api/debug/body', debugBody(deps));
}


