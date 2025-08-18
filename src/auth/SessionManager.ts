/**
 * Manages user sessions for secure frontend authentication
 */
import crypto from 'crypto';

export interface MagicLink {
  token: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
}

export interface Session {
  id: string;
  email: string;
  createdAt: Date;
  lastAccessed: Date;
  expiresAt: Date;
  [key: string]: any; // Allow additional data
}

export interface SessionStats {
  total: number;
  active: number;
  expired: number;
}

export interface MagicLinkStats {
  total: number;
  active: number;
  expired: number;
}

export class SessionManager {
  private sessions: Map<string, Session>;
  private magicLinks: Map<string, MagicLink>;
  private sessionTimeout: number;
  private magicLinkTimeout: number;
  private sessionCleanupInterval: NodeJS.Timeout;
  private magicLinkCleanupInterval: NodeJS.Timeout;

  constructor() {
    this.sessions = new Map(); // In production, use Redis or a database
    this.magicLinks = new Map(); // Store magic links temporarily
    this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
    this.magicLinkTimeout = 15 * 60 * 1000; // 15 minutes for magic links
    
    // Clean up expired sessions every hour
    this.sessionCleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
    
    // Clean up expired magic links more frequently (every 10 minutes)
    // This ensures expired links are removed within 10 minutes of expiration
    this.magicLinkCleanupInterval = setInterval(() => {
      this.cleanupExpiredMagicLinks();
    }, 10 * 60 * 1000);
  }

  /**
   * Generate a magic login link token
   */
  generateMagicLink(email: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const magicLink: MagicLink = {
      token,
      email: email.toLowerCase().trim(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.magicLinkTimeout),
      used: false
    };

    this.magicLinks.set(token, magicLink);
    return token;
  }

  /**
   * Validate and consume a magic link token
   */
  validateMagicLink(token: string): MagicLink | null {
    if (!token) return null;

    const magicLink = this.magicLinks.get(token);
    if (!magicLink) return null;

    // Check if expired
    if (magicLink.expiresAt < new Date()) {
      this.magicLinks.delete(token);
      return null;
    }

    // Check if already used
    if (magicLink.used) {
      return null;
    }

    // Mark as used
    magicLink.used = true;
    
    return magicLink;
  }

  /**
   * Create a new session for a user
   */
  createSession(email: string, additionalData: Record<string, any> = {}): string {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const session: Session = {
      id: sessionId,
      email: email.toLowerCase().trim(),
      createdAt: new Date(),
      lastAccessed: new Date(),
      expiresAt: new Date(Date.now() + this.sessionTimeout),
      ...additionalData
    };

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  /**
   * Validate and refresh a session
   */
  validateSession(sessionId: string): boolean {
    if (!sessionId) return false;

    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      this.sessions.delete(sessionId);
      return false;
    }

    // Update last accessed time and extend expiration
    session.lastAccessed = new Date();
    session.expiresAt = new Date(Date.now() + this.sessionTimeout);
    
    return true;
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): Session | null {
    if (!this.validateSession(sessionId)) return null;
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Destroy a session
   */
  destroySession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }
    
    // Optional: Log cleanup activity (useful for debugging)
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  /**
   * Clean up expired magic links
   */
  private cleanupExpiredMagicLinks(): void {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [token, magicLink] of this.magicLinks.entries()) {
      // Only clean up if truly expired (with a small buffer to avoid race conditions)
      // or if already used
      if (magicLink.expiresAt < now || magicLink.used) {
        this.magicLinks.delete(token);
        cleanedCount++;
      }
    }
    
    // Optional: Log cleanup activity (useful for debugging)
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired/used magic links`);
    }
  }

  /**
   * Get session statistics
   */
  getStats(): SessionStats {
    const now = new Date();
    const activeSessions = Array.from(this.sessions.values())
      .filter(session => session.expiresAt > now);

    return {
      total: this.sessions.size,
      active: activeSessions.length,
      expired: this.sessions.size - activeSessions.length
    };
  }

  /**
   * Get magic link statistics
   */
  getMagicLinkStats(): MagicLinkStats {
    const now = new Date();
    const activeLinks = Array.from(this.magicLinks.values())
      .filter(link => link.expiresAt > now && !link.used);

    return {
      total: this.magicLinks.size,
      active: activeLinks.length,
      expired: this.magicLinks.size - activeLinks.length
    };
  }

  /**
   * Clean up resources and stop intervals
   */
  destroy(): void {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
    }
    if (this.magicLinkCleanupInterval) {
      clearInterval(this.magicLinkCleanupInterval);
    }
    this.sessions.clear();
    this.magicLinks.clear();
  }
}
