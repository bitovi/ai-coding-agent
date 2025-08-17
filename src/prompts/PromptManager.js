import fs from 'fs-extra';
import path from 'path';
import { isServerAuthorized } from '../auth/authUtils.js';

/**
 * Manages prompts and their execution history
 */
export class PromptManager {
  constructor() {
    this.prompts = new Map();
    this.promptHistory = new Map(); // Maps prompt name to execution history
    this.pendingPrompts = []; // Array of prompts waiting for authorization
  }

  async loadPrompts() {
    const promptsEnv = process.env.PROMPTS;
    
    if (!promptsEnv) {
      console.warn('⚠️  No PROMPTS environment variable found');
      return;
    }

    let promptsData;
    
    try {
      // Try to parse as JSON first
      promptsData = JSON.parse(promptsEnv);
    } catch (error) {
      try {
        // Try to read as file path
        const filePath = path.resolve(promptsEnv);
        const fileContent = await fs.readFile(filePath, 'utf8');
        promptsData = JSON.parse(fileContent);
      } catch (fileError) {
        throw new Error(`Failed to load prompts: ${error.message}. Also failed to read as file: ${fileError.message}`);
      }
    }

    if (!Array.isArray(promptsData)) {
      throw new Error('PROMPTS must be an array');
    }

    // Store prompts in a Map for quick lookup
    for (const prompt of promptsData) {
      this.validatePrompt(prompt);
      this.prompts.set(prompt.name, prompt);
      this.promptHistory.set(prompt.name, []);
    }

    console.log(`✅ Loaded ${this.prompts.size} prompts`);
  }

  validatePrompt(prompt) {
    const required = ['name', 'mcp_servers', 'messages'];
    for (const field of required) {
      if (!prompt[field]) {
        throw new Error(`Prompt missing required field: ${field}`);
      }
    }

    if (!Array.isArray(prompt.mcp_servers)) {
      throw new Error('Prompt mcp_servers must be an array');
    }

    if (!Array.isArray(prompt.messages)) {
      throw new Error('Prompt messages must be an array');
    }

    // Validate messages format
    for (const message of prompt.messages) {
      if (!message.role || !message.content) {
        throw new Error('Each message must have role and content');
      }
    }
  }

  getPrompts() {
    return Array.from(this.prompts.values());
  }

  getPrompt(name) {
    return this.prompts.get(name);
  }

  /**
   * Process prompt messages with parameter substitution
   */
  processPromptWithParameters(prompt, parameters = {}) {
    // Clone the prompt to avoid modifying the original
    const processedPrompt = JSON.parse(JSON.stringify(prompt));
    
    // Process each message
    for (const message of processedPrompt.messages) {
      if (message.parameters) {
        message.content = this.substituteParameters(message.content, parameters, message.parameters);
        delete message.parameters; // Remove parameters field for Claude API
      }
    }

    return processedPrompt;
  }

  /**
   * Substitute parameters in message content
   */
  substituteParameters(content, providedParams, parameterSchema) {
    let processedContent = content;
    
    // Validate required parameters
    if (parameterSchema.required) {
      for (const requiredParam of parameterSchema.required) {
        if (!(requiredParam in providedParams)) {
          throw new Error(`Missing required parameter: ${requiredParam}`);
        }
      }
    }

    // Substitute parameters in content
    if (parameterSchema.properties) {
      for (const [paramName, paramConfig] of Object.entries(parameterSchema.properties)) {
        const paramValue = providedParams[paramName] || paramConfig.default;
        
        if (paramValue !== undefined) {
          // Simple template substitution - replace {{paramName}} with value
          const regex = new RegExp(`\\{\\{${paramName}\\}\\}`, 'g');
          processedContent = processedContent.replace(regex, String(paramValue));
        }
      }
    }

    return processedContent;
  }

  /**
   * Add a prompt execution to history
   */
  addToHistory(promptName, execution) {
    const history = this.promptHistory.get(promptName) || [];
    history.unshift({
      ...execution,
      timestamp: new Date().toISOString(),
      id: Date.now().toString()
    });
    
    // Keep only last 50 executions
    if (history.length > 50) {
      history.splice(50);
    }
    
    this.promptHistory.set(promptName, history);
  }

  /**
   * Get execution history for a prompt
   */
  getHistory(promptName) {
    return this.promptHistory.get(promptName) || [];
  }

  /**
   * Save a prompt for later execution when authorization is complete
   */
  savePendingPrompt(promptName, parameters) {
    this.pendingPrompts.push({
      promptName,
      parameters,
      timestamp: new Date().toISOString(),
      id: Date.now().toString()
    });
    
    console.log(`📋 Saved pending prompt: ${promptName}`);
  }

  /**
   * Get all pending prompts
   */
  getPendingPrompts() {
    return this.pendingPrompts;
  }

  /**
   * Remove a pending prompt (when executed or cancelled)
   */
  removePendingPrompt(id) {
    const index = this.pendingPrompts.findIndex(p => p.id === id);
    if (index >= 0) {
      this.pendingPrompts.splice(index, 1);
    }
  }

  /**
   * Get prompts that are ready to execute (all MCP servers authorized)
   */
  getReadyPrompts(authManager, configManager) {
    const readyPrompts = [];
    
    for (const pending of this.pendingPrompts) {
      const prompt = this.getPrompt(pending.promptName);
      if (!prompt) continue;
      
      const allAuthorized = prompt.mcp_servers.every(serverName => {
        const server = configManager.getMcpServer(serverName);
        return isServerAuthorized(server, authManager);
      });
      
      if (allAuthorized) {
        readyPrompts.push(pending);
      }
    }
    
    return readyPrompts;
  }
}
