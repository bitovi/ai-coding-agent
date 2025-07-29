/**
 * Manages user sessions for secure frontend authentication
 */
import crypto from 'crypto';

export class SessionManager {
  constructor() {
    this.sessions = new Map(); // In production, use Redis or a database
    this.magicLinks = new Map(); // Store magic links temporarily
    this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
    this.magicLinkTimeout = 15 * 60 * 1000; // 15 minutes for magic links
    
    // Clean up expired sessions and magic links every hour
    setInterval(() => {
      this.cleanupExpiredSessions();
      this.cleanupExpiredMagicLinks();
    }, 60 * 60 * 1000);
  }

  /**
   * Generate a magic login link token
   */
  generateMagicLink(email) {
    const token = crypto.randomBytes(32).toString('hex');
    const magicLink = {
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
  validateMagicLink(token) {
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
  createSession(email, additionalData = {}) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const session = {
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
  validateSession(sessionId) {
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
  getSession(sessionId) {
    if (!this.validateSession(sessionId)) return null;
    return this.sessions.get(sessionId);
  }

  /**
   * Destroy a session
   */
  destroySession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = new Date();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Clean up expired magic links
   */
  cleanupExpiredMagicLinks() {
    const now = new Date();
    for (const [token, magicLink] of this.magicLinks.entries()) {
      if (magicLink.expiresAt < now || magicLink.used) {
        this.magicLinks.delete(token);
      }
    }
  }

  /**
   * Get session statistics
   */
  getStats() {
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
  getMagicLinkStats() {
    const now = new Date();
    const activeLinks = Array.from(this.magicLinks.values())
      .filter(link => link.expiresAt > now && !link.used);

    return {
      total: this.magicLinks.size,
      active: activeLinks.length,
      expired: this.magicLinks.size - activeLinks.length
    };
  }
}
