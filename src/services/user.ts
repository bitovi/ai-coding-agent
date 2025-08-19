import type { Request, Response, Express } from 'express';
import type { User, ApiResponse } from '../types/index.js';
import { handleError, isBrowserRequest } from './common.js';

// getUserInfo doesn't need any dependencies since it just reads from req.user
export function getUserInfo(deps: {} = {}) {
  return (req: Request, res: Response) => {
    try {
      const user = req.user;
      
      if (!user) {
        // For API requests, always return JSON (don't redirect)
        // Since this is /api/user, it should always be treated as an API call
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Login required',
          loginUrl: '/login'
        });
      }

      const response: ApiResponse<User> = {
        success: true,
        data: user,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      handleError(res, error);
    }
  };
}

/**
 * Wire up user-related routes to the Express app
 * @param app - Express application instance
 * @param deps - Dependencies for dependency injection
 */
interface SetupUserRoutesDeps {
  authService?: {
    getCurrentUser: (sessionId: string) => any;
  };
}

export function setupUserRoutes(app: Express, deps: SetupUserRoutesDeps = {}) {
  // GET /api/user - Get current authenticated user information
  app.get('/api/user', getUserInfo(deps));
}
