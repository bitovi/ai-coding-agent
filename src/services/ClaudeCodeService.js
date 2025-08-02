import { spawn, exec } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import { processPrompt } from '../../public/js/prompt-utils.js';

const execAsync = promisify(exec);

/**
 * Service for interacting with Claude Code CLI instead of the TypeScript SDK
 * Implements the same interface as ClaudeAnthropicSDK but uses `claude` CLI commands
 */
export class ClaudeCodeService {
  constructor(executionHistoryService = null) {
    this.executionHistoryService = executionHistoryService;
    
    // Use WORKING_DIR environment variable if set, otherwise fall back to temp directory
    let baseDir;
    if (process.env.WORKING_DIR) {
      // Resolve relative paths to absolute paths
      baseDir = path.resolve(process.env.WORKING_DIR);
    } else {
      baseDir = os.tmpdir();
    }
    
    this.tempDir = path.join(baseDir, 'claude-code-service');
    this.mcpConfigPath = path.join(this.tempDir, '.mcp.json');
    
    console.log('🔍 [DEBUG] Claude Code working directory:', this.tempDir);
    
    // Cache for Claude command path
    this.claudeCommandCache = null;
    
    // Ensure temp directory exists
    fs.ensureDirSync(this.tempDir);
    
    // Validate Claude Code CLI is available
    this.validateCLI();
  }

  /**
   * Get the path to the Claude CLI command
   * @returns {Promise<string>} Path to claude command
   */
  async getClaudeCommand() {
    // Return cached result if available
    if (this.claudeCommandCache) {
      return this.claudeCommandCache;
    }

    const { access, constants } = await import('fs/promises');
    const path = await import('path');
    
    // Try local installation first (node_modules) - use absolute path
    const localPath = path.resolve('./node_modules/.bin/claude');
    try {
      await access(localPath, constants.F_OK | constants.X_OK);
      console.log('🔍 [DEBUG] Using local Claude installation:', localPath);
      this.claudeCommandCache = localPath;
      return localPath;
    } catch (error) {
      console.log('🔍 [DEBUG] Local Claude not found:', error.message);
      
      // Local installation not found, try global
      try {
        const { stdout } = await execAsync('which claude');
        const globalPath = stdout.trim();
        if (globalPath) {
          await access(globalPath, constants.F_OK | constants.X_OK);
          console.log('🔍 [DEBUG] Using global Claude installation:', globalPath);
          this.claudeCommandCache = globalPath;
          return globalPath;
        }
      } catch (globalError) {
        console.log('🔍 [DEBUG] Global Claude not found:', globalError.message);
        
        // Last resort: try just 'claude' and let the system find it
        try {
          await execAsync('claude --version');
          console.log('🔍 [DEBUG] Using system Claude command');
          this.claudeCommandCache = 'claude';
          return 'claude';
        } catch (systemError) {
          console.error('❌ Claude Code CLI not found anywhere');
          throw new Error('Claude Code CLI not found. Install with: npm install @anthropic-ai/claude-code');
        }
      }
    }
  }

  /**
   * Validate that Claude Code CLI is available
   */
  async validateCLI() {
    try {
      const claudeCmd = await this.getClaudeCommand();
      await execAsync(`${claudeCmd} --version`);
    } catch (error) {
      throw new Error('Claude Code CLI is not installed or not in PATH. Please install with: npm install @anthropic-ai/claude-code');
    }
  }

  /**
   * Set the execution history service (used during app initialization)
   */
  setExecutionHistoryService(executionHistoryService) {
    this.executionHistoryService = executionHistoryService;
  }

  /**
   * Configure MCP servers dynamically for Claude Code
   */
  async configureMcpServers(mcpServers, authManager) {
    const mcpConfig = {
      mcpServers: {}
    };

    for (const server of mcpServers) {
      const serverConfig = {
        type: server.type
      };

      if (server.type === 'stdio') {
        serverConfig.command = server.command;
        if (server.args) {
          serverConfig.args = server.args;
        }
        if (server.env) {
          serverConfig.env = server.env;
        }
      } else if (server.type === 'sse') {
        serverConfig.url = server.url;
        if (server.authorization_token) {
          serverConfig.headers = {
            'Authorization': `Bearer ${server.authorization_token}`
          };
        }
      } else if (server.type === 'http') {
        serverConfig.url = server.url;
        if (server.authorization_token) {
          serverConfig.headers = {
            'Authorization': `Bearer ${server.authorization_token}`
          };
        }
      }

      mcpConfig.mcpServers[server.name] = serverConfig;
    }

    // Write MCP configuration to temporary file
    await fs.writeJson(this.mcpConfigPath, mcpConfig, { spaces: 2 });
    
    console.log(`📝 Configured ${mcpServers.length} MCP servers for Claude Code`);
    return this.mcpConfigPath;
  }

