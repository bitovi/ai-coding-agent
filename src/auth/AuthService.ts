import { SessionManager, Session, SessionStats, MagicLinkStats } from './SessionManager';

interface EmailService {
  sendMagicLoginEmail(email: string, token: string): Promise<void>;
}

interface MagicLinkResponse {
  success: boolean;
  message: string;
}

interface VerifyMagicLinkResponse {
  sessionId: string;
  email: string;
}

interface AuthStats {
  sessions: SessionStats;
  magicLinks: MagicLinkStats;
  authorizedEmails: number;
}

/**
 * Handles user authentication including magic link login
 */
export class AuthService {
  private emailService: EmailService;
  private sessionManager: SessionManager;
  private authorizedEmails: string[];

  constructor(emailService: EmailService) {
    this.emailService = emailService;
    this.sessionManager = new SessionManager();
    
    // List of authorized email addresses (for simple access control)
    this.authorizedEmails = this.parseAuthorizedEmails();
  }

  /**
   * Parse authorized emails from environment variable
   */
  private parseAuthorizedEmails(): string[] {
    const emails = process.env.AUTHORIZED_EMAILS || process.env.EMAIL || '';
    return emails
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0);
  }

  /**
   * Check if an email is authorized to access the system
   */
  isEmailAuthorized(email: string): boolean {
    if (this.authorizedEmails.length === 0) {
      // If no authorized emails configured, allow any email (development mode)
      console.warn('⚠️  No AUTHORIZED_EMAILS configured - allowing all email addresses');
      return true;
    }

    return this.authorizedEmails.includes(email.toLowerCase().trim());
  }

  /**
   * Initiate magic link login process
   */
  async requestMagicLink(email: string): Promise<MagicLinkResponse> {
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
  async verifyMagicLink(token: string): Promise<VerifyMagicLinkResponse> {
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
  validateSession(sessionId: string): boolean {
    return this.sessionManager.validateSession(sessionId);
  }

  /**
   * Get session information
   */
  getSession(sessionId: string): Session | null {
    return this.sessionManager.getSession(sessionId);
  }

  /**
   * Destroy a session (logout)
   */
  logout(sessionId: string): boolean {
    return this.sessionManager.destroySession(sessionId);
  }

  /**
   * Get authentication statistics
   */
  getStats(): AuthStats {
    return {
      sessions: this.sessionManager.getStats(),
      magicLinks: this.sessionManager.getMagicLinkStats(),
      authorizedEmails: this.authorizedEmails.length
    };
  }

  /**
   * Simple email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.sessionManager.destroy();
  }
}

// Export interfaces for use by other modules
export type { EmailService, MagicLinkResponse, VerifyMagicLinkResponse, AuthStats };
