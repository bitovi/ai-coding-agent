import { Anthropic } from '@anthropic-ai/sdk';
import { Response } from 'express';
import { processPrompt } from '../../../public/js/prompt-utils.js';
import type { Prompt } from '../../types/index.js';
import type { ExecutionHistoryProvider } from '../ExecutionHistoryProvider.js';

/**
 * Service for interacting with Claude API using Anthropic SDK
 */
export class ClaudeAnthropicSDK {
  private anthropic: Anthropic;
  private executionHistoryService: ExecutionHistoryProvider | null;

  constructor(executionHistoryService: ExecutionHistoryProvider | null = null) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    this.executionHistoryService = executionHistoryService;
  }

  /**
   * Set the execution history service (used during app initialization)
   */
  setExecutionHistoryService(executionHistoryService: ExecutionHistoryProvider): void {
    this.executionHistoryService = executionHistoryService;
  }

  /**
   * Execute a prompt with streaming response
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
      // Create execution record
      if (this.executionHistoryService) {
        executionId = this.executionHistoryService.createExecution(
          prompt.name,
          parameters,
          userEmail
        );
      }

      // Process prompt with parameter substitution
      const processedPrompt = processPrompt(prompt, parameters);
      
      // Prepare MCP servers configuration
      const mcpServers = configManager.prepareMcpServersForClaude(
        prompt.mcp_servers, 
        authManager
      );

      // Set up SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send initial status
      this.sendSSEEvent(res, 'status', { message: 'Starting prompt execution...', executionId });

      // Create Claude message
      const response = await this.anthropic.beta.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        system: this.buildSystemMessage(mcpServers),
        messages: processedPrompt.messages,
        mcp_servers: mcpServers,
        stream: true
      } as any, {
        headers: {
          "anthropic-beta": "mcp-client-2025-04-04"
        }
      });

      // Stream the response
      for await (const chunk of response as any) {
        this.handleStreamChunk(chunk, res, executionId);
      }

      // Mark execution as completed
      if (this.executionHistoryService && executionId) {
        this.executionHistoryService.updateStatus(executionId, 'completed');
      }

      // Send completion event
      this.sendSSEEvent(res, 'complete', { message: 'Prompt execution completed', executionId });
      res.end();

    } catch (error: any) {
      console.error('❌ Claude execution error:', error);
      
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
   * Process prompt messages for parameter substitution
   * @deprecated Use shared utility from prompt-utils.js instead
   */
  processPrompt(prompt: Prompt, parameters: Record<string, any>): any {
    return processPrompt(prompt, parameters);
  }

  /**
   * Build system message for Claude
   */
  buildSystemMessage(mcpServers: any[]): string {
    const serverNames = mcpServers.map(s => s.name).join(', ');
    return `You have access to the following MCP services: ${serverNames}. Use these tools to help the user accomplish their goals.`;
  }

  /**
   * Handle streaming chunks from Claude
   */
  handleStreamChunk(chunk: any, res: Response, executionId: string | null = null): void {
    // Record the chunk in execution history
    if (this.executionHistoryService && executionId) {
      this.executionHistoryService.addMessage(executionId, chunk.type, chunk);
    }

    switch (chunk.type) {
      case 'message_start':
        this.sendSSEEvent(res, 'message_start', {
          message: chunk.message
        });
        break;
        
      case 'content_block_start':
        this.sendSSEEvent(res, 'content_block_start', {
          index: chunk.index,
          content_block: chunk.content_block
        });
        break;
        
      case 'content_block_delta':
        this.sendSSEEvent(res, 'content_block_delta', {
          index: chunk.index,
          delta: chunk.delta
        });
        break;
        
      case 'content_block_stop':
        this.sendSSEEvent(res, 'content_block_stop', {
          index: chunk.index
        });
        break;
        
      case 'message_delta':
        this.sendSSEEvent(res, 'message_delta', {
          delta: chunk.delta
        });
        break;
        
      case 'message_stop':
        this.sendSSEEvent(res, 'message_stop', {});
        break;

      case 'mcp_tool_use':
        // Record tool usage in execution history
        if (this.executionHistoryService && executionId) {
          this.executionHistoryService.addToolUse(executionId, {
            server_name: chunk.server_name,
            name: chunk.name,
            input: chunk.input
          });
        }
        
        this.sendSSEEvent(res, 'mcp_tool_use', {
          server_name: chunk.server_name,
          name: chunk.name,
          input: chunk.input
        });
        break;

      case 'mcp_tool_result':
        // Record tool result in execution history
        if (this.executionHistoryService && executionId) {
          this.executionHistoryService.addToolResult(executionId, {
            tool_use_id: chunk.tool_use_id,
            is_error: chunk.is_error,
            content: chunk.content
          });
        }
        
        this.sendSSEEvent(res, 'mcp_tool_result', {
          tool_use_id: chunk.tool_use_id,
          is_error: chunk.is_error,
          content: chunk.content
        });
        break;
        
      default:
        // Send unknown chunk types as-is for debugging
        this.sendSSEEvent(res, 'unknown', chunk);
    }
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

    const response = await this.anthropic.beta.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      system: this.buildSystemMessage(mcpServers),
      messages: processedPrompt.messages,
      mcp_servers: mcpServers
    } as any, {
      headers: {
        "anthropic-beta": "mcp-client-2025-04-04"
      }
    });

    return response;
  }
}
