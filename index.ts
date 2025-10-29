#!/usr/bin/env node

/**
 * AI Coding Agent
 * 
 * This is an AI coding agent that runs Claude Code while providing it 
 * access to MCP services.
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ConfigManager } from './src/config/ConfigManager.js';
import { AuthManager } from './src/connections/mcp/AuthManager.js';
import { AuthService } from './src/auth/AuthService.js';
import { PromptProvider } from './src/providers/PromptProvider.js';
import { ClaudeServiceProvider } from './src/providers/claude/ClaudeServiceProvider.js';
import { EmailProvider } from './src/providers/EmailProvider.js';
import { ExecutionHistoryProvider } from './src/providers/ExecutionHistoryProvider.js';
import { AuthMiddleware } from './src/middleware/AuthMiddleware.js';
import { setupAllWebClientRoutes } from './src/services/index.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AICodingAgent {
  private app: Application;
  private port: number;
  private configManager: ConfigManager;
  private authManager: AuthManager;
  private promptProvider: PromptProvider;
  private executionHistoryService: ExecutionHistoryProvider;
  private claudeService: any;
  private emailService: EmailProvider;
  private authService: AuthService;
  private authMiddleware: AuthMiddleware;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000');
    
    // Initialize services
    this.configManager = new ConfigManager();
    this.authManager = new AuthManager();
    this.promptProvider = new PromptProvider();
    this.executionHistoryService = new ExecutionHistoryProvider();
    this.claudeService = ClaudeServiceProvider.create(this.executionHistoryService);
    this.emailService = new EmailProvider();
    this.authService = new AuthService(this.emailService);
    this.authMiddleware = new AuthMiddleware(this.authService as any);
  }

  async initialize(): Promise<void> {
    try {
      // Validate Claude service configuration
      const serviceValidation = await ClaudeServiceProvider.validateConfiguration();
      console.log(`🔧 Claude Service: ${serviceValidation.serviceType}`);
      for (const message of serviceValidation.messages) {
        console.log(`   ${message}`);
      }
      
      if (!serviceValidation.isValid) {
        console.error('❌ Claude service configuration is invalid');
        console.log('\n📖 Please check the documentation for setup instructions:');
        console.log('   https://github.com/your-org/ai-coding-agent/docs');
        process.exit(1);
      }
      
      // Load configurations
      await this.configManager.loadConfigurations();
      await this.promptProvider.loadPrompts();
      
      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      console.log('✅ AI Coding Agent initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize AI Coding Agent:', error);
      process.exit(1);
    }
  }

  setupMiddleware(): void {
    // Parse JSON bodies
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Serve static files from public directory
    this.app.use('/static', express.static(path.join(__dirname, 'public')));
    
    // Serve built frontend static assets
    this.app.use('/assets', express.static(path.join(__dirname, 'frontend/dist/assets')));
    
    // CORS for development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  setupRoutes(): void {
    // === GLOBAL AUTHENTICATION MIDDLEWARE ===
    // Apply authentication to all routes by default, with specific exceptions for public routes
    this.app.use((req, res, next) => {
      // Define public routes that don't require authentication
      const publicRoutes = [
        '/health',                    // Health check
        '/auth/request-login',        // Request magic link
        '/auth/login',               // Verify magic link
        '/login',                    // React login page
        '/static/',                  // Static assets (CSS, JS, etc.)
        '/assets/',                  // Vite build assets
        '/vite.svg',                 // Favicon
        '/favicon.svg',              // Favicon
        '/favicon.ico',              // Standard favicon
        '/api/mcp/',                 // MCP proxy endpoints (no auth required - MCP servers handle their own auth)
        '/v1/sse/'                   // Legacy SSE endpoints for MCP fallback
      ];

      // Special case: root path should be public but not treated as prefix
      const isRootPath = req.path === '/';
      
      // Check if this is a public route
      const isPublicRoute = isRootPath || publicRoutes.some(route => {
        if (route.endsWith('/') && route !== '/') {
          // For routes ending with / (except root), check if path starts with the route
          return req.path.startsWith(route);
        } else {
          // For exact routes (including root /), match exactly
          return req.path === route;
        }
      });

      // Skip authentication for public routes
      if (isPublicRoute) {
        return next();
      }

      // Apply authentication for all other routes
      this.authMiddleware.authenticate(req, res, next);
    });

    // === AUTHENTICATION ROUTES ===
    // Note: /login route is now handled by React Router in the SPA
    this.app.post('/auth/request-login', async (req, res) => {
      try {
        const { email } = req.body;
        
        if (!email) {
          return res.status(400).json({ 
            error: 'Email required',
            message: 'Please provide an email address' 
          });
        }

        const result = await this.authService.requestMagicLink(email);
        res.json(result);
      } catch (error: any) {
        console.error('❌ Magic link request error:', error);
        res.status(400).json({ 
          error: 'Login request failed',
          message: error.message 
        });
      }
    });

    this.app.get('/auth/login', async (req, res) => {
      try {
        console.log('🔐 /auth/login route hit with token:', req.query.token ? 'YES' : 'NO');
        const { token } = req.query;
        
        if (!token) {
          console.log('❌ No token provided');
          return res.redirect('/login?error=invalid_token');
        }

        console.log('🔍 Verifying magic link...');
        const loginResult = await this.authService.verifyMagicLink(token as string);
        console.log('✅ Magic link verified, session ID:', loginResult.sessionId);
        
        // Set session cookie
        console.log('🍪 Setting session cookie...');
        this.authMiddleware.setSessionCookie(res, loginResult.sessionId);
        console.log('✅ Session cookie set');
        
        // Redirect to dashboard with success message
        console.log('↩️ Redirecting to dashboard');
        res.redirect('/?success=login');
      } catch (error: any) {
        console.error('❌ Magic link verification error:', error);
        let errorCode = 'invalid_token';
        if (error.message.includes('expired')) {
          errorCode = 'expired_token';
        } else if (error.message.includes('used')) {
          errorCode = 'token_used';
        }
        res.redirect(`/login?error=${errorCode}`);
      }
    });

    this.app.post('/auth/logout', (req, res) => {
      const sessionId = this.authMiddleware.getSessionIdFromRequest(req);
      if (sessionId) {
        this.authService.logout(sessionId);
      }
      
      // Clear session cookie
      this.authMiddleware.clearSessionCookie(res);
      
      res.json({ success: true, message: 'Logged out successfully' });
    });

    // Dashboard and protected routes are now handled by React Router
    // Legacy routes for backwards compatibility (redirect to React app)
    this.app.get('/index.html', (req, res) => {
      res.redirect('/');
    });

    // Legacy prompt activity page (redirect to React route)
    this.app.get('/prompts/:promptName/activity.html', (req, res) => {
      res.redirect(`/prompts/${req.params.promptName}/activity`);
    });

    // MCP authorization endpoint
    this.app.post('/mcp/:mcpName/authorize',
      async (req, res) => {
        try {
          const mcpName = req.params.mcpName;
          const mcpServer = this.configManager.getMcpServer(mcpName);
          
          if (!mcpServer) {
            return res.status(404).json({ error: 'MCP server not found' });
          }
          
          const authUrl = await this.authManager.initiateAuthorization(mcpServer);
          res.json({ authUrl });
        } catch (error: any) {
          console.error('❌ Authorization error:', error);
          res.status(500).json({ error: error.message });
        }
      }
    );

    // Environment connections setup endpoint
    this.app.post('/connections/git-credentials/setup',
      async (req, res) => {
        try {
          const { token } = req.body;
          
          if (!token) {
            return res.status(400).json({ error: 'Token is required' });
          }
          
          await this.setupGitCredentials(token);
          res.json({ success: true, message: 'Git credentials configured successfully' });
        } catch (error: any) {
          console.error('❌ Git credentials setup error:', error);
          res.status(500).json({ error: error.message });
        }
      }
    );

    // OAuth callback endpoint
    this.app.get('/oauth/callback', async (req, res) => {
      try {
        await this.authManager.handleOAuthCallback(req, res);
      } catch (error: any) {
        console.error('❌ OAuth callback error:', error);
        res.status(500).send('OAuth callback failed');
      }
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });



    // === WEB CLIENT SERVICE ROUTES ===
    // Set up the new modular web client API routes
    const webClientDeps = {
      authService: this.authService,
      authMiddleware: this.authMiddleware,
      promptManager: this.promptProvider,
      configManager: this.configManager,
      authManager: this.authManager,
      executionHistoryService: this.executionHistoryService,
      claudeService: this.claudeService,
      emailService: this.emailService
    };

    // Wire up all the web client service routes (GET /api/user, /api/prompts, etc.)
    setupAllWebClientRoutes(this.app, webClientDeps);

    // Serve the React app for all non-API routes (SPA fallback)
    // This must be the last route to catch all unmatched routes
    this.app.get('*', (req, res) => {
      // Skip API routes, auth routes, and static files
      if (req.path.startsWith('/api/') || 
          req.path.startsWith('/auth/') || 
          req.path.startsWith('/mcp/') ||
          req.path.startsWith('/oauth/') ||
          req.path.startsWith('/prompt/') ||
          req.path.startsWith('/static/') ||
          req.path.startsWith('/assets/') ||
          req.path === '/health') {
        return res.status(404).json({ error: 'Not found' });
      }
      
      // Serve the React app
      const frontendIndexPath = path.join(__dirname, 'frontend/dist/index.html');
      res.sendFile(frontendIndexPath, (err) => {
        if (err) {
          console.error('Error serving React app:', err);
          res.status(500).send('Error loading application');
        }
      });
    });
  }

  /**
   * Setup git credentials for Claude Code operations
   * @param token - GitHub personal access token
   */
  async setupGitCredentials(token: string): Promise<void> {
    const fs = await import('fs');
    const os = await import('os');
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // Determine the appropriate home directory
    const homeDir = process.env.HOME || os.homedir() || '/home/appuser';
    
    // Create .git-credentials file
    const gitCredentialsPath = path.join(homeDir, '.git-credentials');
    const username = process.env.GIT_USERNAME || 'token';
    const credentialsContent = `https://${username}:${token}@github.com\n`;
    
    // Write the credentials file
    await fs.promises.writeFile(gitCredentialsPath, credentialsContent, { mode: 0o600 });
    
    // Configure git to use the credential store
    await execAsync('git config --global credential.helper store');
    
    console.log(`✅ Git credentials configured at: ${gitCredentialsPath}`);
    console.log(`✅ Git credential helper configured to use store`);
  }

  async start(): Promise<void> {
    await this.initialize();
    
    this.app.listen(this.port, () => {
      console.log(`🚀 AI Coding Agent listening on port ${this.port}`);
      console.log(`📋 Dashboard: http://localhost:${this.port}`);
    });
  }
}

// Start the application
const agent = new AICodingAgent();
agent.start().catch(console.error);
