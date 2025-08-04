import type { Request, Response, Express } from 'express';
import type { User, ApiResponse } from '../../types/index.js';
import { handleError, isBrowserRequest, type Dependencies } from './common.js';

export function getUserInfo(deps: Dependencies = {}) {
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
export function setupUserRoutes(app: Express, deps: Dependencies = {}) {
  // GET /api/user - Get current authenticated user information
  app.get('/api/user', (req, res) => {
    const authMiddleware = deps.authMiddleware;
    if (authMiddleware) {
      // Apply authentication middleware to set req.user
      authMiddleware.authenticate(req, res, () => {
        // If we get here, authentication passed and req.user is set
        getUserInfo(deps)(req, res);
      });
    } else {
      // No auth middleware available, call handler directly
      getUserInfo(deps)(req, res);
    }
  });
}
