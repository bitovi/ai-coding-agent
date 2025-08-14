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
    const required = ['name', 'type'];
    for (const field of required) {
      if (!server[field]) {
        throw new Error(`MCP server missing required field: ${field}`);
      }
    }

    // Type-specific validation
    if (server.type === 'url') {
      if (!server.url) {
        throw new Error(`URL-type MCP server missing required field: url`);
      }
    } else if (server.type === 'stdio') {
      if (!server.command) {
        throw new Error(`STDIO-type MCP server missing required field: command`);
      }
    } else {
      throw new Error(`Invalid MCP server type: ${server.type}. Must be 'url' or 'stdio'`);
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
    return Array.from(this.mcpServers.values()).map(server => {
      // Clone the server to avoid modifying the original
      const enrichedServer = { ...server };

      // If no authorization_token in config, check environment variable
      if (!enrichedServer.authorization_token) {
        const envTokenKey = `MCP_${server.name}_authorization_token`;
        const envToken = process.env[envTokenKey];
        if (envToken) {
          enrichedServer.authorization_token = envToken;
        }
      }

      return enrichedServer;
    });
  }

  getMcpServer(name) {
    const server = this.mcpServers.get(name);
    if (!server) {
      return undefined;
    }

    // Clone the server to avoid modifying the original
    const enrichedServer = { ...server };

    // If no authorization_token in config, check environment variable
    if (!enrichedServer.authorization_token) {
      const envTokenKey = `MCP_${name}_authorization_token`;
      const envToken = process.env[envTokenKey];
      if (envToken) {
        enrichedServer.authorization_token = envToken;
      }
    }

    return enrichedServer;
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
        type: server.type, // Use the actual server type (url or stdio)
        name: server.name,
        tool_configuration: server.tool_configuration || { enabled: true }
      };

      // Add type-specific fields
      if (server.type === 'stdio') {
        // For STDIO servers, include command, args, and env
        if (server.command) {
          mcpServer.command = server.command;
        }
        if (server.args) {
          mcpServer.args = server.args;
        }
        if (server.env) {
          mcpServer.env = server.env;
        }
      } else {
        // For URL servers, include the URL
        mcpServer.url = server.url;
      }

      // Add authorization token (already enriched with env vars by getMcpServer)
      if (server.authorization_token) {
        mcpServer.authorization_token = server.authorization_token;
      } else {
        // Fallback to OAuth tokens from AuthManager
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
