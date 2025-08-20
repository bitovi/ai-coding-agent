# AI Coding Agent

This is an AI coding agent that runs Claude with MCP (Model Context Protocol) service integration. It provides a web interface for managing prompts and MCP service connections, handling OAuth authorization flows, and executing Claude prompts with access to external tools and data sources.

## Features

- 🤖 **Claude Integration**: Execute prompts using Claude 3.5 Sonnet with MCP servers
- 🔐 **OAuth Management**: Automatic OAuth 2.0/PKCE flow handling for MCP services
- 🔑 **Magic Link Authentication**: Secure, passwordless email-based login system
- 📋 **Prompt Management**: Configure and execute parameterized prompts
- 🌐 **Web Dashboard**: Beautiful, secure web interface for managing connections and prompts
- 📧 **Email Notifications**: Get notified when authorization is needed or for login links
- 🔄 **Streaming Responses**: Real-time streaming of Claude responses via Server-Sent Events
- 📊 **Activity Tracking**: View execution history and results
- 🛡️ **Secure Sessions**: HTTP-only cookies with automatic session management
- 🔄 **MCP Proxy**: Secure HTTP proxy for MCP servers with SSE endpoint rewriting and domain validation

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build the frontend**:
  ```bash
  cd frontend
  npm ci
  npm build
  cd ..
  ```

4. **Start the server**:
   ```bash
   npm start
   ```

5. **Open the dashboard**:
   Navigate to `http://localhost:3000`

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Dashboard │    │  OAuth Provider  │    │   MCP Services  │
│                 │    │   (e.g. Jira)    │    │  (Jira, GitHub) │
└─────────┬───────┘    └─────────┬────────┘    └─────────┬───────┘
          │                      │                       │
          ▼                      ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Coding Agent                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Config    │  │    Auth     │  │   Prompt    │             │
│  │  Manager    │  │  Manager    │  │  Manager    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                           │                                     │
│                           ▼                                     │
│                  ┌─────────────────┐                           │
│                  │ Claude Service  │                           │
│                  │   (Anthropic)   │                           │
│                  └─────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

## Environment Variables

The application requires the following environment variables:

- __EMAIL__ - An email for the current user. Example:
  ```
  austin@bitovi.com
  ```

