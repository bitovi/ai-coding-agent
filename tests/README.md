# Tests

This folder contains test scripts for the AI Coding Agent project.

## Test Files

### `test-auth-flow.js`
Tests the authentication flow and session management.

**Usage:**
```bash
cd /Users/justinmeyer/dev/ai-coding-agent
node tests/test-auth-flow.js
```

**What it does:**
- Tests session-based authentication
- Validates authentication middleware
- Tests login/logout functionality

### `test-magic-link.js`
Tests the magic link email authentication system.

**Usage:**
```bash
cd /Users/justinmeyer/dev/ai-coding-agent
node tests/test-magic-link.js
```

**What it does:**
- Tests magic link generation
- Validates email sending (or console logging)
- Tests magic link authentication flow

### `test-oauth-flow.js`
Tests the OAuth authorization flow for Atlassian MCP service.

**Usage:**
```bash
cd /Users/justinmeyer/dev/ai-coding-agent
node tests/test-oauth-flow.js
```

**What it does:**
- Triggers OAuth authorization for the Jira MCP service
- Uses ACCESS_TOKEN authentication
- Generates authorization URL and opens it in browser
- Tests the OAuth discovery and client registration process

### `test-oauth-callback.js`
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
