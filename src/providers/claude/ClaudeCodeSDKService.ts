import { query, SDKMessage, Options, PermissionMode } from '@anthropic-ai/claude-code';
import { Response } from 'express';
import { processPrompt } from '../../../public/js/prompt-utils.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import type { Prompt } from '../../types/index.js';
import type { ExecutionHistoryProvider } from '../ExecutionHistoryProvider.js';

interface McpServerConfig {
  type: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

interface McpServer {
  name: string;
  type?: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

interface ClaudeCodeSDKOptions {
  maxTurns: number;
  cwd: string;
  mcpConfig: string;
  outputFormat: string;
  allowedTools: string[];
  permissionMode: PermissionMode;
}

interface ClaudeCodeSDKMessage {
  type: string;
  subtype?: string;
  message?: any;
  session_id?: string;
  cwd?: string;
  tools?: string[];
  mcp_servers?: any;
  model?: string;
  permissionMode?: string;
  result?: any;
  duration_ms?: number;
  total_cost_usd?: number;
  num_turns?: number;
}

/**
 * Service for interacting with Claude Code using the TypeScript SDK
 * Implements the same interface as ClaudeAnthropicSDK but uses the Claude Code SDK
 */
export class ClaudeCodeSDKService {
  private executionHistoryService: ExecutionHistoryProvider | null;
  private tempDir: string;
  private mcpConfigPath: string;

  constructor(executionHistoryService: ExecutionHistoryProvider | null = null) {
    this.executionHistoryService = executionHistoryService;
    
    // Use WORKING_DIR environment variable if set, otherwise fall back to temp directory
    let baseDir: string;
    if (process.env.WORKING_DIR) {
      // Resolve relative paths to absolute paths
      baseDir = path.resolve(process.env.WORKING_DIR);
    } else {
      baseDir = os.tmpdir();
    }
    
    this.tempDir = path.join(baseDir, 'claude-code-sdk-service');
    this.mcpConfigPath = path.join(this.tempDir, '.mcp.json');
    
    console.log('🔍 [DEBUG] Claude Code SDK working directory:', this.tempDir);
    
    // Ensure temp directory exists
    fs.ensureDirSync(this.tempDir);
    
    // Validate authentication
    this.validateAuthentication();
  }

  /**
   * Validate that Claude Code SDK authentication is available
   */
  validateAuthentication(): void {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for Claude Code SDK');
    }
    console.log('✅ Claude Code SDK authentication validated');
  }

  /**
   * Set the execution history service (used during app initialization)
   */
  setExecutionHistoryService(executionHistoryService: ExecutionHistoryProvider): void {
    this.executionHistoryService = executionHistoryService;
  }

  /**
   * Configure MCP servers for Claude Code SDK
   */
  async configureMcpServers(mcpServers: McpServer[], authManager: any): Promise<string> {
    const mcpConfig: McpConfig = {
      mcpServers: {}
    };

    for (const server of mcpServers) {
      const serverConfig: McpServerConfig = {
        type: server.type || 'stdio'
      };

      if (server.type === 'stdio' || !server.type) {
        serverConfig.command = server.command;
        if (server.args) {
          serverConfig.args = server.args;
        }
        if (server.env) {
          serverConfig.env = server.env;
        }
      } else if (server.type === 'sse') {
        serverConfig.url = server.url;
        if (server.headers) {
          serverConfig.headers = server.headers;
        }
      } else {
        console.warn(`⚠️  Unknown MCP server type: ${server.type}`);
        continue;
      }

      mcpConfig.mcpServers[server.name] = serverConfig;
    }

    // Write MCP configuration to temporary file
    await fs.writeJson(this.mcpConfigPath, mcpConfig, { spaces: 2 });
    
    console.log(`📝 Configured ${mcpServers.length} MCP servers for Claude Code SDK`);
    return this.mcpConfigPath;
  }

