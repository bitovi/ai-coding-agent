# Claude Code Integration

This document describes the integration between the AI Coding Agent and Claude Code CLI, providing an alternative to the TypeScript SDK.

## Overview

The AI Coding Agent now supports two Claude service implementations:

1. **Claude TypeScript SDK** (`ClaudeService`) - Direct API integration
2. **Claude Code CLI** (`ClaudeCodeService`) - CLI-based integration

You can switch between them using the `USE_CLAUDE_CODE` environment variable.

## Service Comparison

### Claude TypeScript SDK
- **Pros**: Direct API access, fastest performance, most reliable, full API control
- **Cons**: Requires API key, no local file access, limited to API capabilities
- **Best for**: Production environments, API-focused tasks, reliable automation

### Claude Code CLI  
- **Pros**: Local file system access, built-in dev tools, interactive debugging, dynamic MCP config
- **Cons**: Requires CLI installation, less stable API, potential parsing challenges
- **Best for**: Development environments, coding tasks, local file manipulation

## Configuration

### Using Claude TypeScript SDK (Default)

```bash
# Set or leave unset
export USE_CLAUDE_CODE=false

# Required
export ANTHROPIC_API_KEY=your-api-key

# MCP servers via environment
export MCP_SERVERS='[{"name":"server1","type":"stdio","command":"/path/to/server"}]'
```

### Using Claude Code CLI

```bash
# Enable Claude Code CLI
export USE_CLAUDE_CODE=true

# Install Claude Code CLI first
# Visit: https://docs.anthropic.com/en/docs/claude-code/quickstart

# Authenticate (if needed)
claude auth login
```

## Features

### Dynamic MCP Server Configuration

The `ClaudeCodeService` automatically configures MCP servers from your existing configuration:

```javascript
// MCP servers are dynamically configured
const mcpServers = configManager.prepareMcpServersForClaude(
  prompt.mcp_servers, 
  authManager
);

// Service automatically creates .mcp.json and adds servers
await claudeCodeService.configureMcpServers(mcpServers, authManager);
```

### Authentication Token Integration

Auth tokens from the `AuthManager` are automatically provided to Claude Code:

```javascript
// For STDIO servers
{
  "type": "stdio",
  "command": "/path/to/server",
  "env": {
    "AUTH_TOKEN": "token-from-auth-manager"
  }
}

// For SSE/HTTP servers  
{
  "type": "sse",
  "url": "https://api.example.com/mcp",
  "headers": {
    "Authorization": "Bearer token-from-auth-manager"
  }
}
```

### Streaming Response Mapping

The CLI output is mapped to Claude API-compatible events:

```javascript
// Claude Code JSON output → Claude API events
{
  "type": "content",
  "text": "Hello"
} 
→ 
{
  "event": "content_block_delta",
  "data": {
    "index": 0,
    "delta": { "type": "text_delta", "text": "Hello" }
  }
}
```

## API Compatibility

Both services implement the same interface:

```javascript
interface ClaudeServiceInterface {
  // Main execution methods
  executePromptStream(prompt, parameters, configManager, authManager, res, userEmail)
  executePrompt(prompt, parameters, configManager, authManager)
  
  // Utility methods
  setExecutionHistoryService(executionHistoryService)
  processPrompt(prompt, parameters) // deprecated
  buildSystemMessage(mcpServers)
  sendSSEEvent(res, event, data)
}
```

### Additional Claude Code Methods

The `ClaudeCodeService` provides additional CLI management methods:

```javascript
// MCP server management
await service.addMcpServer(serverName, serverConfig, scope)
await service.listMcpServers()
await service.removeMcpServer(serverName)

// Cleanup
await service.cleanup()
```

## Factory Pattern

Use `ClaudeServiceFactory` to create the appropriate service:

```javascript
import { ClaudeServiceFactory } from './src/services/ClaudeServiceFactory.js';

// Automatically selects based on USE_CLAUDE_CODE
const claudeService = ClaudeServiceFactory.create(executionHistoryService);

// Validate configuration
const validation = await ClaudeServiceFactory.validateConfiguration();
if (!validation.isValid) {
  console.error('Configuration invalid:', validation.messages);
}

// Get configuration instructions
const instructions = ClaudeServiceFactory.getConfigurationInstructions();
console.log(instructions.title);
console.log(instructions.instructions.join('\n'));
```

