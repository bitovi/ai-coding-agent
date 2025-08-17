import fs from 'fs-extra';
import path from 'path';

/**
 * Provider for managing prompts and their pending execution state
 * Handles loading, validation, and retrieval of prompt configurations
 */
export class PromptProvider {
  private prompts: Map<string, any>;
  private pendingPrompts: Array<{
    promptName: string;
    parameters: any;
    timestamp: string;
    id: string;
  }>;

  constructor() {
    this.prompts = new Map();
    this.pendingPrompts = []; // Array of prompts waiting for authorization
  }

  async loadPrompts(): Promise<void> {
    const promptsEnv = process.env.PROMPTS;
    
    if (!promptsEnv) {
      console.warn('⚠️  No PROMPTS environment variable found');
      return;
    }

    let promptsData: any[];
    
    try {
      // Try to parse as JSON first
      promptsData = JSON.parse(promptsEnv);
    } catch (error: any) {
      try {
        // Try to read as file path
        const filePath = path.resolve(promptsEnv);
        const fileContent = await fs.readFile(filePath, 'utf8');
        promptsData = JSON.parse(fileContent);
      } catch (fileError: any) {
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
    }

    console.log(`✅ Loaded ${this.prompts.size} prompts`);
  }

  private validatePrompt(prompt: any): void {
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

  getPrompts(): any[] {
    return Array.from(this.prompts.values());
  }

  getPrompt(name: string): any | undefined {
    return this.prompts.get(name);
  }

  /**
   * Save a prompt for later execution when authorization is complete
   */
  savePendingPrompt(promptName: string, parameters: any): void {
    this.pendingPrompts.push({
      promptName,
      parameters,
      timestamp: new Date().toISOString(),
      id: Date.now().toString()
    });
    
    console.log(`📋 Saved pending prompt: ${promptName}`);
  }
}