  /**
   * Execute a prompt with streaming response using Claude Code SDK
   */
  async executePromptStream(
    prompt: Prompt, 
    parameters: Record<string, any>, 
    configManager: any, 
    authManager: any, 
    res: Response, 
    userEmail: string = 'unknown'
  ): Promise<void> {
    let executionId: string | null = null;
    
    try {
      console.log('🔍 [DEBUG] Starting executePromptStream with Claude Code SDK...');
      
      // Create execution record
      if (this.executionHistoryService) {
        executionId = this.executionHistoryService.createExecution(
          prompt.name,
          parameters,
          userEmail
        );
        console.log('🔍 [DEBUG] Created execution record:', executionId);
      }

      // Process prompt with parameter substitution
      console.log('🔍 [DEBUG] Processing prompt with parameters...');
      const processedPrompt = processPrompt(prompt, parameters);
      console.log('🔍 [DEBUG] Processed prompt messages:', processedPrompt.messages.length);
      
      // Prepare MCP servers configuration
      console.log('🔍 [DEBUG] Preparing MCP servers...');
      const mcpServers = configManager.prepareMcpServersForClaude(
        prompt.mcp_servers, 
        authManager
      );
      console.log('🔍 [DEBUG] Prepared MCP servers:', mcpServers.length);

      // Configure MCP servers for Claude Code SDK
      console.log('🔍 [DEBUG] Configuring MCP servers for Claude Code SDK...');
      const mcpConfigPath = await this.configureMcpServers(mcpServers, authManager);

      // Set up SSE headers
      console.log('🔍 [DEBUG] Setting up SSE headers...');
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send initial status
      this.sendSSEEvent(res, 'status', { message: 'Starting Claude Code SDK execution...', executionId });

      // Build the prompt content for Claude Code SDK
      console.log('🔍 [DEBUG] Building prompt content...');
      const promptContent = this.buildPromptContent(processedPrompt, mcpServers);
      console.log('🔍 [DEBUG] Prompt content length:', promptContent.length);
      
      // Prepare Claude Code SDK options
      const options = {
        maxTurns: 10,
        cwd: this.tempDir,
        mcpConfig: mcpConfigPath,
        outputFormat: 'stream-json',
        allowedTools: this.buildAllowedTools(mcpServers),
        permissionMode: 'acceptEdits'
      } as any;

      console.log('🔍 [DEBUG] Claude Code SDK options:', options);
      console.log('🚀 Executing Claude Code SDK query...');
      
      // Execute Claude Code SDK query
      const abortController = new AbortController();
      
      // Set up abort on client disconnect
      res.on('close', () => {
        console.log('🔍 [DEBUG] Client disconnected, aborting Claude Code SDK query');
        abortController.abort();
      });

      const messages: SDKMessage[] = [];
      let messageStarted = false;

      for await (const message of query({
        prompt: promptContent,
        abortController,
        options
      })) {
        messages.push(message);
        this.handleClaudeCodeSDKMessage(message as any, res, executionId, messageStarted);
        
        if (message.type === 'assistant') {
          messageStarted = true;
        }
      }

      // Mark execution as completed
      console.log('🔍 [DEBUG] Claude Code SDK execution completed, updating status...');
      if (this.executionHistoryService && executionId) {
        this.executionHistoryService.updateStatus(executionId, 'completed');
      }

      // Send completion event
      this.sendSSEEvent(res, 'complete', { message: 'Claude Code SDK execution completed', executionId });
      res.end();
      console.log('🔍 [DEBUG] executePromptStream completed successfully');

    } catch (error: any) {
      console.error('❌ Claude Code SDK execution error:', error);
      console.log('🔍 [DEBUG] Error in executePromptStream:', error.stack);
      
      // Record the error in execution history
      if (this.executionHistoryService && executionId) {
        this.executionHistoryService.setError(executionId, error);
      }
      
      this.sendSSEEvent(res, 'error', { error: error.message, executionId });
      res.end();
      throw error;
    }
  }

  /**
   * Build prompt content from processed messages
   */
  buildPromptContent(processedPrompt: any, mcpServers: McpServer[]): string {
    let content = '';
    
    // Add system message if MCP servers are available
    if (mcpServers.length > 0) {
      const serverNames = mcpServers.map(s => s.name).join(', ');
      content += `System: You have access to the following MCP services: ${serverNames}. Use these tools to help accomplish the user's goals.\n\n`;
    }
    
    // Add all messages
    for (const message of processedPrompt.messages) {
      content += `${message.role}: ${message.content}\n\n`;
    }
    
    return content.trim();
  }

  /**
   * Build allowed tools list for Claude Code SDK
   */
  buildAllowedTools(mcpServers: McpServer[]): string[] {
    const allowedTools: string[] = [];
    
    // Add basic tools
    allowedTools.push('Read', 'Write', 'Bash');
    
    // Add MCP tools
    for (const server of mcpServers) {
      // Allow all tools from each server
      allowedTools.push(`mcp__${server.name}`);
    }
    
    return allowedTools;
  }

