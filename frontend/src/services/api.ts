// API Configuration
const API_BASE = process.env.NODE_ENV === 'development' 
  ? '' // Use proxy in development
  : '';

// Types
export interface PromptParameter {
  type: string;
  description?: string;
  default?: any;
  required?: boolean;
}

export interface Prompt {
  name: string;
  description?: string;
  mcp_servers: string[];
  connections?: Array<{
    name: string;
    type: 'mcp-server' | 'credential';
    description: string;
    isAvailable: boolean;
    authUrl?: string;
    setupUrl?: string;
  }>;
  parameters?: Record<string, PromptParameter>;
  messages: Array<{
    role: string;
    content: string;
    parameters?: any;
  }>;
}

export interface MCPServer {
  name: string;
  type: string;
  url?: string;
  oauth_provider_configuration?: any;
  tool_configuration?: any;
}

export interface ConnectionStatus {
  name: string;
  type: string;
  description: string;
  isAvailable: boolean;
  authUrl?: string;
  setupUrl?: string;
  details?: any;
  // Legacy compatibility
  status?: 'authorized' | 'unauthorized';
  url?: string;
}

export interface ExecutionHistory {
  id: string;
  promptName: string;
  timestamp: string;
  status: 'success' | 'error' | 'running' | 'completed';
  parameters?: any;
  output?: string;
  duration?: number;
  userEmail?: string;
  startTime?: number;
  endTime?: number;
  messages?: Array<{
    timestamp: string;
    type: string;
    data: any;
  }>;
  toolUses?: any[];
  toolResults?: any[];
  response?: any;
  error?: any;
}

export interface User {
  email: string;
}

// Generic API function
async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response;
}

// Web Client Services
export const webClientServices = {
  // Dashboard data
  async getDashboardData(): Promise<{
    prompts: Prompt[];
    mcpServers: MCPServer[];
    user: User | null;
  }> {
    const response = await apiRequest('/');
    const html = await response.text();
    
    // Parse the HTML to extract data (this is a temporary solution)
    // In a real implementation, you'd have JSON endpoints
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract user info
    const userEmail = doc.querySelector('.user-email')?.textContent?.replace('👤 ', '');
    const user = userEmail ? { email: userEmail } : null;
    
    // For now, return mock data - in real implementation, you'd have JSON endpoints
    return {
      prompts: [],
      mcpServers: [],
      user,
    };
  },

  // Prompts
  async getPrompts(): Promise<Prompt[]> {
    // This would be a JSON endpoint in a real implementation
    const response = await apiRequest('/api/prompts');
    const data = await response.json();
    // Handle the response format { success: true, data: { prompts: [...] } }
    return data.data?.prompts || data.prompts || data || [];
  },

  async getPrompt(name: string): Promise<Prompt> {
    const response = await apiRequest(`/api/prompts/${name}`);
    return response.json();
  },

  async runPrompt(name: string, parameters: any = {}): Promise<ReadableStream> {
    const response = await apiRequest(`/api/prompts/${name}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ parameters }),
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    return response.body;
  },

  async previewPrompt(name: string, parameters: any = {}): Promise<any> {
    const response = await apiRequest(`/api/prompts/${name}/preview`, {
      method: 'POST',
      body: JSON.stringify({ parameters }),
    });
    return response.json();
  },

  // MCP Servers & Connections
  async getMCPServers(): Promise<MCPServer[]> {
    const response = await apiRequest('/api/connections');
    const data = await response.json();
    // Extract MCP servers from connections response
    return data.data?.mcpServers || data.mcpServers || [];
  },

  async getConnectionStatuses(): Promise<ConnectionStatus[]> {
    const response = await apiRequest('/api/connections');
    const data = await response.json();
    // Handle the response format { success: true, data: { connections } }
    return data.data?.connections || data.connections || data || [];
  },

  async authorizeService(serviceName: string): Promise<{ authUrl: string }> {
    const response = await apiRequest(`/mcp/${serviceName}/authorize`, {
      method: 'POST',
    });
    return response.json();
  },

  async authorizeMcpServer(serverName: string): Promise<{ authUrl: string }> {
    const response = await apiRequest(`/api/connections/mcp/${serverName}/authorize`, {
      method: 'POST',
    });
    return response.json();
  },

  async setupCredentials(type: string, credentials: any): Promise<{ success: boolean; message: string }> {
    const response = await apiRequest(`/api/connections/credential/${type}/setup`, {
      method: 'POST',
      body: JSON.stringify({ credentials }),
    });
    return response.json();
  },

  // Execution History
  async getPromptHistory(promptName: string, limit: number = 20): Promise<ExecutionHistory[]> {
    const response = await apiRequest(`/api/prompts/${promptName}/activity?limit=${limit}`);
    const data = await response.json();
    // Response format matches the specification: { executions: [...] }
    return data.executions || [];
  },

  // Auth
  async logout(): Promise<void> {
    await apiRequest('/auth/logout', {
      method: 'POST',
    });
  },
};
