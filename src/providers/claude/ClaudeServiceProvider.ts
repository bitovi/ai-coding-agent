import { ClaudeAnthropicSDK } from './ClaudeAnthropicSDK.js';
import { ClaudeCodeService } from './ClaudeCodeService.js';
import { ClaudeCodeSDKService } from './ClaudeCodeSDKService.js';

interface ValidationResult {
  serviceType: string;
  isValid: boolean;
  messages: string[];
}

// Union type for Claude service instances
type ClaudeServiceInstance = ClaudeAnthropicSDK | ClaudeCodeService | ClaudeCodeSDKService;

/**
 * Provider for creating Claude service instances
 * Switches between Claude SDK, Claude Code CLI, and Claude Code SDK based on CLAUDE_SERVICE environment variable
 */
export class ClaudeServiceProvider {
  /**
   * Create a Claude service instance based on configuration
   * @param executionHistoryService - Optional execution history service
   * @returns The appropriate Claude service
   */
  static create(executionHistoryService: any = null): ClaudeServiceInstance {
    const claudeService = process.env.CLAUDE_SERVICE || 'CLAUDECODESDK';
    
    switch (claudeService.toUpperCase()) {
      case 'CLAUDECODESDK':
        console.log('🔧 Using Claude Code TypeScript SDK service');
        return new ClaudeCodeSDKService(executionHistoryService);
      
      case 'CLAUDECODE':
        console.log('🔧 Using Claude Code CLI service');
        return new ClaudeCodeService(executionHistoryService);
      
      case 'ANTHROPIC':
      default:
        console.log('🔧 Using Claude Anthropic SDK service');
        return new ClaudeAnthropicSDK(executionHistoryService);
    }
  }

  /**
   * Get the current service type being used
   * @returns 'claude-code-sdk', 'claude-code', or 'anthropic'
   */
  static getServiceType(): string {
    const claudeService = process.env.CLAUDE_SERVICE || 'ANTHROPIC';
    
    switch (claudeService.toUpperCase()) {
      case 'CLAUDECODESDK':
        return 'claude-code-sdk';
      case 'CLAUDECODE':
        return 'claude-code';
      case 'ANTHROPIC':
      default:
        return 'anthropic';
    }
  }

  /**
   * Validate the current service configuration
   * @returns Validation result with status and messages
   */
  static async validateConfiguration(): Promise<ValidationResult> {
    const serviceType = ClaudeServiceProvider.getServiceType();
    const result: ValidationResult = {
      serviceType,
      isValid: false,
      messages: []
    };

    if (serviceType === 'claude-code') {
      // Check if Claude Code CLI is available (inline check)
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        
        // Try local installation first (node_modules)
        try {
          await execAsync('./node_modules/.bin/claude --version');
          result.isValid = true;
          result.messages.push('✅ Claude Code CLI is available');
        } catch (localError) {
          // Fall back to global installation
          try {
            await execAsync('claude --version');
            result.isValid = true;
            result.messages.push('✅ Claude Code CLI is available');
          } catch (globalError) {
            result.messages.push('❌ Claude Code CLI is not installed or not in PATH');
            result.messages.push('   Install from: https://docs.anthropic.com/en/docs/claude-code/quickstart');
          }
        }
      } catch (error) {
        result.messages.push('❌ Claude Code CLI is not installed or not in PATH');
        result.messages.push('   Install from: https://docs.anthropic.com/en/docs/claude-code/quickstart');
      }
    } else if (serviceType === 'claude-code-sdk') {
      // Validate Claude Code SDK configuration
      if (process.env.ANTHROPIC_API_KEY) {
        result.isValid = true;
        result.messages.push('✅ ANTHROPIC_API_KEY is configured for Claude Code SDK');
        result.messages.push('✅ Claude Code SDK package is available');
      } else {
        result.messages.push('❌ ANTHROPIC_API_KEY environment variable is required for Claude Code SDK');
      }
    } else {
      // Validate Claude Anthropic SDK configuration
      if (process.env.ANTHROPIC_API_KEY) {
        result.isValid = true;
        result.messages.push('✅ ANTHROPIC_API_KEY is configured');
      } else {
        result.messages.push('❌ ANTHROPIC_API_KEY environment variable is required');
      }
    }

    return result;
  }
}
