# UI API Specification

This document describes the REST API endpoints that the React-based frontend uses to interact with the AI Coding Agent backend. All endpoints support session-based authentication via cookies or the legacy `ACCESS_TOKEN` for programmatic access.

## Authentication

All API endpoints use the same authentication system as the main application:

1. **Session-based**: Uses HTTP-only session cookies (preferred for UI)
2. **Token-based**: `Authorization: Bearer {ACCESS_TOKEN}` header for API access
3. **Development**: `DISABLE_AUTH=true` environment variable disables authentication

For failed authentication, endpoints return:
- **Browser requests**: 302 redirect to `/login`
- **API requests**: 401 JSON response with login URL

## Core Endpoints

### User Information

#### `GET /api/user`
Get current authenticated user information.

**Response:**
```json
{
  "email": "user@example.com",
  "sessionId": "session_123",
  "isAuthenticated": true
}
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated

---

### Prompts

#### `GET /api/prompts`
Get all available prompts with their authorization status.

**Response:**
```json
{
  "prompts": [
    {
      "name": "create-jira-issue",
      "description": "Create a new Jira issue with specified details",
      "messages": [
        {
          "role": "user",
          "content": "Create a Jira issue with summary {{summary}} and description {{description}}"
        }
      ],
      "parameters": {
        "summary": {
          "type": "string",
          "description": "Brief summary of the issue",
          "required": true
        },
        "description": {
          "type": "string", 
          "description": "Detailed description of the issue",
          "required": true
        },
        "issueType": {
          "type": "string",
          "description": "Type of issue (Bug, Task, Story)",
          "default": "Task",
          "enum": ["Bug", "Task", "Story"]
        }
      },
      "canRun": false,
      "connections": [
        {
          "name": "jira",
          "type": "mcp-server",
          "description": "Atlassian Jira integration",
          "isAvailable": false,
          "authUrl": "/api/connections/mcp/jira/authorize"
        },
        {
          "name": "git-credentials", 
          "type": "credential",
          "description": "Git credentials for repository access",
          "isAvailable": true,
          "setupUrl": "/api/connections/credential/git-credentials/setup"
        }
      ]
    }
  ]
}
```

**Fields:**
- `canRun`: `true` if all required connections are available
- `connections`: Array of connection objects required by this prompt, each with:
  - `name`: Unique identifier for the connection
  - `type`: Either "mcp-server" (OAuth services) or "credential" (environment credentials)
  - `description`: Human-readable description
  - `isAvailable`: Whether the connection is currently configured and working
  - `authUrl`: URL to initiate authorization (for mcp-server type)
  - `setupUrl`: URL to configure credentials (for credential type)

---

#### `GET /api/prompts/:promptName`
Get details for a specific prompt.

**Response:**
```json
{
  "name": "create-jira-issue",
  "description": "Create a new Jira issue with specified details",
  "messages": [...],
  "parameters": {...},
  "canRun": false,
  "connections": [...]
}
```

**Error Responses:**
- `404 Not Found`: Prompt does not exist

---

#### `POST /api/prompts/:promptName/run`
Execute a prompt with streaming response.

**Request Body:**
```json
{
  "parameters": {
    "summary": "Fix login bug",
    "description": "Users cannot log in with valid credentials",
    "issueType": "Bug"
  }
}
```

**Response:** Server-Sent Events (SSE) stream with:
```
data: {"type": "start", "promptName": "create-jira-issue"}
data: {"type": "output", "content": "Creating Jira issue..."}
data: {"type": "output", "content": "Issue created successfully: PROJ-123"}
data: {"type": "complete", "success": true}
```

**Error Responses:**
- `404 Not Found`: Prompt does not exist
- `401 Unauthorized`: Required connections need authorization
```json
{
  "error": "Authorization required",
  "requiredConnections": [
    {
      "name": "jira",
      "type": "mcp-server",
      "authUrl": "/api/connections/mcp/jira/authorize"
    }
  ],
  "message": "Please authorize the required connections"
}
```

---

#### `GET /api/prompts/:promptName/activity`
Get execution history for a specific prompt.

**Query Parameters:**
- `limit`: Number of entries to return (default: 50)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "prompt": {
    "name": "create-jira-issue",
    "description": "Create a new Jira issue"
  },
  "executions": [
    {
      "id": "exec_123",
      "timestamp": "2024-01-15T10:30:00Z",
      "userEmail": "user@example.com",
      "parameters": {
        "summary": "Fix login bug",
        "description": "Users cannot log in"
      },
      "status": "completed",
      "output": "Issue created successfully: PROJ-123",
      "duration": 5200
    }
  ],
  "pendingExecutions": [
    {
      "id": "pending_456",
      "timestamp": "2024-01-15T11:00:00Z",
      "parameters": {...},
      "waitingFor": ["jira"],
      "reason": "MCP servers need authorization"
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

---

### Connections

#### `GET /api/connections`
Get all available connections and their status.

**Response:**
```json
{
  "connections": [
    {
      "name": "jira",
      "type": "mcp-server",
      "description": "Atlassian Jira integration",
      "isAvailable": false,
      "authUrl": "/api/connections/mcp/jira/authorize",
      "details": {
        "url": "https://api.atlassian.com/oauth",
        "scopes": ["read:jira-work", "write:jira-work"],
        "lastAuthorized": null,
        "tokenExpiry": null,
        "hasRefreshToken": false
      }
    },
    {
      "name": "github-repo",
      "type": "mcp-server", 
      "description": "GitHub repository access",
      "isAvailable": true,
      "authUrl": "/api/connections/mcp/github-repo/authorize",
      "details": {
        "url": "https://api.github.com",
        "lastAuthorized": "2024-01-15T09:00:00Z",
        "tokenExpiry": null
      }
    },
    {
      "name": "git-credentials",
      "type": "credential",
      "description": "Git credentials for repository access",
      "isAvailable": true,
      "setupUrl": "/api/connections/credential/git-credentials/setup",
      "details": {
        "lastConfigured": "2024-01-15T08:00:00Z",
        "method": "token"
      }
    },
    {
      "name": "docker-registry",
      "type": "credential",
      "description": "Docker registry credentials",
      "isAvailable": false,
      "setupUrl": "/api/connections/credential/docker-registry/setup",
      "details": {
        "lastConfigured": null
      }
    }
  ]
}
```

---

#### `POST /api/connections/mcp/:mcpName/authorize`
Initiate OAuth authorization for an MCP server.

**Response:**
```json
{
  "authUrl": "https://auth.atlassian.com/authorize?client_id=..."
}
```

**Error Responses:**
- `404 Not Found`: MCP server not found
- `400 Bad Request`: Server already authorized or misconfigured

---

#### `GET /api/connections/mcp/:mcpName/status`
Get authorization status for a specific MCP server.

**Response:**
```json
{
  "name": "jira",
  "type": "mcp-server",
  "isAvailable": false,
  "details": {
    "lastAuthorized": null,
    "tokenExpiry": null,
    "hasRefreshToken": false,
    "needsReauthorization": false
  }
}
```

---

#### `POST /api/connections/credential/:credentialType/setup`
Configure credential-based connections (e.g., git credentials).

**Request Body (for git-credentials):**
```json
{
  "token": "ghp_xxxxxxxxxxxx"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Git credentials configured successfully",
  "connection": {
    "name": "git-credentials",
    "type": "credential",
    "isAvailable": true
  }
}
```

---

### System Information

#### `GET /api/system/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "uptime": 3600
}
```

---

#### `GET /api/system/status`
Get system configuration and status.

**Response:**
```json
{
  "claudeService": {
    "type": "claude-code",
    "available": true,
    "capabilities": ["streaming", "mcp-servers", "git-integration"]
  },
  "authentication": {
    "method": "session",
    "emailLoginEnabled": true,
    "tokenAuthEnabled": true
  },
  "mcpServersConfigured": 3,
  "promptsLoaded": 5,
  "uptime": 3600
}
```

---

#### `GET /api/system/config`
Get configuration information (non-sensitive).

**Response:**
```json
{
  "promptSources": ["examples/prompts.json"],
  "mcpServerSources": ["examples/mcp-servers.json"],
  "claudeService": "claude-code",
  "authorizationEnabled": true,
  "emailServiceConfigured": true
}
```

---

### Execution History

#### `GET /api/executions`
Get recent execution history across all prompts.

**Query Parameters:**
- `limit`: Number of entries (default: 20, max: 100)
- `offset`: Pagination offset (default: 0)
- `status`: Filter by status (`completed`, `failed`, `pending`)
- `user`: Filter by user email (admin only)

**Response:**
```json
{
  "success": true,
  "data": {
    "executions": [
      {
        "id": "exec_123",
        "promptName": "create-jira-issue",
        "timestamp": "2024-01-15T10:30:00Z",
        "userEmail": "user@example.com",
        "status": "completed",
        "duration": 5200,
        "parameters": {...},
        "output": "Issue created successfully: PROJ-123"
      }
    ],
    "pagination": {
      "total": 50,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

#### `GET /api/executions/:executionId`
Get details for a specific execution.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "exec_123",
    "promptName": "create-jira-issue",
    "timestamp": "2024-01-15T10:30:00Z",
    "userEmail": "user@example.com",
    "status": "completed",
    "duration": 5200,
    "parameters": {
      "summary": "Fix login bug",
      "description": "Users cannot log in"
    },
    "messages": [...],
    "toolUses": [...],
    "toolResults": [...],
    "response": {...},
    "error": null
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `404 Not Found`: Execution does not exist

---

## Error Handling

All endpoints use consistent error response format:

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "details": {...},
  "timestamp": "2024-01-15T10:30:00Z"
}
```

Common HTTP status codes:
- `200 OK`: Success
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Access denied
- `404 Not Found`: Resource not found
- `400 Bad Request`: Invalid request
- `500 Internal Server Error`: Server error

## WebSocket/SSE Events

For real-time updates, the frontend can:

1. **Server-Sent Events**: `/api/prompts/:promptName/run` for execution streaming
2. **Polling**: Regular polling of status endpoints for UI updates
3. **Future**: WebSocket connection for real-time notifications

## Frontend Integration Notes

### Data Fetching Strategy
- Use React hooks (`useEffect`, `useState`) or React Query for data fetching
- Implement proper loading states and error handling
- Cache frequently accessed data (prompts list, connections status)

### Authentication Flow
1. Check `/api/user` on app load
2. Redirect to `/login` if not authenticated
3. Use session cookies for all API calls (`credentials: 'include'`)

### Real-time Updates
- Use SSE for prompt execution streaming
- Poll `/api/connections` after authorization flows
- Refresh prompt status after MCP server authorization

### Error Handling
- Display user-friendly error messages
- Handle 401 errors by redirecting to login
- Provide retry mechanisms for failed requests
- Show connection status indicators

This API design provides a complete foundation for a modern React-based frontend that is fully decoupled from server-side rendering and can manage all aspects of the AI Coding Agent through RESTful endpoints.
