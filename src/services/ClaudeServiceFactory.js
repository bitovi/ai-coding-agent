import { ClaudeAnthropicSDK } from './ClaudeAnthropicSDK.js';
import { ClaudeCodeService } from './ClaudeCodeService.js';
import { ClaudeCodeSDKService } from './ClaudeCodeSDKService.js';

/**
 * Factory for creating Claude service instances
 * Switches between Claude SDK, Claude Code CLI, and Claude Code SDK based on CLAUDE_SERVICE environment variable
 */
export class ClaudeServiceFactory {
  /**
   * Create a Claude service instance based on configuration
   * @param {Object} executionHistoryService - Optional execution history service
   * @returns {ClaudeAnthropicSDK|ClaudeCodeService|ClaudeCodeSDKService} The appropriate Claude service
   */
  static create(executionHistoryService = null) {
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
   * @returns {string} 'claude-code-sdk', 'claude-code', or 'anthropic'
   */
  static getServiceType() {
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
   * Check if Claude Code CLI is available
   * @returns {Promise<boolean>} True if Claude Code CLI is available
   */
  static async isClaudeCodeAvailable() {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      // Try local installation first (node_modules)
      try {
        await execAsync('./node_modules/.bin/claude --version');
        return true;
      } catch (localError) {
        // Fall back to global installation
        await execAsync('claude --version');
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate the current service configuration
   * @returns {Promise<Object>} Validation result with status and messages
   */
  static async validateConfiguration() {
    const serviceType = ClaudeServiceFactory.getServiceType();
    const result = {
      serviceType,
      isValid: false,
      messages: []
    };

    if (serviceType === 'claude-code') {
      // Validate Claude Code CLI
      const isAvailable = await ClaudeServiceFactory.isClaudeCodeAvailable();
      
      if (isAvailable) {
        result.isValid = true;
        result.messages.push('✅ Claude Code CLI is available');
      } else {
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

  /**
   * Get configuration instructions for the current service type
   * @returns {Object} Configuration instructions
   */
  static getConfigurationInstructions() {
    const serviceType = ClaudeServiceFactory.getServiceType();

    if (serviceType === 'claude-code') {
      return {
        serviceType: 'claude-code',
        title: 'Claude Code CLI Configuration',
        instructions: [
          '1. Install Claude Code CLI:',
          '   Visit: https://docs.anthropic.com/en/docs/claude-code/quickstart',
          '   Follow the installation instructions for your platform',
          '',
          '2. Set environment variable:',
          '   export CLAUDE_SERVICE=CLAUDECODE',
          '',
          '3. Authentication:',
          '   Claude Code CLI handles authentication automatically',
          '   You may need to sign in: `claude auth login`',
          '',
          '4. MCP Configuration:',
          '   MCP servers are configured dynamically by the service',
          '   Tokens from authManager are automatically provided'
        ],
        envVars: [
          'CLAUDE_SERVICE=CLAUDECODE'
        ]
      };
    } else if (serviceType === 'claude-code-sdk') {
      return {
        serviceType: 'claude-code-sdk',
        title: 'Claude Code TypeScript SDK Configuration',
        instructions: [
          '1. Get Anthropic API Key:',
          '   Visit: https://console.anthropic.com/',
          '   Create an API key',
          '',
          '2. Set environment variables:',
          '   export ANTHROPIC_API_KEY=your-api-key',
          '   export CLAUDE_SERVICE=CLAUDECODESDK',
          '',
          '3. Installation:',
          '   Claude Code SDK is already installed via @anthropic-ai/claude-code package',
          '   Uses TypeScript SDK for programmatic access to Claude Code',
          '',
          '4. MCP Configuration:',
          '   MCP servers are configured dynamically by the service',
          '   Tokens from authManager are automatically provided',
          '   Full development environment capabilities included'
        ],
        envVars: [
          'ANTHROPIC_API_KEY=your-api-key',
          'CLAUDE_SERVICE=CLAUDECODESDK'
        ]
      };
    } else {
      return {
        serviceType: 'anthropic',
        title: 'Claude Anthropic SDK Configuration',
        instructions: [
          '1. Get Anthropic API Key:',
          '   Visit: https://console.anthropic.com/',
          '   Create an API key',
          '',
          '2. Set environment variables:',
          '   export ANTHROPIC_API_KEY=your-api-key',
          '   export CLAUDE_SERVICE=ANTHROPIC  # or leave unset for default',
          '',
          '3. MCP Configuration:',
          '   MCP servers are configured via MCP_SERVERS environment variable',
          '   Or via the config file specified in MCP_SERVERS'
        ],
        envVars: [
          'ANTHROPIC_API_KEY=your-api-key',
          'CLAUDE_SERVICE=ANTHROPIC'
        ]
      };
    }
  }

  /**
   * Switch service type and validate
   * @param {string} serviceType - 'CLAUDECODE', 'CLAUDECODESDK', or 'ANTHROPIC'
   * @returns {Promise<Object>} Switch result
   */
  static async switchServiceType(serviceType) {
    const oldType = ClaudeServiceFactory.getServiceType();
    
    // Set the new service type
    process.env.CLAUDE_SERVICE = serviceType.toUpperCase();
    
    const validation = await ClaudeServiceFactory.validateConfiguration();
    
    return {
      oldType,
      newType: ClaudeServiceFactory.getServiceType(),
      success: validation.isValid,
      validation
    };
  }

  /**
   * Get service capabilities
   * @returns {Object} Service capabilities comparison
   */
  static getServiceCapabilities() {
    return {
      'anthropic': {
        name: 'Claude Anthropic SDK',
        features: [
          '✅ Direct API access',
          '✅ Streaming responses',
          '✅ Full API control',
          '✅ MCP server integration',
          '❌ No local tooling',
          '❌ No file system access',
          '❌ Requires API key management'
        ],
        pros: [
          'Fastest performance',
          'Most reliable',
          'Full API feature support',
          'Better for production'
        ],
        cons: [
          'Requires API key',
          'No local file access',
          'Limited to API capabilities'
        ]
      },
      'claude-code-sdk': {
        name: 'Claude Code TypeScript SDK',
        features: [
          '✅ Local file system access',
          '✅ Built-in development tools',
          '✅ Programmatic API access',
          '✅ Dynamic MCP configuration',
          '✅ Git integration',
          '✅ Streaming responses',
          '✅ Structured output formats'
        ],
        pros: [
          'Full development environment',
          'File system access',
          'Better for coding tasks',
          'Programmatic control',
          'Predictable TypeScript API',
          'Best of both worlds'
        ],
        cons: [
          'Requires API key',
          'Newer technology',
          'More complex setup'
        ]
      },
      'claude-code': {
        name: 'Claude Code CLI',
        features: [
          '✅ Local file system access',
          '✅ Built-in development tools',
          '✅ Interactive debugging',
          '✅ Dynamic MCP configuration',
          '✅ Git integration',
          '❌ Requires CLI installation',
          '❌ Less predictable output format'
        ],
        pros: [
          'Full development environment',
          'File system access',
          'Better for coding tasks',
          'Interactive capabilities'
        ],
        cons: [
          'Requires CLI installation',
          'Less stable API',
          'Potential parsing challenges',
          'Platform dependent'
        ]
      }
    };
  }

  /**
   * Get the path to the Claude CLI command
   * @returns {Promise<string>} Path to claude command
   */
  static async getClaudeCommand() {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const { access } = await import('fs/promises');
    const path = await import('path');
    const execAsync = promisify(exec);
    
    // Try local installation first (node_modules)
    const localPath = './node_modules/.bin/claude';
    try {
      await access(localPath);
      return localPath;
    } catch (error) {
      // Local installation not found, try global
      try {
        await execAsync('claude --version');
        return 'claude';
      } catch (globalError) {
        throw new Error('Claude Code CLI not found. Install with: npm install @anthropic-ai/claude-code');
      }
    }
  }
}
