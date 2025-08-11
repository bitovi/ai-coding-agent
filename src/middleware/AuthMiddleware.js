/**
 * Middleware for handling authentication
 */
export class AuthMiddleware {
  constructor(authService = null) {
    this.accessToken = process.env.ACCESS_TOKEN;
    this.authService = authService;
    this.sessionCookieName = 'ai-coding-agent-session';
  }

  /**
   * Set the auth service (used during app initialization)
   */
  setAuthService(authService) {
    this.authService = authService;
  }

  /**
   * Authenticate incoming requests using sessions or legacy ACCESS_TOKEN
   */
  authenticate(req, res, next) {
    // Check if authentication is disabled via environment variable
    if (process.env.DISABLE_AUTH === 'true') {
      console.log('🔓 Authentication disabled via DISABLE_AUTH environment variable');
      req.user = { 
        email: 'test@example.com', 
        sessionId: 'test-session',
        loginMethod: 'disabled' 
      };
      return next();
    }
    
    // Try session-based authentication first
    if (this.authService) {
      const sessionAuth = this.trySessionAuthentication(req, res);
      if (sessionAuth.success) {
        req.user = sessionAuth.user;
        return next();
      }
      
      // If session auth fails and no legacy token configured, require login
      if (!this.accessToken) {
        return this.requireLogin(req, res);
      }
    }

    // Fallback to legacy ACCESS_TOKEN authentication
    if (this.accessToken) {
      const tokenAuth = this.tryTokenAuthentication(req, res);
      if (tokenAuth.success) {
        return next();
      }
    }

    // If we have auth service but no valid session/token, require login
    if (this.authService) {
      return this.requireLogin(req, res);
    }

    // No authentication configured at all
    console.warn('⚠️  No authentication configured - allowing request');
    return next();
  }

  /**
   * Try to authenticate using session cookie
   */
  trySessionAuthentication(req, res) {
    console.log('🔍 Trying session authentication for:', req.path);
    const sessionId = this.getSessionIdFromRequest(req);
    console.log('🔍 Session ID from request:', sessionId);
    
    if (!sessionId) {
      console.log('🔍 No session ID found');
      return { success: false, reason: 'no_session' };
    }

    const session = this.authService.getSession(sessionId);
    console.log('🔍 Session lookup result:', session ? 'found' : 'not found');
    if (!session) {
      // Clear invalid session cookie
      console.log('🔍 Clearing invalid session cookie');
      this.clearSessionCookie(res);
      return { success: false, reason: 'invalid_session' };
    }

    console.log('🔍 Session authentication successful for:', session.email);
    return { 
      success: true, 
      user: { 
        email: session.email, 
        sessionId: session.id,
        loginMethod: session.loginMethod 
      } 
    };
  }

  /**
   * Try legacy token authentication
   */
  tryTokenAuthentication(req, res) {
    // Check for token in various places
    let providedToken = null;

    // 1. Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      providedToken = authHeader.substring(7);
    }

    // 2. Query parameter
    if (!providedToken && req.query.access_token) {
      providedToken = req.query.access_token;
    }

    // 3. Body parameter (for POST requests)
    if (!providedToken && req.body && req.body.access_token) {
      providedToken = req.body.access_token;
    }

    // 4. Custom header
    if (!providedToken && req.headers['x-access-token']) {
      providedToken = req.headers['x-access-token'];
    }

    // Validate token
    if (providedToken && providedToken === this.accessToken) {
      return { success: true };
    }

    return { success: false, reason: 'invalid_token' };
  }

  /**
   * Handle authentication failure by redirecting or returning JSON
   */
  requireLogin(req, res) {
    // Check if this is an API request in multiple ways:
    // 1. Path starts with /api/
    // 2. Accept header includes JSON
    // 3. Content-Type is JSON
    // 4. XMLHttpRequest header (req.xhr)
    const isApiRequest = req.path.startsWith('/api/') ||
                        req.xhr || 
                        req.headers.accept?.includes('application/json') || 
                        req.headers['content-type']?.includes('application/json') ||
                        req.headers.accept?.includes('text/event-stream'); // For streaming endpoints

    if (isApiRequest) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Login required',
        loginUrl: '/login'
      });
    }

    // For browser requests, redirect to login page
    return res.redirect('/login');
  }

  /**
   * Get session ID from request (cookie or header)
   */
  getSessionIdFromRequest(req) {
    // Try cookie first
    if (req.headers.cookie) {
      const cookies = this.parseCookies(req.headers.cookie);
      if (cookies[this.sessionCookieName]) {
        return cookies[this.sessionCookieName];
      }
    }

    // Try custom header
    return req.headers['x-session-id'];
  }

  /**
   * Set session cookie
   */
  setSessionCookie(res, sessionId) {
    const cookieOptions = [
      `${this.sessionCookieName}=${sessionId}`,
      'HttpOnly',
      'Secure=false', // Set to true in production with HTTPS
      'SameSite=Lax',
      'Path=/',
      `Max-Age=${24 * 60 * 60}` // 24 hours
    ];

    res.setHeader('Set-Cookie', cookieOptions.join('; '));
  }

  /**
   * Clear session cookie
   */
  clearSessionCookie(res) {
    res.setHeader('Set-Cookie', `${this.sessionCookieName}=; HttpOnly; Secure=false; SameSite=Lax; Path=/; Max-Age=0`);
  }

  /**
   * Parse cookies from cookie header
   */
  parseCookies(cookieHeader) {
    const cookies = {};
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
    return cookies;
  }

  /**
   * Optional authentication - doesn't block if no token is configured
   */
  optionalAuthenticate(req, res, next) {
    // If session auth is available, try it first
    if (this.authService) {
      const sessionAuth = this.trySessionAuthentication(req, res);
      if (sessionAuth.success) {
        req.user = sessionAuth.user;
        return next();
      }
    }

    // If no ACCESS_TOKEN is configured, allow all requests
    if (!this.accessToken) {
      return next();
    }

    // If token is configured, use regular authentication
    this.authenticate(req, res, next);
  }

  /**
   * Get authentication instructions for API consumers
   */
  getAuthInstructions() {
    const instructions = {
      sessionAuth: {
        available: !!this.authService,
        description: 'Use magic link email authentication via /login'
      },
      tokenAuth: {
        available: !!this.accessToken,
        description: 'Use ACCESS_TOKEN for API access'
      }
    };

    if (!this.accessToken && !this.authService) {
      return {
        required: false,
        message: 'No authentication required'
      };
    }

    const methods = [];
    if (this.authService) {
      methods.push('Email-based login: Go to /login and enter your email');
    }
    if (this.accessToken) {
      methods.push('Authorization header: `Authorization: Bearer YOUR_TOKEN`');
      methods.push('Query parameter: `?access_token=YOUR_TOKEN`');
      methods.push('Request body: `{"access_token": "YOUR_TOKEN"}`');
      methods.push('Custom header: `X-Access-Token: YOUR_TOKEN`');
    }

    return {
      required: true,
      message: 'Authentication required. Choose one of the following methods:',
      methods,
      details: instructions
    };
  }
}
