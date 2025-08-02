# Claude Service Configuration Guide

## Environment Variable: CLAUDE_SERVICE

The AI Coding Agent now uses a single environment variable `CLAUDE_SERVICE` to control which Claude service implementation to use.

## Available Service Types

### ANTHROPIC (Default)
```bash
CLAUDE_SERVICE=ANTHROPIC
ANTHROPIC_API_KEY=your_api_key_here
```

**Best for:** Production deployments, fastest responses, most reliable
**Features:**
- ✅ Direct API access
- ✅ Streaming responses  
- ✅ Full API control
- ✅ MCP server integration
- ❌ No local tooling
- ❌ No file system access

**Requirements:** Anthropic API key only

### CLAUDECODE
```bash
CLAUDE_SERVICE=CLAUDECODE
```

**Best for:** Development tasks requiring file system access, git operations
**Features:**
- ✅ Local file system access
- ✅ Built-in development tools
- ✅ Interactive debugging
- ✅ Dynamic MCP configuration
- ✅ Git integration
- ❌ Requires CLI installation
- ❌ Less predictable output format

**Requirements:** 
- Claude Code CLI installation: `npm install -g @anthropic-ai/claude-code`
- Authentication: `claude auth login` (if needed)

### CLAUDECODESDK
```bash
CLAUDE_SERVICE=CLAUDECODESDK
ANTHROPIC_API_KEY=your_api_key_here
```

**Best for:** Development with programmatic control and predictable APIs
**Features:**
- ✅ Local file system access
- ✅ Built-in development tools
- ✅ Programmatic API access
- ✅ Dynamic MCP configuration
- ✅ Git integration
- ✅ Streaming responses
- ✅ Structured output formats

**Requirements:** Anthropic API key (no CLI installation needed)

## Quick Start Commands

### Start with different services:
```bash
# Start with Anthropic SDK (default)
npm start

# Start with Claude Code CLI
npm run start-claude-code

# Start with Claude Code SDK  
npm run start-claude-code-sdk

# Development mode variants
npm run dev                    # Anthropic SDK
npm run dev-claude-code        # Claude Code CLI
npm run dev-claude-code-sdk    # Claude Code SDK
```

### Switch services at runtime:
```bash
# Set environment variable and restart
export CLAUDE_SERVICE=CLAUDECODESDK
npm start
```

## Migration from Previous Version

If you were using the old environment variables, here's how to migrate:

```bash
# Old format
USE_CLAUDE_CODE=false          # → CLAUDE_SERVICE=ANTHROPIC
USE_CLAUDE_CODE=true           # → CLAUDE_SERVICE=CLAUDECODE  
USE_CLAUDE_CODE_SDK=true       # → CLAUDE_SERVICE=CLAUDECODESDK
```

## Service Selection Guide

| Use Case | Recommended Service | Reason |
|----------|-------------------|---------|
| Production API | ANTHROPIC | Fastest, most reliable |
| Local development | CLAUDECODESDK | Best of both worlds |
| File system tasks | CLAUDECODE or CLAUDECODESDK | File access required |
| Git operations | CLAUDECODE or CLAUDECODESDK | Git integration |
| CI/CD pipelines | ANTHROPIC | Simplest setup |
| Interactive debugging | CLAUDECODE | Interactive capabilities |

## Troubleshooting

### Service not starting?
1. Check that `CLAUDE_SERVICE` is set to a valid value: `ANTHROPIC`, `CLAUDECODE`, or `CLAUDECODESDK`
2. Verify required API keys are set
3. For `CLAUDECODE`, ensure CLI is installed: `claude --version`

### Validation errors?
Run the validation script:
```bash
npm run validate
```

### Test service switching:
```bash
node src/services/test-service-switching.js
```