- __ANTHROPIC_API_KEY__ - Your Anthropic API key for Claude access. Get one from [Anthropic Console](https://console.anthropic.com/).

- __ACCESS_TOKEN__ - (Optional) A token that protects all API endpoints. If not provided, the API will be unprotected.

- __DISABLE_AUTH__ - (Optional) Set to `true` to completely disable authentication for development/testing. When enabled, all requests will be processed without requiring login or tokens. **Warning: Only use in development environments!**

- __MCP_SERVERS__ - either a JSON array or a path to a JSON file. Defines the MCP (Model Context Protocol) servers available to your prompts. The JSON should look like:
  ```json
  [
    {
        "name": "NAME OF SERVICE",
        "type": "url", // or "stdio" for local subprocess servers
        "url": "URL TO MCP SERVICE",
        "authorization_token": null, // or a string authorization token
        "tool_configuration": {
            "enabled": true,
            "allowed_tools": null, // or array of allowed tool names
            "allowed_paths": ["/path/to/allowed/directory"] // for stdio type only
        },
        "oauth_provider_configuration": null // or OAuthProviderConfiguration object (experimental - not yet fully tested)
    }
  ]
  ```

  **Note**: Currently, `oauth_provider_configuration` is experimental. All working examples use `null` for automatic OAuth discovery.

  **Transport Types:**
  - `"url"`: Network-based MCP servers (HTTP, SSE, WebSocket, etc.) 
  - `"stdio"`: Local subprocess-based MCP servers via stdin/stdout

  **Authorization Token Priority:**
  The system checks for authorization tokens in this priority order:
  1. `authorization_token` field in the MCP server configuration
  2. Environment variable: `MCP_{server_name}_authorization_token`
  3. OAuth tokens obtained through the web interface

  See the complete schema: [MCP Servers Configuration](./specifications/mcp-servers.json)

  Additional OAuth configuration: [OAuth Provider Configuration](./specifications/oauth-provider-configuration.json)

- __PROMPTS__ - either a json array or a path to a JSON file. The JSON should look like:
  ```json
  [
    {
        "name": "Name of prompt",
        "mcp_servers": ["MCP NAME OF SERVICE"],
        "messages": [{
            "role": "ROLE",
            "content": "CONTENT",
            "parameters" : {}
        }]
    }
  ]
  ```

  Each item in  `PROMPTS[].mcp_servers` array must match a entry's `name` 
  in the `MCP_SERVERS` name.

  The `PROMPTS[].messages` array matches the the `messages` option passed to `anthropic.beta.messages.create` with the exception of `parameters`. 

  The parameters let people specify what parameters the prompt takes. When a prompt is called, arguments can be provided which will be substituted into the `messages.content`.
  See [Parameters Specification](./specifications/parameters.json) for more information.

## Configuration Examples

### MCP Servers Configuration

You can configure MCP servers in several ways:

**Option 1: Inline JSON in environment variable**
```bash
MCP_SERVERS='[{"name":"jira","type":"url","url":"https://mcp.atlassian.com/v1/sse","authorization_token":null,"tool_configuration":{"enabled":true}}]'
```

**Option 2: External JSON file**
```bash
MCP_SERVERS=./examples/mcp-servers.json
```

See [examples/mcp-servers.json](./examples/mcp-servers.json) for a complete example with OAuth configuration.

### Understanding MCP Transport Types

The AI Coding Agent supports two main transport types for MCP servers:

- **`"url"`**: For network-based MCP servers
  - Standard HTTP requests and responses
  - Server-Sent Events (SSE) streaming
  - WebSocket connections
  - Any HTTP-based communication protocol
  - Examples: Jira MCP, GitHub Copilot MCP, external API services

- **`"stdio"`**: For local subprocess-based MCP servers  
  - Communication via standard input/output streams
  - Server runs as a child process
  - Suitable for local file operations, system tools
  - Examples: Local file system access, command-line tools

### Authorization Token Configuration

You can provide authorization tokens for MCP servers in several ways:

**Method 1: Environment Variables (Recommended)**
```bash
# In your .env file
MCP_github_authorization_token=ghp_your_github_token_here
MCP_jira_authorization_token=your_jira_token_here
```

**Method 2: Configuration File**
```json
{
  "name": "github",
  "type": "http",
  "url": "https://api.githubcopilot.com/mcp/",
  "authorization_token": "ghp_your_github_token_here"
}
```

**Method 3: OAuth Flow**
Use the web interface to authorize services through OAuth flows.

**Priority Order**: Environment variables override configuration file tokens, which override OAuth tokens.

### Prompts Configuration

**Option 1: Inline JSON in environment variable**
```bash
PROMPTS='[{"name":"create-jira-issue","mcp_servers":["jira"],"messages":[{"role":"user","content":"Create a Jira issue with summary {{summary}}","parameters":{"type":"object","properties":{"summary":{"type":"string"}},"required":["summary"]}}]}]'
```

**Option 2: External JSON file**
```bash
PROMPTS=./examples/prompts.json
```

See [examples/prompts.json](./examples/prompts.json) for complete examples with parameter substitution.

## MCP Proxy

The AI Coding Agent includes a built-in HTTP proxy for MCP servers. This allows tools like GitHub Copilot to connect to MCP servers through your instance, handling authentication and providing secure access to services that only support dynamic PKCE authorization like Jira.

### Setup Steps

#### 1. Configure MCP Server with Proxy

Add `"proxy": true` to your MCP server configuration:

```json
{
  "name": "jira",
  "type": "url",
  "url": "https://mcp.atlassian.com/v1/sse",
  "proxy": true,
  "authorization_token": null,
  "tool_configuration": {
    "enabled": true
  }
}
```

#### 2. Authorize the Service

If your MCP server requires OAuth (like Jira), you'll need to authorize it:

1. Start your AI Coding Agent server
2. Open the dashboard at `http://localhost:3000`
3. Click the "Authorize" button next to your MCP service
4. Complete the OAuth flow

#### 3. Configure Your MCP Client

Configure your MCP client (like Copilot) to connect through the proxy. For local development, you'll likely need to use a tool like ngrok to expose your server.

**Example mcp.json for Copilot:**
```json
{
  "servers": {
    "my-proxy": {
      "url": "https://your-server.com/api/mcp/jira/proxy",
      "headers": {
        "Authorization": "Bearer your_access_token",
        "Content-Type": "application/json"
      }
    }
  }
}
```

**⚠️ Security Warning**: Never commit your `ACCESS_TOKEN` to version control. Keep it secure and use environment variables in production.

**Local Development**: Use ngrok or similar tools to expose your local server:
```bash
# Example with ngrok
ngrok http 3000
# Then use the ngrok URL: https://abc123.ngrok-free.app/api/mcp/jira/proxy
```

The proxy provides secure forwarding, automatic authentication, and SSE streaming support. For detailed technical information, see the [MCP Proxy Specification](./specifications/mcp-proxy-fallback-behavior.md).

## Usage Guide

### 1. Setting Up Your Environment

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your actual configuration:
   - Add your email address
   - Add your Anthropic API key
   - Configure your MCP servers
   - Configure your prompts

3. Validate your configuration:
   ```bash
   npm run validate
   ```

### Build the frontend
1. Build the frontend:
  ```bash
  cd frontend
  npm ci
  npm build
  ```

### 2. Starting the Server

Start the development server:
```bash
npm run dev
```

Or start the production server:
```bash
npm start
```

Or use the Visual Studio Dev Container to start the production server:
- Open command palette
- Select "Dev Containers: Reopen in Container"

This will build the Dockerfile image, start the frontend and backend applications and handle port forwarding. Consider this a local proudction server for testing purposes. Changes to source made in the devcontainer are propogated to your local source.

#### Ngrok + devcontainer
If you want to start the Ngrok service from within the dev container:
```bash
cp .devcontainer/ngrok.env.example .devcontainer/ngrok.env
# update the NGROK_AUTHTOKEN value
```
Once the devcontainer comes up you can navigate to localhost:4040 and retrieve the tunnel URL.


### 3. Using the Web Dashboard

Navigate to `http://localhost:3000` to access the dashboard where you can:

- **View Your Prompts**: See all configured prompts and their authorization status
- **Manage Connections**: Authorize MCP services using OAuth flows
- **View Activity**: Check execution history and results
- **Run Prompts**: Execute prompts with parameter inputs

### 4. API Endpoints

All endpoints require authentication if `ACCESS_TOKEN` is configured.

#### `GET /`
The main dashboard interface.

#### `POST /mcp/{MCP_NAME}/authorize`
Initiates OAuth authorization for an MCP service.

**Response:**
```json
{
  "authUrl": "https://oauth-provider.com/authorize?..."
}
```

#### `POST /prompt/{PROMPT_NAME}/run`
Executes a prompt with streaming SSE response.

**Request Body:**
```json
{
  "parameters": {
    "summary": "Fix login bug",
    "description": "User cannot log in with valid credentials"
  }
}
```

**Response:** Server-Sent Events stream with Claude's response.

#### `GET /prompts/{PROMPT_NAME}/activity.html`
View execution history for a specific prompt.

#### MCP Proxy Endpoints

The following endpoints are available when MCP servers have `"proxy": true` configured:

#### `POST/GET /api/mcp/{MCP_NAME}/proxy`
Main proxy endpoint for forwarding requests to MCP servers.

**Query Parameters:**
- `target` (optional): Specific target URL to proxy to (must be on same domain as configured MCP server)

**Features:**
- Automatic authentication using configured tokens
- SSE streaming support
- Domain-validated URL forwarding
- Session management

#### `GET /api/mcp/{MCP_NAME}/proxy/status`
Get proxy status and configuration information.

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "jira",
    "isProxy": true,
    "targetUrl": "https://mcp.atlassian.com/v1/sse",
    "isAuthorized": true,
    "hasToken": true
  }
}
```

## Development

### Project Structure

```
/
├── index.js                 # Main application entry point
├── src/
│   ├── auth/
│   │   └── AuthManager.js   # OAuth flow management
│   ├── config/
│   │   └── ConfigManager.js # Configuration loading & validation
│   ├── middleware/
│   │   └── AuthMiddleware.js # API authentication
│   ├── prompts/
│   │   └── PromptManager.js # Prompt management & execution
│   └── services/
│       ├── ClaudeService.js # Claude API integration
│       ├── EmailService.js  # Email notifications
│       └── WebUIService.js  # Web interface rendering
├── examples/               # Example configurations
├── scripts/               # Utility scripts
└── specifications/        # JSON schemas
```

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm run validate` - Validate configuration
- `npm run test-connections` - Test MCP server connections

