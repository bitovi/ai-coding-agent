import { SessionManager } from './SessionManager.ts';

/**
 * Handles user authentication including magic link login
 */
export class AuthService {
  constructor(emailService) {
    this.emailService = emailService;
    this.sessionManager = new SessionManager();
    
    // List of authorized email addresses (for simple access control)
    this.authorizedEmails = this.parseAuthorizedEmails();
  }

  /**
   * Parse authorized emails from environment variable
   */
  parseAuthorizedEmails() {
    const emails = process.env.AUTHORIZED_EMAILS || process.env.EMAIL || '';
    
    if (this.authorizedEmails.length === 0) {
      // If no authorized emails configured, allow any email (development mode)
      console.warn('⚠️  No AUTHORIZED_EMAILS configured - allowing all email addresses');
    }

    return emails
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0);
  }

  /**
   * Check if an email is authorized to access the system
   */
  isEmailAuthorized(email) {
    if (this.authorizedEmails.length === 0) {
      return true;
    }

    return this.authorizedEmails.includes(email.toLowerCase().trim());
  }

  /**
   * Initiate magic link login process
   */
  async requestMagicLink(email) {
    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    if (!this.isValidEmail(normalizedEmail)) {
      throw new Error('Invalid email address');
    }

    // Check if email is authorized
    if (!this.isEmailAuthorized(normalizedEmail)) {
      // For security, don't reveal whether email is authorized or not
      // Just say we sent a link (but don't actually send it)
      console.warn(`🚫 Unauthorized login attempt from: ${normalizedEmail}`);
      return { success: true, message: 'If your email is authorized, you will receive a login link shortly.' };
    }

    // Generate magic link token
    const magicToken = this.sessionManager.generateMagicLink(normalizedEmail);

    // Send magic link email
    try {
      await this.emailService.sendMagicLoginEmail(normalizedEmail, magicToken);
      
      console.log(`✅ Magic link sent to: ${normalizedEmail}`);
      return { 
        success: true, 
        message: 'Login link sent! Check your email and click the link to access the dashboard.' 
      };
    } catch (error) {
      console.error('❌ Failed to send magic link:', error);
      throw new Error('Failed to send login link. Please try again.');
    }
  }

  /**
   * Verify magic link and create session
   */
  async verifyMagicLink(token) {
    if (!token) {
      throw new Error('No login token provided');
    }

    const magicLink = this.sessionManager.validateMagicLink(token);
    if (!magicLink) {
      throw new Error('Invalid or expired login link');
    }

    // Create a new session for the user
    const sessionId = this.sessionManager.createSession(magicLink.email, {
      loginMethod: 'magic-link',
      userAgent: null // Will be set by middleware
    });

    console.log(`✅ User logged in: ${magicLink.email}`);
    
    return {
      sessionId,
      email: magicLink.email
    };
  }

  /**
   * Validate a session
   */
  validateSession(sessionId) {
    return this.sessionManager.validateSession(sessionId);
  }

  /**
   * Get session information
   */
  getSession(sessionId) {
    return this.sessionManager.getSession(sessionId);
  }

  /**
   * Destroy a session (logout)
   */
  logout(sessionId) {
    return this.sessionManager.destroySession(sessionId);
  }

  /**
   * Get authentication statistics
   */
  getStats() {
    return {
      sessions: this.sessionManager.getStats(),
      magicLinks: this.sessionManager.getMagicLinkStats(),
      authorizedEmails: this.authorizedEmails.length
    };
  }

  /**
   * Simple email validation
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
