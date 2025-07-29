import { v4 as uuidv4 } from 'uuid';

/**
 * Service for managing prompt execution history
 */
export class ExecutionHistoryService {
  constructor() {
    // In-memory storage for execution history
    this.executions = new Map(); // UUID -> execution record
    this.promptExecutions = new Map(); // promptName -> array of UUIDs
  }

  /**
   * Create a new execution record
   * @param {string} promptName - Name of the prompt being executed
   * @param {Object} parameters - Parameters used for execution
   * @param {string} userEmail - Email of the user executing the prompt
   * @returns {string} UUID of the created execution
   */
  createExecution(promptName, parameters, userEmail) {
    const executionId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const execution = {
      id: executionId,
      promptName,
      parameters,
      userEmail,
      timestamp,
      startTime: Date.now(),
      status: 'running',
      messages: [], // Store all streaming messages/chunks
      toolUses: [], // Store MCP tool usage
      toolResults: [], // Store MCP tool results
      response: null, // Final response when completed
      error: null,
      endTime: null,
      duration: null
    };

    this.executions.set(executionId, execution);
    
    // Add to prompt-specific list
    if (!this.promptExecutions.has(promptName)) {
      this.promptExecutions.set(promptName, []);
    }
    this.promptExecutions.get(promptName).unshift(executionId); // Add to beginning for latest-first

    console.log(`📝 Created execution record: ${executionId} for prompt: ${promptName}`);
    return executionId;
  }

  /**
   * Update execution status
   * @param {string} executionId - UUID of the execution
   * @param {string} status - New status ('running', 'completed', 'error')
   */
  updateStatus(executionId, status) {
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
   * @param {string} executionId - UUID of the execution
   * @param {string} type - Type of message (content_block_delta, message_start, etc.)
   * @param {Object} data - Message data
   */
  addMessage(executionId, type, data) {
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
   * @param {string} executionId - UUID of the execution
   * @param {Object} toolUse - Tool usage data
   */
  addToolUse(executionId, toolUse) {
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
   * @param {string} executionId - UUID of the execution
   * @param {Object} toolResult - Tool result data
   */
  addToolResult(executionId, toolResult) {
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
   * @param {string} executionId - UUID of the execution
   * @param {Object} response - Final response data
   */
  setResponse(executionId, response) {
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.response = response;
    }
  }

  /**
   * Set error information for an execution
   * @param {string} executionId - UUID of the execution
   * @param {Error} error - Error that occurred
   */
  setError(executionId, error) {
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
   * @param {string} executionId - UUID of the execution
   * @returns {Object|null} Execution record or null if not found
   */
  getExecution(executionId) {
    return this.executions.get(executionId) || null;
  }

  /**
   * Get execution history for a specific prompt
   * @param {string} promptName - Name of the prompt
   * @param {number} limit - Maximum number of executions to return
   * @returns {Array} Array of execution records
   */
  getPromptHistory(promptName, limit = 50) {
    const executionIds = this.promptExecutions.get(promptName) || [];
    return executionIds
      .slice(0, limit)
      .map(id => this.executions.get(id))
      .filter(Boolean);
  }

  /**
   * Get all execution history
   * @param {number} limit - Maximum number of executions to return
   * @returns {Array} Array of all execution records
   */
  getAllHistory(limit = 100) {
    const allExecutions = Array.from(this.executions.values());
    return allExecutions
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Get summary statistics
   * @returns {Object} Summary statistics
   */
  getStats() {
    const allExecutions = Array.from(this.executions.values());
    const totalExecutions = allExecutions.length;
    const completedExecutions = allExecutions.filter(e => e.status === 'completed').length;
    const errorExecutions = allExecutions.filter(e => e.status === 'error').length;
    const runningExecutions = allExecutions.filter(e => e.status === 'running').length;

    return {
      total: totalExecutions,
      completed: completedExecutions,
      errors: errorExecutions,
      running: runningExecutions,
      prompts: this.promptExecutions.size
    };
  }

  /**
   * Extract text content from execution messages
   * @param {string} executionId - UUID of the execution
   * @returns {string} Concatenated text content
   */
  getExecutionText(executionId) {
    const execution = this.executions.get(executionId);
    if (!execution) return '';

    return execution.messages
      .filter(msg => msg.type === 'content_block_delta' && msg.data.delta && msg.data.delta.text)
      .map(msg => msg.data.delta.text)
      .join('');
  }
}
