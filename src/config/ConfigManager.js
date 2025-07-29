import fs from 'fs-extra';
import path from 'path';

/**
 * Manages configuration loading and parsing for MCP servers and prompts
 */
export class ConfigManager {
  constructor() {
    this.mcpServers = new Map();
    this.config = {
      email: process.env.EMAIL,
      accessToken: process.env.ACCESS_TOKEN
    };
  }

  async loadConfigurations() {
    await this.loadMcpServers();
    this.validateConfig();
  }

  async loadMcpServers() {
    const mcpServersEnv = process.env.MCP_SERVERS;
    
    if (!mcpServersEnv) {
      console.warn('⚠️  No MCP_SERVERS environment variable found');
      return;
    }

    let mcpServersData;
    
    try {
      // Try to parse as JSON first
      mcpServersData = JSON.parse(mcpServersEnv);
    } catch (error) {
      try {
        // Try to read as file path
        const filePath = path.resolve(mcpServersEnv);
        const fileContent = await fs.readFile(filePath, 'utf8');
        mcpServersData = JSON.parse(fileContent);
      } catch (fileError) {
        throw new Error(`Failed to load MCP servers: ${error.message}. Also failed to read as file: ${fileError.message}`);
      }
    }

    if (!Array.isArray(mcpServersData)) {
      throw new Error('MCP_SERVERS must be an array');
    }

    // Store servers in a Map for quick lookup
    for (const server of mcpServersData) {
      this.validateMcpServer(server);
      this.mcpServers.set(server.name, server);
    }

    console.log(`✅ Loaded ${this.mcpServers.size} MCP servers`);
  }

  validateMcpServer(server) {
    const required = ['name', 'type', 'url'];
    for (const field of required) {
      if (!server[field]) {
        throw new Error(`MCP server missing required field: ${field}`);
      }
    }

    // Validate oauth_provider_configuration if present
    if (server.oauth_provider_configuration) {
      this.validateOAuthConfig(server.oauth_provider_configuration);
    }
  }

  validateOAuthConfig(config) {
    const required = ['issuer', 'authorization_endpoint', 'token_endpoint', 'client_id', 'client_type'];
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`OAuth configuration missing required field: ${field}`);
      }
    }

    if (config.client_type === 'confidential' && !config.client_secret) {
      throw new Error('Confidential OAuth clients must have client_secret');
    }
  }

  validateConfig() {
    if (!this.config.email) {
      throw new Error('EMAIL environment variable is required');
    }

    if (!this.config.accessToken) {
      console.warn('⚠️  No ACCESS_TOKEN environment variable found - API will not be protected');
    }
  }

  getMcpServers() {
    return Array.from(this.mcpServers.values());
  }

  getMcpServer(name) {
    return this.mcpServers.get(name);
  }

  getConfig() {
    return this.config;
  }

  // Helper method to prepare MCP servers for Claude API
  prepareMcpServersForClaude(serverNames, authManager) {
    const mcpServers = [];
    
    for (const serverName of serverNames) {
      const server = this.getMcpServer(serverName);
      if (!server) {
        throw new Error(`MCP server not found: ${serverName}`);
      }

      const mcpServer = {
        type: server.type === 'sse' ? 'url' : server.type,
        url: server.url,
        name: server.name,
        tool_configuration: server.tool_configuration || { enabled: true }
      };

      // Add authorization token
      if (server.authorization_token) {
        mcpServer.authorization_token = server.authorization_token;
      } else {
        const tokens = authManager.getTokens(serverName);
        if (tokens && tokens.access_token) {
          mcpServer.authorization_token = tokens.access_token;
        }
      }

      mcpServers.push(mcpServer);
    }

    return mcpServers;
  }
}