  /**
   * Execute a prompt with streaming response using Claude Code CLI
   */
  async executePromptStream(prompt, parameters, configManager, authManager, res, userEmail = 'unknown') {
    let executionId = null;
    
    try {
      console.log('🔍 [DEBUG] Starting executePromptStream...');
      
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

      // Configure MCP servers for Claude Code
      console.log('🔍 [DEBUG] Configuring MCP servers for Claude Code...');
      await this.configureMcpServers(mcpServers, authManager);

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
      this.sendSSEEvent(res, 'status', { message: 'Starting Claude Code execution...', executionId });

      // Build the prompt content for Claude Code
      console.log('🔍 [DEBUG] Building prompt content...');
      const promptContent = this.buildPromptContent(processedPrompt, mcpServers);
      console.log('🔍 [DEBUG] Prompt content length:', promptContent.length);
      console.log('🔍 [DEBUG] Prompt content preview:', promptContent.substring(0, 200) + '...');
      
      // Execute Claude Code CLI
      console.log('🔍 [DEBUG] About to execute Claude Code CLI...');
      await this.executeClaude(promptContent, res, executionId);

      // Mark execution as completed
      console.log('🔍 [DEBUG] Claude execution completed, updating status...');
      if (this.executionHistoryService && executionId) {
        this.executionHistoryService.updateStatus(executionId, 'completed');
      }

      // Send completion event
      this.sendSSEEvent(res, 'complete', { message: 'Claude Code execution completed', executionId });
      res.end();
      console.log('🔍 [DEBUG] executePromptStream completed successfully');

    } catch (error) {
      console.error('❌ Claude Code execution error:', error);
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
  buildPromptContent(processedPrompt, mcpServers) {
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
   * Execute Claude Code CLI with streaming output
   */
  async executeClaude(promptContent, res, executionId) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('🔍 [DEBUG] Starting executeClaude...');
        const claudeCmd = await this.getClaudeCommand();
        console.log('🔍 [DEBUG] Claude command path:', claudeCmd);
        
        // Verify command exists and is executable
        const { access, constants } = await import('fs/promises');
        try {
          await access(claudeCmd, constants.F_OK | constants.X_OK);
        } catch (error) {
          throw new Error(`Claude Code not found or not executable: ${claudeCmd}`);
        }
        
        // Verify temp directory and MCP config exist
        if (!await fs.pathExists(this.tempDir)) {
          throw new Error(`Temp directory does not exist: ${this.tempDir}`);
        }
        if (!await fs.pathExists(this.mcpConfigPath)) {
          console.warn('🔍 [DEBUG] MCP config file does not exist, creating empty config');
          await fs.writeJson(this.mcpConfigPath, { mcpServers: {} });
        }
        
        // Prepare Claude Code command - use stdin for prompt content
        const args = [
          '-p', // Print mode
          '--output-format', 'stream-json', // Streaming JSON output
          '--verbose', // Verbose for better debugging
          '--max-turns', '10', // Limit turns for safety
          '--dangerously-skip-permissions', // Skip permission prompts for tools
          // Note: promptContent will be passed via stdin, not as argument
        ];

        // Set working directory to our temp directory with MCP config
        const options = {
          cwd: this.tempDir,
          env: {
            ...process.env,
            // Ensure MCP config is found
            MCP_CONFIG_PATH: this.mcpConfigPath
          }
        };

        console.log('🔍 [DEBUG] Command args:', args);
        console.log('🔍 [DEBUG] Working directory:', this.tempDir);
        console.log('🔍 [DEBUG] MCP config path:', this.mcpConfigPath);
        console.log('🔍 [DEBUG] Prompt content length:', promptContent.length);
        console.log(`🚀 Executing Claude Code: ${claudeCmd} ${args.join(' ')}`);
        
        const claudeProcess = spawn(claudeCmd, args, options);
        console.log('🔍 [DEBUG] Process spawned, PID:', claudeProcess.pid);
        
        // Write prompt content to stdin
        console.log('🔍 [DEBUG] Writing prompt to stdin...');
        try {
          claudeProcess.stdin.write(promptContent);
          claudeProcess.stdin.end();
          console.log('🔍 [DEBUG] Prompt written to stdin and closed');
        } catch (stdinError) {
          console.error('🔍 [DEBUG] Error writing to stdin:', stdinError);
          claudeProcess.kill('SIGTERM');
          reject(new Error(`Failed to write prompt to Claude Code stdin: ${stdinError.message}`));
          return;
        }
        
        // Handle stdin errors
        claudeProcess.stdin.on('error', (stdinError) => {
          console.error('🔍 [DEBUG] stdin error:', stdinError);
          if (!claudeProcess.killed) {
            claudeProcess.kill('SIGTERM');
            reject(new Error(`Claude Code stdin error: ${stdinError.message}`));
          }
        });
      
      let accumulatedData = '';
      let messageStarted = false;
      let dataReceived = false;
      let contentBlockStarted = false;

      claudeProcess.stdout.on('data', (data) => {
        console.log('🔍 [DEBUG] stdout data received, length:', data.length);
        console.log('🔍 [DEBUG] stdout data preview:', data.toString().substring(0, 200) + '...');
        dataReceived = true;
        const chunk = data.toString();
        accumulatedData += chunk;
        
        console.log('🔍 [DEBUG] Processing chunk, accumulated length:', accumulatedData.length);
        
        // Process complete JSON lines (split on actual newlines, not escaped)
        const lines = accumulatedData.split('\n');
        accumulatedData = lines.pop(); // Keep incomplete line
        
        console.log('🔍 [DEBUG] Found', lines.length, 'complete lines to process');
        
        for (const line of lines) {
          if (line.trim()) {
            console.log('🔍 [DEBUG] Processing line:', line.substring(0, 200) + '...');
            
            let processedAsJson = false;
            
            // Try to parse as JSON first
            try {
              const jsonData = JSON.parse(line);
              console.log('🔍 [DEBUG] Parsed JSON type:', jsonData.type || 'unknown type');
              console.log('🔍 [DEBUG] Parsed JSON keys:', Object.keys(jsonData));
              
              // Only process if it's a valid Claude Code JSON response
              if (jsonData.type || jsonData.role || jsonData.message) {
                this.handleClaudeCodeOutput(jsonData, res, executionId);
                processedAsJson = true;
                
                // Track if we've started receiving message content - check for various content types
                if (jsonData.type === 'assistant' || 
                    jsonData.type === 'result' || 
                    jsonData.type === 'content' || 
                    jsonData.type === 'text' || 
                    jsonData.type === 'message_delta' ||
                    (jsonData.role === 'assistant' && jsonData.content)) {
                  if (!messageStarted) {
                    console.log('🔍 [DEBUG] Starting message output via JSON...');
                    messageStarted = true;
                    this.sendSSEEvent(res, 'message_start', {
                      message: { role: 'assistant', content: [] }
                    });
                  }
                  if (!contentBlockStarted) {
                    console.log('🔍 [DEBUG] Starting content block...');
                    contentBlockStarted = true;
                    this.sendSSEEvent(res, 'content_block_start', {
                      index: 0,
                      content_block: { type: 'text', text: '' }
                    });
                  }
                }
              }
              
            } catch (error) {
              console.log('🔍 [DEBUG] JSON parse error:', error.message);
              // Will be processed as plain text below
            }
            
            // Only process as plain text if it wasn't successfully processed as JSON
            if (!processedAsJson && line.trim()) {
              console.log('🔍 [DEBUG] Processing as plain text:', JSON.stringify(line));
              this.handlePlainTextOutput(line, res, executionId, messageStarted);
              
              if (!messageStarted) {
                console.log('🔍 [DEBUG] Starting plain text message output...');
                messageStarted = true;
                this.sendSSEEvent(res, 'message_start', {
                  message: { role: 'assistant', content: [] }
                });
              }
              if (!contentBlockStarted) {
                console.log('🔍 [DEBUG] Starting content block for plain text...');
                contentBlockStarted = true;
                this.sendSSEEvent(res, 'content_block_start', {
                  index: 0,
                  content_block: { type: 'text', text: '' }
                });
              }
            }
          }
        }
      });

      claudeProcess.stderr.on('data', (data) => {
        const errorMsg = data.toString();
        console.log('🔍 [DEBUG] stderr received:', errorMsg);
        console.error('Claude Code stderr:', errorMsg);
        
        // Check for critical errors that should terminate the process
        if (errorMsg.includes('command not found') || 
            errorMsg.includes('permission denied') ||
            errorMsg.includes('No such file') ||
            errorMsg.includes('ENOENT')) {
          console.error('🔍 [DEBUG] Critical error detected, terminating process');
          claudeProcess.kill('SIGTERM');
          reject(new Error(`Claude Code critical error: ${errorMsg.trim()}`));
          return;
        }
        
        // Send as a status update rather than error to keep stream alive
        this.sendSSEEvent(res, 'status', { 
          message: `Claude Code: ${errorMsg.trim()}`,
          type: 'stderr'
        });
      });

      claudeProcess.on('close', (code) => {
        console.log('🔍 [DEBUG] Process closed with code:', code);
        console.log('🔍 [DEBUG] Data received:', dataReceived);
        console.log('🔍 [DEBUG] Message started:', messageStarted);
        console.log('🔍 [DEBUG] Content block started:', contentBlockStarted);
        
        // Clear timeout if it exists
        if (timeout) {
          clearTimeout(timeout);
        }
        
        if (contentBlockStarted) {
          this.sendSSEEvent(res, 'content_block_stop', { index: 0 });
        }
        if (messageStarted) {
          this.sendSSEEvent(res, 'message_stop', {});
        }
        
        if (code === 0) {
          console.log('🔍 [DEBUG] Resolving promise with success');
          resolve();
        } else {
          console.log('🔍 [DEBUG] Rejecting promise with error code:', code);
          const errorMessage = `Claude Code process exited with code ${code}`;
          console.error('❌', errorMessage);
          reject(new Error(errorMessage));
        }
      });

      claudeProcess.on('error', (error) => {
        console.log('🔍 [DEBUG] Process error:', error.message);
        console.error('❌ Failed to start Claude Code process:', error);
        
        // Clear timeout if it exists
        if (timeout) {
          clearTimeout(timeout);
        }
        
        reject(new Error(`Failed to start Claude Code: ${error.message}`));
      });
      
      // Add timeout to detect hanging processes (configurable via CLAUDE_CODE_TIMEOUT_MS)
      const timeoutMs = parseInt(process.env.CLAUDE_CODE_TIMEOUT_MS) || 1800000; // Default 30 minutes
      const timeoutMinutes = Math.round(timeoutMs / 60000);
      
      console.log(`🔍 [DEBUG] Setting Claude Code timeout to ${timeoutMinutes} minutes (${timeoutMs}ms)`);
      
      const timeout = setTimeout(() => {
        console.log('🔍 [DEBUG] Process timeout - killing process');
        console.error(`❌ Claude Code process timed out after ${timeoutMinutes} minutes`);
        claudeProcess.kill('SIGTERM');
        
        // Give it a moment to terminate gracefully, then force kill
        setTimeout(() => {
          if (!claudeProcess.killed) {
            console.log('🔍 [DEBUG] Force killing process with SIGKILL');
            claudeProcess.kill('SIGKILL');
          }
        }, 5000);
        
        reject(new Error(`Claude Code process timed out after ${timeoutMinutes} minutes`));
      }, timeoutMs);
      
      } catch (error) {
        console.log('🔍 [DEBUG] Outer catch error:', error.message);
        reject(error);
      }
    });
  }

  /**
   * Handle structured JSON output from Claude Code
   */
  handleClaudeCodeOutput(jsonData, res, executionId) {
    // Record in execution history
    if (this.executionHistoryService && executionId) {
      this.executionHistoryService.addMessage(executionId, 'claude_code_output', jsonData);
    }

    // Map Claude Code output to Claude API format
    switch (jsonData.type) {
      case 'assistant':
        // Handle assistant message response
        if (jsonData.message && jsonData.message.content) {
          for (const contentBlock of jsonData.message.content) {
            if (contentBlock.type === 'text' && contentBlock.text) {
              this.sendSSEEvent(res, 'content_block_delta', {
                index: 0,
                delta: { type: 'text_delta', text: contentBlock.text }
              });
            }
          }
        }
        // Handle direct content property
        else if (jsonData.content) {
          this.sendSSEEvent(res, 'content_block_delta', {
            index: 0,
            delta: { type: 'text_delta', text: jsonData.content }
          });
        }
        break;
        
      case 'content':
      case 'text':
        // Handle direct content/text responses
        const textContent = jsonData.content || jsonData.text;
        if (textContent) {
          this.sendSSEEvent(res, 'content_block_delta', {
            index: 0,
            delta: { type: 'text_delta', text: textContent }
          });
        }
        break;
        
      case 'system':
        // Handle system messages (like init) - don't send as content
        this.sendSSEEvent(res, 'status', {
          message: `Claude Code System: ${jsonData.subtype || jsonData.message || 'message'}`,
          type: 'system'
        });
        break;
        
      case 'result':
        // Handle final result - DON'T send as content since it duplicates the assistant message
        // Just send as a status update for debugging/completion info
        this.sendSSEEvent(res, 'status', {
          message: `Claude Code completed in ${jsonData.duration_ms}ms (${jsonData.num_turns} turns)`,
          type: 'result',
          duration_ms: jsonData.duration_ms,
          num_turns: jsonData.num_turns,
          is_error: jsonData.is_error
        });
        break;
        
      case 'tool_use':
        // Record tool usage
        if (this.executionHistoryService && executionId) {
          this.executionHistoryService.addToolUse(executionId, {
            server_name: jsonData.server || 'unknown',
            name: jsonData.name || jsonData.tool,
            input: jsonData.input || jsonData.arguments
          });
        }
        
        this.sendSSEEvent(res, 'mcp_tool_use', {
          server_name: jsonData.server || 'unknown',
          name: jsonData.name || jsonData.tool,
          input: jsonData.input || jsonData.arguments
        });
        break;
        
      case 'tool_result':
        // Record tool result
        if (this.executionHistoryService && executionId) {
          this.executionHistoryService.addToolResult(executionId, {
            tool_use_id: jsonData.tool_use_id || 'unknown',
            is_error: jsonData.is_error || false,
            content: jsonData.content || jsonData.result
          });
        }
        
        this.sendSSEEvent(res, 'mcp_tool_result', {
          tool_use_id: jsonData.tool_use_id || 'unknown',
          is_error: jsonData.is_error || false,
          content: jsonData.content || jsonData.result
        });
        break;
        
      case 'error':
        this.sendSSEEvent(res, 'error', {
          error: jsonData.message || jsonData.error || 'Unknown error'
        });
        break;
        
      default:
        // For unknown types, check if it has content we should display
        if (jsonData.role === 'assistant' && jsonData.content) {
          // Handle assistant response with content
          if (Array.isArray(jsonData.content)) {
            for (const contentBlock of jsonData.content) {
              if (contentBlock.type === 'text' && contentBlock.text) {
                this.sendSSEEvent(res, 'content_block_delta', {
                  index: 0,
                  delta: { type: 'text_delta', text: contentBlock.text }
                });
              }
            }
          } else if (typeof jsonData.content === 'string') {
            this.sendSSEEvent(res, 'content_block_delta', {
              index: 0,
              delta: { type: 'text_delta', text: jsonData.content }
            });
          }
        } else {
          // Send unknown types as status updates (not content)
          this.sendSSEEvent(res, 'status', {
            message: `Claude Code Unknown: ${JSON.stringify(jsonData).substring(0, 200)}...`,
            type: 'unknown'
          });
        }
    }
  }

  /**
   * Handle plain text output from Claude Code
   */
  handlePlainTextOutput(text, res, executionId, messageStarted) {
    // Record in execution history
    if (this.executionHistoryService && executionId) {
      this.executionHistoryService.addMessage(executionId, 'text_output', { text });
    }

    // Send as content delta
    this.sendSSEEvent(res, 'content_block_delta', {
      index: 0,
      delta: { type: 'text_delta', text: text + '\n' }
    });
  }

  /**
   * Process prompt messages for parameter substitution
   * @deprecated Use shared utility from prompt-utils.js instead
   */
  processPrompt(prompt, parameters) {
    return processPrompt(prompt, parameters);
  }

  /**
   * Build system message for Claude
   */
  buildSystemMessage(mcpServers) {
    const serverNames = mcpServers.map(s => s.name).join(', ');
    return `You have access to the following MCP services: ${serverNames}. Use these tools to help the user accomplish their goals.`;
  }

  /**
   * Send Server-Sent Event
   */
  sendSSEEvent(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  /**
   * Execute a prompt without streaming (for testing/debugging)
   */
  async executePrompt(prompt, parameters, configManager, authManager) {
    const processedPrompt = processPrompt(prompt, parameters);
    const mcpServers = configManager.prepareMcpServersForClaude(
      prompt.mcp_servers, 
      authManager
    );

    // Configure MCP servers
    await this.configureMcpServers(mcpServers, authManager);

    // Build prompt content
    const promptContent = this.buildPromptContent(processedPrompt, mcpServers);

    // Execute Claude Code
    const args = [
      '-p', // Print mode
      '--output-format', 'json', // JSON output
      '--max-turns', '10',
      promptContent
    ];

    const options = {
      cwd: this.tempDir,
      env: {
        ...process.env,
        MCP_CONFIG_PATH: this.mcpConfigPath
      }
    };

    try {
      const claudeCmd = await this.getClaudeCommand();
      const { stdout, stderr } = await execAsync(`${claudeCmd} ${args.map(arg => `"${arg}"`).join(' ')}`, options);
      
      if (stderr) {
        console.warn('Claude Code stderr:', stderr);
      }
      
      // Try to parse as JSON, fall back to plain text
      try {
        return JSON.parse(stdout);
      } catch {
        return {
          content: [{ type: 'text', text: stdout }],
          role: 'assistant'
        };
      }
    } catch (error) {
      throw new Error(`Claude Code execution failed: ${error.message}`);
    }
  }

  /**
   * Add MCP server dynamically to Claude Code
   */
  async addMcpServer(serverName, serverConfig, scope = 'local') {
    const args = ['mcp', 'add', '-s', scope, serverName];
    
    if (serverConfig.type === 'stdio') {
      args.push('--');
      args.push(serverConfig.command);
      if (serverConfig.args) {
        args.push(...serverConfig.args);
      }
      
      // Add environment variables
      if (serverConfig.env) {
        for (const [key, value] of Object.entries(serverConfig.env)) {
          args.splice(-1, 0, '-e', `${key}=${value}`);
        }
      }
    } else if (serverConfig.type === 'sse') {
      args.splice(2, 0, '--transport', 'sse');
      args.push(serverConfig.url);
      
      // Add headers for authorization
      if (serverConfig.headers) {
        for (const [key, value] of Object.entries(serverConfig.headers)) {
          args.push('--header', `${key}: ${value}`);
        }
      }
    } else if (serverConfig.type === 'http') {
      args.splice(2, 0, '--transport', 'http');
      args.push(serverConfig.url);
      
      // Add headers for authorization
      if (serverConfig.headers) {
        for (const [key, value] of Object.entries(serverConfig.headers)) {
          args.push('--header', `${key}: ${value}`);
        }
      }
    }

    try {
      const claudeCmd = await this.getClaudeCommand();
      const { stdout, stderr } = await execAsync(`${claudeCmd} ${args.join(' ')}`);
      console.log(`✅ Added MCP server: ${serverName}`);
      return { success: true, stdout, stderr };
    } catch (error) {
      console.error(`❌ Failed to add MCP server ${serverName}:`, error.message);
      throw error;
    }
  }

  /**
   * List configured MCP servers in Claude Code
   */
  async listMcpServers() {
    try {
      const claudeCmd = await this.getClaudeCommand();
      const { stdout } = await execAsync(`${claudeCmd} mcp list`);
      return stdout.trim();
    } catch (error) {
      console.error('❌ Failed to list MCP servers:', error.message);
      throw error;
    }
  }

  /**
   * Remove MCP server from Claude Code
   */
  async removeMcpServer(serverName) {
    try {
      const claudeCmd = await this.getClaudeCommand();
      const { stdout } = await execAsync(`${claudeCmd} mcp remove ${serverName}`);
      console.log(`🗑️  Removed MCP server: ${serverName}`);
      return stdout.trim();
    } catch (error) {
      console.error(`❌ Failed to remove MCP server ${serverName}:`, error.message);
      throw error;
    }
  }

  /**
   * Clear the cached Claude command path (useful for testing or if installation changes)
   */
  clearClaudeCommandCache() {
    this.claudeCommandCache = null;
    console.log('🔍 [DEBUG] Claude command cache cleared');
  }

  /**
   * Clean up temporary files
   */
  async cleanup() {
    try {
      await fs.remove(this.tempDir);
      console.log('🧹 Cleaned up Claude Code service temporary files');
    } catch (error) {
      console.warn('Warning: Failed to clean up temporary files:', error.message);
    }
  }
}
