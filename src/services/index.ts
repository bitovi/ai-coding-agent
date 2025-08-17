// Import setup functions for internal use
import { setupUserRoutes } from './user.js';
import { setupPromptRoutes } from './prompts.js';
import { setupConnectionRoutes } from './connections.js';
import { setupSystemRoutes } from './system.js';
import { setupExecutionHistoryRoutes } from './execution-history.js';

// Re-export all functions from the modular services
export { getUserInfo, setupUserRoutes } from './user.js';
export { 
  getPrompts, 
  getPrompt, 
  executePrompt,
  setupPromptRoutes 
} from './prompts.js';
export { 
  getConnections, 
  authorizeMcpServer, 
  getMcpServerStatus, 
  setupCredentialConnection,
  setupConnectionRoutes 
} from './connections.js';
export { 
  getSystemHealth, 
  getSystemStatus, 
  getSystemConfig,
  setupSystemRoutes 
} from './system.js';
export { 
  getExecutionHistory, 
  getPromptActivity,
  setupExecutionHistoryRoutes 
} from './execution-history.js';

// Re-export common types and utilities for convenience
export type { Dependencies } from './common.js';
export { 
  handleError, 
  isBrowserRequest,
  checkConnectionAvailability,
  getConnectionDescription,
  getConnectionMethod,
  setupGitCredentials
} from './common.js';

/**
 * Wire up all web client service routes to the Express app
 * @param app - Express application instance
 * @param deps - Dependencies for dependency injection
 */
export function setupAllWebClientRoutes(app: any, deps: any = {}) {
  setupUserRoutes(app, deps);
  setupPromptRoutes(app, deps);
  setupConnectionRoutes(app, deps); 
  setupSystemRoutes(app, deps);
  setupExecutionHistoryRoutes(app, deps);
}
