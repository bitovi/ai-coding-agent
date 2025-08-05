import { v4 as uuidv4 } from 'uuid';

export interface ExecutionMessage {
  timestamp: string;
  type: string;
  data: any;
}

export interface ToolUse {
  timestamp: string;
  name: string;
  server_name?: string;
  [key: string]: any;
}

export interface ToolResult {
  timestamp: string;
  [key: string]: any;
}

export interface ExecutionError {
  message: string;
  type: string;
  timestamp: string;
}

export interface ExecutionRecord {
  id: string;
  promptName: string;
  parameters: Record<string, any>;
  userEmail: string;
  timestamp: string;
  startTime: number;
  status: 'running' | 'completed' | 'error';
  messages: ExecutionMessage[];
  toolUses: ToolUse[];
  toolResults: ToolResult[];
  response: any;
  error: ExecutionError | null;
  endTime: number | null;
  duration: number | null;
}

/**
 * Provider for managing prompt execution history data
 */
export class ExecutionHistoryProvider {
  private executions: Map<string, ExecutionRecord> = new Map();
  private promptExecutions: Map<string, string[]> = new Map();

  /**
   * Create a new execution record
   */
  createExecution(promptName: string, parameters: Record<string, any>, userEmail: string): string {
    const executionId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const execution: ExecutionRecord = {
      id: executionId,
      promptName,
      parameters,
      userEmail,
      timestamp,
      startTime: Date.now(),
      status: 'running',
      messages: [],
      toolUses: [],
      toolResults: [],
      response: null,
      error: null,
      endTime: null,
      duration: null
    };

    this.executions.set(executionId, execution);
    
    // Add to prompt-specific list
    if (!this.promptExecutions.has(promptName)) {
      this.promptExecutions.set(promptName, []);
    }
    this.promptExecutions.get(promptName)!.unshift(executionId); // Add to beginning for latest-first

    console.log(`📝 Created execution record: ${executionId} for prompt: ${promptName}`);
    return executionId;
  }

  /**
   * Update execution status
   */
  updateStatus(executionId: string, status: 'running' | 'completed' | 'error'): void {
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.status = status;
      if (status === 'completed' || status === 'error') {
        execution.endTime = Date.now();
        execution.duration = execution.endTime - execution.startTime;
      }
    }
  }

  /**
   * Add a streaming message chunk to the execution
   */
  addMessage(executionId: string, type: string, data: any): void {
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.messages.push({
        timestamp: new Date().toISOString(),
        type,
        data
      });
    }
  }

  /**
   * Add tool usage information
   */
  addToolUse(executionId: string, toolUse: { name: string; server_name?: string; [key: string]: any }): void {
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.toolUses.push({
        timestamp: new Date().toISOString(),
        ...toolUse
      });
    }
  }

  /**
   * Add tool result information
   */
  addToolResult(executionId: string, toolResult: { [key: string]: any }): void {
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.toolResults.push({
        timestamp: new Date().toISOString(),
        ...toolResult
      });
    }
  }

  /**
   * Set the final response for an execution
   */
  setResponse(executionId: string, response: any): void {
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.response = response;
    }
  }

  /**
   * Set error information for an execution
   */
  setError(executionId: string, error: Error): void {
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.error = {
        message: error.message,
        type: error.constructor.name,
        timestamp: new Date().toISOString()
      };
      this.updateStatus(executionId, 'error');
    }
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): ExecutionRecord | null {
    return this.executions.get(executionId) || null;
  }

  /**
   * Get execution history for a specific prompt
   */
  getPromptHistory(promptName: string, limit: number = 50): ExecutionRecord[] {
    const executionIds = this.promptExecutions.get(promptName) || [];
    return executionIds
      .slice(0, limit)
      .map(id => this.executions.get(id))
      .filter((execution): execution is ExecutionRecord => execution !== undefined);
  }

  /**
   * Get all execution history
   */
  getAllHistory(limit: number = 100): ExecutionRecord[] {
    const allExecutions = Array.from(this.executions.values());
    return allExecutions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Extract text content from execution messages
   */
  getExecutionText(executionId: string): string {
    const execution = this.executions.get(executionId);
    if (!execution) return '';

    return execution.messages
      .filter(msg => msg.type === 'content_block_delta' && msg.data.delta && msg.data.delta.text)
      .map(msg => msg.data.delta.text)
      .join('');
  }
}
