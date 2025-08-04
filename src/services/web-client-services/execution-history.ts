import type { Request, Response, Express } from 'express';
import type { ApiResponse } from '../../types/index.js';
import { handleError, type Dependencies } from './common.js';

// === EXECUTION HISTORY ===

export function getExecutionHistory(deps: Dependencies = {}) {
  const { executionHistoryService } = deps;
  
  return (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      // Get all executions using the correct method name
      const allExecutions = executionHistoryService?.getAllHistory?.(limit + offset) || [];
      const executions = allExecutions.slice(offset, offset + limit);
      const total = allExecutions.length;

      const response: ApiResponse = {
        success: true,
        data: {
          executions,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total
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

export function getPromptActivity(deps: Dependencies = {}) {
  const { promptManager, executionHistoryService } = deps;
  
  return (req: Request, res: Response) => {
    try {
      const { promptName } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const prompt = promptManager?.getPrompt(promptName);
      if (!prompt) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Prompt '${promptName}' does not exist`,
          timestamp: new Date().toISOString()
        });
      }

      // Get execution history using the correct method name
      const allExecutions = executionHistoryService?.getPromptHistory?.(promptName, limit + offset) || [];
      const executions = allExecutions.slice(offset, offset + limit);
      const total = allExecutions.length;

      const response = {
        prompt: {
          name: prompt.name,
          description: prompt.description
        },
        executions,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };

      res.json(response);
    } catch (error) {
      handleError(res, error);
    }
  };
}

/**
 * Wire up execution history routes to the Express app
 * @param app - Express application instance
 * @param deps - Dependencies for dependency injection
 */
export function setupExecutionHistoryRoutes(app: Express, deps: Dependencies = {}) {
  // GET /api/executions - Get recent execution history across all prompts
  app.get('/api/executions', getExecutionHistory(deps));
  
  // GET /api/prompts/:promptName/activity - Get execution history for a specific prompt
  app.get('/api/prompts/:promptName/activity', getPromptActivity(deps));
}