  /**
   * Handle messages from Claude Code SDK
   */
  handleClaudeCodeSDKMessage(
    message: ClaudeCodeSDKMessage, 
    res: Response, 
    executionId: string | null, 
    messageStarted: boolean
  ): void {
    // Record in execution history
    if (this.executionHistoryService && executionId) {
      this.executionHistoryService.addMessage(executionId, 'claude_code_sdk_message', message);
    }

    console.log('🔍 [DEBUG] Handling Claude Code SDK message:', message.type);
    
    // Add detailed logging for assistant messages with tool usage
    if (message.type === 'assistant' && message.message?.content) {
      for (const content of message.message.content) {
        if (content.type === 'tool_use') {
          console.log(`🔧 [DEBUG] Tool used: ${content.name}`);
          console.log(`📋 [DEBUG] Tool input:`, JSON.stringify(content.input, null, 2));
        } else if (content.type === 'text') {
          console.log(`💬 [DEBUG] Assistant text: ${content.text.substring(0, 100)}...`);
        }
      }
    }

    switch (message.type) {
      case 'system':
        if (message.subtype === 'init') {
          this.sendSSEEvent(res, 'system_init', {
            sessionId: message.session_id,
            cwd: message.cwd,
            tools: message.tools,
            mcpServers: message.mcp_servers,
            model: message.model,
            permissionMode: message.permissionMode
          });
        }
        break;

      case 'user':
        this.sendSSEEvent(res, 'user_message', {
          message: message.message,
          sessionId: message.session_id
        });
        break;

      case 'assistant':
        if (!messageStarted) {
          this.sendSSEEvent(res, 'message_start', {
            message: message.message
          });
        }

        // Handle assistant message content
        if (message.message && message.message.content) {
          for (let i = 0; i < message.message.content.length; i++) {
            const content = message.message.content[i];
            
            if (content.type === 'text') {
              this.sendSSEEvent(res, 'content_block_start', {
                index: i,
                content_block: { type: 'text', text: '' }
              });
              
              this.sendSSEEvent(res, 'content_block_delta', {
                index: i,
                delta: { type: 'text_delta', text: content.text }
              });
              
              this.sendSSEEvent(res, 'content_block_stop', {
                index: i
              });
            } else if (content.type === 'tool_use') {
              // Record tool usage in execution history
              if (this.executionHistoryService && executionId) {
                this.executionHistoryService.addToolUse(executionId, {
                  name: content.name,
                  input: content.input,
                  id: content.id
                });
              }
              
              this.sendSSEEvent(res, 'mcp_tool_use', {
                name: content.name,
                input: content.input,
                id: content.id
              });
            }
          }
        }

        this.sendSSEEvent(res, 'message_stop', {});
        break;

      case 'result':
        if (message.subtype === 'success') {
          this.sendSSEEvent(res, 'result_success', {
            result: message.result,
            sessionId: message.session_id,
            duration: message.duration_ms,
            cost: message.total_cost_usd,
            turns: message.num_turns
          });
        } else {
          this.sendSSEEvent(res, 'result_error', {
            error: message.subtype,
            sessionId: message.session_id,
            duration: message.duration_ms,
            turns: message.num_turns
          });
        }
        break;

      default:
        // Send unknown message types as-is for debugging
        this.sendSSEEvent(res, 'unknown', message);
    }
  }

  /**
   * Process prompt messages for parameter substitution
   * @deprecated Use shared utility from prompt-utils.js instead
   */
  processPrompt(prompt: Prompt, parameters: Record<string, any>): any {
    return processPrompt(prompt, parameters);
  }

  /**
   * Build system message for Claude
   */
  buildSystemMessage(mcpServers: McpServer[]): string {
    const serverNames = mcpServers.map(s => s.name).join(', ');
    return `You have access to the following MCP services: ${serverNames}. Use these tools to help the user accomplish their goals.`;
  }

  /**
   * Send Server-Sent Event
   */
  sendSSEEvent(res: Response, event: string, data: any): void {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  /**
   * Execute a prompt without streaming (for testing/debugging)
   */
  async executePrompt(
    prompt: Prompt, 
    parameters: Record<string, any>, 
    configManager: any, 
    authManager: any
  ): Promise<any> {
    const processedPrompt = processPrompt(prompt, parameters);
    const mcpServers = configManager.prepareMcpServersForClaude(
      prompt.mcp_servers, 
      authManager
    );

    // Configure MCP servers
    const mcpConfigPath = await this.configureMcpServers(mcpServers, authManager);

    // Build prompt content
    const promptContent = this.buildPromptContent(processedPrompt, mcpServers);

    // Prepare Claude Code SDK options
    const options = {
      maxTurns: 10,
      cwd: this.tempDir,
      mcpConfig: mcpConfigPath,
      outputFormat: 'json',
      allowedTools: this.buildAllowedTools(mcpServers),
      permissionMode: 'acceptEdits'
    } as any;

    try {
      const messages: SDKMessage[] = [];
      
      for await (const message of query({
        prompt: promptContent,
        abortController: new AbortController(),
        options
      })) {
        messages.push(message);
      }
      
      // Find the result message
      const resultMessage = messages.find(m => m.type === 'result' && m.subtype === 'success');
      const assistantMessages = messages.filter(m => m.type === 'assistant');
      
      if (resultMessage) {
        return {
          content: resultMessage.result,
          messages: assistantMessages,
          metadata: {
            sessionId: resultMessage.session_id,
            duration: resultMessage.duration_ms,
            cost: resultMessage.total_cost_usd,
            turns: resultMessage.num_turns
          }
        };
      } else {
        throw new Error('No successful result found in Claude Code SDK response');
      }
    } catch (error: any) {
      throw new Error(`Claude Code SDK execution failed: ${error.message}`);
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanup(): Promise<void> {
    try {
      await fs.remove(this.tempDir);
      console.log('🧹 Cleaned up Claude Code SDK service temporary files');
    } catch (error: any) {
      console.warn('Warning: Failed to clean up temporary files:', error.message);
    }
  }
}
