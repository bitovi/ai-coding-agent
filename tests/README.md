# Tests

This folder contains the remaining test scripts for the AI Coding Agent project.

## Current Test Structure

### Jest Tests (Recommended)
The main test suite uses Jest and is located in the `src/` directory alongside the source code:
- `src/services/execution-history.test.ts`
- `src/services/connections.test.ts` 
- `src/services/prompts.test.ts`
- `src/services/user.test.ts`

Run Jest tests with:
```bash
npm test           # Run all tests
npm run test:watch # Run tests in watch mode
npm run test:coverage # Run with coverage
```

### Operational Scripts
Configuration and connection validation scripts are in the `scripts/` directory:
```bash
npm run test-connections  # Test MCP server connections
npm run test-git         # Test git credentials
npm run validate         # Validate configuration
```

## Remaining Test Files

### `test-claude-code-basic.js`
A standalone test for basic Claude Code Service functionality. This should be converted to a proper Jest test in the future.

**Usage:**
```bash
node tests/test-claude-code-basic.js
```

**What it does:**
- Tests ClaudeCodeService creation
- Validates Claude CLI availability
- Tests basic MCP configuration
- Tests prompt execution with git clone

## Migration Notes

This directory previously contained ~35 test files. Most have been:
- **Removed**: Obsolete tests superseded by Jest tests
- **Migrated**: Moved to Jest test structure in `src/` directory
- **Converted**: Operational validation moved to `scripts/` directory

The remaining file should be converted to Jest format and moved to the appropriate `src/` directory location.
Tests the OAuth callback handling and token exchange with mock data.

**Usage:**
```bash
cd /Users/justinmeyer/dev/ai-coding-agent
node tests/test-oauth-callback.js
```

**What it does:**
- Simulates OAuth callback with mock authorization code
- Tests the token exchange process
- Validates error handling for invalid codes

### `verify-oauth-fix.js`
Demonstrates that the OAuth "id_token not present" fix is working.

**Usage:**
```bash
cd /Users/justinmeyer/dev/ai-coding-agent
node tests/verify-oauth-fix.js
```

**What it does:**
- Shows the successful token exchange results
- Explains the fix implementation
- Verifies that tokens are properly stored

### `test-enhanced-activity-page.js`
Tests the enhanced prompt activity page functionality with detailed prompt information and parameter input.

**Usage:**
```bash
cd /Users/justinmeyer/dev/ai-coding-agent
node tests/test-enhanced-activity-page.js
```

**What it does:**
- Tests activity page loading and rendering
- Verifies enhanced prompt details are displayed
- Checks message content and parameter information
- Tests custom parameter input functionality
- Validates JSON parameter execution

## Prerequisites

Before running tests:

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Ensure ACCESS_TOKEN is configured:**
   The `.env` file should contain:
   ```
   ACCESS_TOKEN=test_access_token
   ```

3. **MCP server configuration:**
   Ensure the Jira MCP server is configured in `examples/mcp-servers.json` or via environment variables.

## Authentication

Tests that interact with API endpoints require authentication using the ACCESS_TOKEN:
- Via `Authorization: Bearer <token>` header (recommended)
- Via `x-access-token` header
- Via `access_token` query parameter
- Via `access_token` in request body

## Notes

- Tests are designed to work with the Atlassian MCP service (`https://mcp.atlassian.com/v1/sse`)
- Some tests use mock data and are expected to fail at certain steps (this is documented in the test output)
- The OAuth tests demonstrate the fix for the "id_token not present in TokenSet" error