## Testing

Run the integration test:

```bash
node tests/test-claude-service-integration.js
```

This will:
- Show current configuration
- Test service creation
- Validate CLI availability (if using Claude Code)
- Demonstrate service switching
- Show configuration instructions

## Migration Guide

### From Claude SDK to Claude Code

1. Install Claude Code CLI:
   ```bash
   # Visit https://docs.anthropic.com/en/docs/claude-code/quickstart
   # Follow installation instructions for your platform
   ```

2. Authenticate:
   ```bash
   claude auth login
   ```

3. Set environment variable:
   ```bash
   export USE_CLAUDE_CODE=true
   ```

4. Restart the application

### From Claude Code to Claude SDK

1. Set environment variables:
   ```bash
   export USE_CLAUDE_CODE=false
   export ANTHROPIC_API_KEY=your-api-key
   ```

2. Restart the application

## Troubleshooting

### Claude Code CLI Issues

**CLI not found:**
```
❌ Claude Code CLI is not installed or not in PATH
```
- Install from https://docs.anthropic.com/en/docs/claude-code/quickstart
- Ensure `claude` command is in your PATH

**Authentication issues:**
```bash
claude auth login
```

**MCP server errors:**
- Check server configurations in temporary `.mcp.json`
- Verify server executables are accessible
- Check environment variables and tokens

### Claude SDK Issues

**Missing API key:**
```
❌ ANTHROPIC_API_KEY environment variable is required
```
- Get API key from https://console.anthropic.com/
- Set `ANTHROPIC_API_KEY` environment variable

**MCP configuration:**
- Ensure `MCP_SERVERS` environment variable is properly formatted
- Verify server configurations are valid

## Examples

### Basic Usage

```javascript
// The application automatically uses the configured service
const agent = new AICodingAgent();
await agent.initialize(); // Validates and creates appropriate service

// Execute prompt (same interface for both services)
app.post('/api/execute', async (req, res) => {
  const { promptName, parameters } = req.body;
  const prompt = promptManager.getPrompt(promptName);
  
  // This works with either service
  await claudeService.executePromptStream(
    prompt, 
    parameters, 
    configManager, 
    authManager, 
    res, 
    userEmail
  );
});
```

### Switching Services Programmatically

```javascript
// Check current service
const currentType = ClaudeServiceFactory.getServiceType();
console.log('Current service:', currentType);

// Switch services
const result = await ClaudeServiceFactory.switchServiceType('claude-code');
if (result.success) {
  console.log('Switched to Claude Code CLI');
  
  // Create new service instance
  const newService = ClaudeServiceFactory.create(executionHistoryService);
} else {
  console.error('Switch failed:', result.validation.messages);
}
```

### Custom MCP Server Configuration

```javascript
// For Claude Code service, you can dynamically add MCP servers
if (ClaudeServiceFactory.getServiceType() === 'claude-code') {
  const service = ClaudeServiceFactory.create();
  
  // Add a new server
  await service.addMcpServer('my-server', {
    type: 'stdio',
    command: '/path/to/my-server',
    args: ['--config', 'production'],
    env: {
      'API_KEY': authManager.getTokens('my-service')?.access_token
    }
  }, 'local');
  
  // List servers
  const servers = await service.listMcpServers();
  console.log('Configured servers:', servers);
}
```

## Best Practices

1. **Environment-based Configuration**: Use environment variables to control service selection
2. **Validation**: Always validate configuration at startup
3. **Error Handling**: Both services can fail differently - handle appropriately
4. **Development vs Production**: Consider using Claude Code for development, SDK for production
5. **Authentication**: Ensure auth tokens are properly managed for MCP servers
6. **Cleanup**: Call cleanup methods for Claude Code service to remove temporary files

## Integration with Existing Features

The Claude Code integration maintains full compatibility with existing features:

- ✅ **Prompt Manager**: Same prompt format and parameter substitution
- ✅ **Auth Manager**: OAuth tokens automatically provided to MCP servers  
- ✅ **Execution History**: Both services record execution history
- ✅ **Streaming**: SSE streaming works with both services
- ✅ **Error Handling**: Consistent error reporting
- ✅ **MCP Servers**: Same server configuration format