### VS Code Tasks

Use `Cmd+Shift+P` → "Tasks: Run Task" to access:

- **Install Dependencies** - Run `npm install`
- **Start Development Server** - Start with auto-reload
- **Validate Configuration** - Check environment setup
- **Test Connections** - Test MCP server connectivity
## Important Context

The following resources provide essential background information:

- [Claude Code MCP Documentation](https://docs.anthropic.com/en/docs/claude-code/mcp) - Official MCP integration guide
- [get-pkce-token.js](https://raw.githubusercontent.com/bitovi/claude-experiments/refs/heads/main/get-pkce-token.js) - OAuth PKCE implementation reference
- [example-official-jira-mcp-with-pkce-token.js](https://raw.githubusercontent.com/bitovi/claude-experiments/refs/heads/main/example-official-jira-mcp-with-pkce-token.js) - Claude MCP integration example

## OAuth Authorization Flow

The application supports two OAuth configuration methods:

### 1. Explicit OAuth Configuration (Experimental)

The system supports explicit OAuth configuration, but this feature is **experimental and not yet fully tested**:

```json
{
  "name": "github",
  "type": "sse", 
  "url": "https://api.github.com/mcp/sse",
  "oauth_provider_configuration": {
    "provider": "GitHub",
    "issuer": "https://github.com",
    "authorization_endpoint": "https://github.com/login/oauth/authorize",
    "token_endpoint": "https://github.com/login/oauth/access_token",
    "client_id": "your_client_id",
    "client_type": "public",
    "scopes_supported": ["repo", "user"]
  }
}
```

**Note**: Currently, all working examples use `"oauth_provider_configuration": null` and rely on automatic discovery.

### 2. Automatic Endpoint Discovery (Current Method)

When `oauth_provider_configuration` is `null` (the current standard), the system automatically discovers OAuth endpoints using:

1. WWW-Authenticate header resource parameter (RFC9728)
2. Standard OAuth Authorization Server Metadata endpoint  
3. OpenID Connect Discovery endpoint

This automatic discovery is the **current working method** used by all examples. Most MCP servers should support this discovery mechanism.

## Error Handling & Notifications

### Authorization Required Flow

When a prompt requires unauthorized MCP services:

1. **Prompt is queued** for later execution
2. **Email notification** is sent to the configured email address
3. **Error response** is returned with unauthorized services list
4. **User can authorize** services via the web dashboard
5. **Queued prompts** can be executed once authorization is complete

### Email Configuration

Configure SMTP settings for notifications:

```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your.email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=AI Coding Agent <your.email@gmail.com>
```

If email is not configured, notifications will be logged to the console.

## Security Considerations

- **Access Token**: Use `ACCESS_TOKEN` to protect your API in production
- **OAuth Tokens**: Stored in memory only (consider persistent storage for production)
- **PKCE Flow**: Uses PKCE for secure OAuth without client secrets
- **Token Refresh**: Automatic token refresh is planned but not yet implemented

## Troubleshooting

### Common Issues

**1. "ANTHROPIC_API_KEY not found"**
- Ensure your `.env` file contains a valid Anthropic API key
- Get one from [Anthropic Console](https://console.anthropic.com/)

**2. "Failed to load MCP servers"**
- Check JSON syntax in your MCP_SERVERS configuration
- Validate against examples in `examples/mcp-servers.json`

**3. "OAuth Authorization Server Metadata not found"**
- Ensure MCP service URL is correct and accessible
- Check if service supports OAuth discovery endpoints

**4. "Token exchange failed"**
- Verify OAuth client configuration
- Check redirect URI matches your server URL

### Debug Commands

```bash
# Validate all configuration
npm run validate

# Test MCP server connections  
npm run test-connections

# Check server logs
npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:

- Create an issue on [GitHub](https://github.com/bitovi/ai-coding-agent/issues)
- Check the [troubleshooting section](#troubleshooting)
- Review the [examples](./examples/) directory

---

## Original Specification Reference

The implementation below follows the original specification from the repository README:

## Endpoints

### `GET /index.html`

The index page looks like:

![index page example](./specifications/index.png "Index Page Example")

The index page has two main lists:

- Your prompts - A list of prompts available in the service. For each prompt, it also provides:
  - A link to see the activity for the prompt
  - A list of the MCP services the prompt uses. MCP services that 
    are authorized are in green. MCP services that are not authorized are in red.

- Your Connections - A list of MCP services. Each MCP service is green if it's
  been authorized and red if it has not. Clicking an MCP service will start the authorization flow for that service.

### `GET /prompts/{PROMPT_NAME}/activity.html`

A list of prompts that have been run and their output. It can also show prompts that are pending due to needed authorizations.

Each prompt has a button that enables re-running the prompt.

### `POST /mcp/{MCP_NAME}/authorize`

Initiates an authorization flow for the MCP service.

This endpoint will match an MCP configuration by MCP_NAME. 

If the MCP configuration has a `authorization_token`, this does nothing b/c it's already authorized.

If the MCP configuration has a `oauth_provider_configuration` it will establish the
proper configuration. 

If no `oauth_provider_configuration` is provided, it will use the MCP url to look for a well known endpoint similar to the code in: https://raw.githubusercontent.com/bitovi/claude-experiments/refs/heads/main/get-pkce-token.js

Once the authorization is complete, the tokens (including refresh) for the authorization will be stored in a Map that maps the MCP service name to the tokens.

### `POST /prompt/{PROMPT_NAME}/run`

This endpoints runs a prompt if there's an available access token for each of the mcp_servers. It runs as a streaming SSE service.

If there's 
not an available access token, then the prompt is saved in array of prompts to be run and an error is returned. The user is also emailed a message to return and authorize the necessary mcp_servers.

If all of the MCP services are available, the prompt is run. The results of the prompt are returned to user.  

Look at https://raw.githubusercontent.com/bitovi/claude-experiments/refs/heads/main/example-official-jira-mcp-with-pkce-token.js on how to call anthropic.beta.messages.create
with access tokens.


