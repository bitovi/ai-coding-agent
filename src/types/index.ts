// Basic TypeScript type definitions for the AI Coding Agent project
// This allows gradual TypeScript adoption while keeping existing JS code working

export interface PromptParameter {
  type: string;
  description: string;
  required?: boolean;
  default?: any;
  enum?: string[];
}

export interface Connection {
  name: string;
  type: 'mcp-server' | 'credential';
  description: string;
  isAvailable: boolean;
  isProxy?: boolean;
  authUrl?: string;
  setupUrl?: string;
  proxyEndpoints?: string[];
  details?: Record<string, any>;
}

export interface Prompt {
  name: string;
  description?: string;
  messages?: Array<{
    role: string;
    content: string;
  }>;
  parameters?: Record<string, PromptParameter>;
  mcp_servers?: string[];
  connections?: Connection[];
  canRun?: boolean;
}

export interface User {
  email: string;
  sessionId: string;
  isAuthenticated: boolean;
  loginMethod?: string;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

// Express request extension for user info
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
