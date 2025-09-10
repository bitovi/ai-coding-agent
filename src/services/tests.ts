/**
 * Test Service - Provides testing capabilities through the web interface
 */

import { Request, Response } from 'express';
import { handleError, type Dependencies } from './common.js';
import { AuthManager } from '../connections/mcp/AuthManager.js';

export interface TestResult {
  success: boolean;
  message: string;
  details?: any;
  timestamp: string;
}

export interface ConnectionTestResult extends TestResult {
  connectionName: string;
  connectionType: string;
  hasAuth: boolean;
  authMethod?: string;
}

export interface ConfigValidationResult extends TestResult {
  category: string;
  items: Array<{
    name: string;
    status: 'success' | 'warning' | 'error';
    message: string;
  }>;
}

export interface SystemTestResult {
  overall: TestResult;
  connections: ConnectionTestResult[];
  configuration: ConfigValidationResult[];
}

/**
 * Test MCP server connections
 */
export async function testConnections(
  configManager: any,
  authManager?: AuthManager
): Promise<ConnectionTestResult[]> {
  const results: ConnectionTestResult[] = [];
  
  try {
    const mcpServers = configManager.getMcpServers();
    const auth = authManager || new AuthManager();
    
    for (const server of mcpServers) {
      let hasAuth = false;
      let authMethod = 'none';
      
      // Check authorization status
      if (server.authorization_token) {
        hasAuth = true;
        authMethod = 'static_token';
      } else if (await auth.isAuthorized(server)) {
        hasAuth = true;
        authMethod = 'oauth';
      }
      
      results.push({
        success: hasAuth,
        message: hasAuth 
          ? `Connection ${server.name} is authorized and ready`
          : `Connection ${server.name} requires authorization`,
        connectionName: server.name,
        connectionType: server.type || 'mcp-server',
        hasAuth,
        authMethod,
        timestamp: new Date().toISOString(),
        details: {
          url: server.url,
          type: server.type,
          hasOAuthConfig: !!server.oauth_provider_configuration,
          proxy: server.proxy || false
        }
      });
    }
  } catch (error: any) {
    results.push({
      success: false,
      message: `Error testing connections: ${error.message}`,
      connectionName: 'system',
      connectionType: 'error',
      hasAuth: false,
      timestamp: new Date().toISOString(),
      details: { error: error.message }
    });
  }
  
  return results;
}

/**
 * Validate system configuration
 */
export async function validateConfiguration(): Promise<ConfigValidationResult[]> {
  const results: ConfigValidationResult[] = [];
  
  // Environment Variables Validation
  const envItems: Array<{ name: string; status: 'success' | 'warning' | 'error'; message: string }> = [];
  
  const required = ['EMAIL', 'ANTHROPIC_API_KEY'];
  const optional = ['ACCESS_TOKEN', 'MCP_SERVERS', 'PROMPTS', 'BASE_URL', 'PORT'];
  
  // Check required variables
  for (const variable of required) {
    if (process.env[variable]) {
      envItems.push({
        name: variable,
        status: 'success',
        message: 'Set and configured'
      });
    } else {
      envItems.push({
        name: variable,
        status: 'error',
        message: 'Missing (required)'
      });
    }
  }
  
  // Check optional variables
  for (const variable of optional) {
    if (process.env[variable]) {
      envItems.push({
        name: variable,
        status: 'success',
        message: 'Set and configured'
      });
    } else {
      envItems.push({
        name: variable,
        status: 'warning',
        message: 'Not set (optional)'
      });
    }
  }
  
  results.push({
    success: envItems.every(item => item.status !== 'error'),
    message: envItems.some(item => item.status === 'error') 
      ? 'Some required environment variables are missing'
      : 'Environment configuration is valid',
    category: 'Environment Variables',
    items: envItems,
    timestamp: new Date().toISOString()
  });
  
  return results;
}

/**
 * Run a comprehensive system test
 */
export async function runSystemTest(
  configManager: any,
  authManager?: AuthManager
): Promise<SystemTestResult> {
  const connectionTests = await testConnections(configManager, authManager);
  const configTests = await validateConfiguration();
  
  const allTests = [...connectionTests, ...configTests];
  const hasErrors = allTests.some(test => !test.success);
  const hasWarnings = configTests.some(test => 
    test.items && test.items.some(item => item.status === 'warning')
  );
  
  return {
    overall: {
      success: !hasErrors,
      message: hasErrors 
        ? 'System has issues that need attention'
        : hasWarnings
        ? 'System is operational with some warnings'
        : 'All systems operational',
      timestamp: new Date().toISOString(),
      details: {
        totalTests: allTests.length,
        passed: allTests.filter(test => test.success).length,
        failed: allTests.filter(test => !test.success).length
      }
    },
    connections: connectionTests,
    configuration: configTests
  };
}

/**
 * REST API endpoint handlers
 */

export async function getSystemTests(req: Request, res: Response, deps: Dependencies) {
  try {
    const result = await runSystemTest(deps.configManager, new AuthManager());
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    handleError(res, error);
  }
}

export async function getConnectionTests(req: Request, res: Response, deps: Dependencies) {
  try {
    const result = await testConnections(deps.configManager, new AuthManager());
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    handleError(res, error);
  }
}

export async function getConfigValidation(req: Request, res: Response, deps: Dependencies) {
  try {
    const result = await validateConfiguration();
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    handleError(res, error);
  }
}

/**
 * Setup test-related routes
 */
export function setupTestRoutes(app: any, deps: Dependencies = {}) {
  app.get('/api/tests/system', (req: Request, res: Response) => getSystemTests(req, res, deps));
  app.get('/api/tests/connections', (req: Request, res: Response) => getConnectionTests(req, res, deps));
  app.get('/api/tests/configuration', (req: Request, res: Response) => getConfigValidation(req, res, deps));
}