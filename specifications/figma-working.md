# Figma MCP Service Integration - Complete Analysis

## BREAKTHROUGH: Charles Session Analysis

After recording a successful VS Code → Figma MCP connection with Charles Proxy, I discovered the **complete working flow**. Our previous approach was fundamentally incorrect.

## How VS Code Successfully Connects to Figma

### 1. Pre-registered OAuth Client
VS Code uses a **pre-registered confidential OAuth client**:
- **Client ID**: `[REDACTED_VSCODE_CLIENT_ID]`
- **Client Secret**: `[REDACTED_VSCODE_CLIENT_SECRET]`
- **No dynamic registration required**
- **Uses HYBRID PKCE + Client Secret flow** (not traditional OAuth)

### 2. Correct Token Endpoint
VS Code makes token exchange requests to:
- **Token Endpoint**: `https://api.figma.com/v1/oauth/token` ✅
- **NOT**: `https://mcp.figma.com/oauth/token` ❌ (what we were trying)

### 3. Hybrid PKCE + Client Secret Authentication
The successful token exchange request includes **BOTH**:
- **PKCE parameters**: `code_verifier`, `code_challenge`, `code_challenge_method=S256`
- **Client credentials**: `client_id`, `client_secret`

**This is NOT traditional OAuth** - it's a hybrid approach that combines:
- PKCE for additional security (protection against authorization code interception)
- Client Secret for client authentication (proving the client is legitimate)

From the Charles session, the authorization URL includes PKCE:
```
code_challenge=[REDACTED_CODE_CHALLENGE]&code_challenge_method=S256
```

And the token exchange includes both PKCE and client_secret:
```
code_verifier=[REDACTED_CODE_VERIFIER]&client_secret=[REDACTED_VSCODE_CLIENT_SECRET]
```

### 4. Simple User-Agent
VS Code uses:
- **Programmatic requests**: `User-Agent: node` ✅
- **NOT**: `claude-code/1.0.72` ❌ (what we were using)

### 5. Bearer Token Authentication
The access token is passed to MCP requests as:
```
Authorization: Bearer [REDACTED_ACCESS_TOKEN]
```

## Complete Working Flow (from Charles Session)

### Step 1: Authorization URL Generation
```
GET https://www.figma.com/oauth/mcp?client_id=[REDACTED_VSCODE_CLIENT_ID]&response_type=code&code_challenge=[REDACTED_CODE_CHALLENGE]&code_challenge_method=S256&scope=mcp%3Aconnect&redirect_uri=http%3A%2F%2F127.0.0.1%3A33418%2F&state=[REDACTED_STATE]
```

### Step 2: Token Exchange (The Critical Difference)
```http
POST https://api.figma.com/v1/oauth/token
Content-Type: application/x-www-form-urlencoded
User-Agent: node

client_id=[REDACTED_VSCODE_CLIENT_ID]&grant_type=authorization_code&code=[REDACTED_AUTH_CODE]&redirect_uri=http%3A%2F%2F127.0.0.1%3A33418%2F&code_verifier=[REDACTED_CODE_VERIFIER]&client_secret=[REDACTED_VSCODE_CLIENT_SECRET]
```

**Response:**
```json
{
  "user_id_string": "[REDACTED_USER_ID]",
  "user_id": [REDACTED_USER_ID],
  "access_token": "[REDACTED_ACCESS_TOKEN]",
  "token_type": "bearer",
  "refresh_token": "[REDACTED_REFRESH_TOKEN]",
  "expires_in": 7776000
}
```

### Step 3: MCP Communication
```http
POST https://mcp.figma.com/mcp
Content-Type: application/json
Authorization: Bearer [REDACTED_ACCESS_TOKEN]
User-Agent: node

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {},
      "elicitation": {}
    },
    "clientInfo": {
      "name": "Visual Studio Code",
      "version": "1.104.3"
    }
  }
}
```

## Our AuthManager Problems

### 1. Wrong Approach - Dynamic Registration Not Supported
- **What we did**: Tried to register dynamic OAuth clients via MCP discovery
- **What's required**: Manual client registration through Figma's beta program
- **Root cause**: Figma MCP is in beta and requires pre-approval of all clients

### 2. Wrong Token Endpoint
- **What we did**: Used discovered endpoints from MCP service
- **What works**: Use Figma's standard OAuth token endpoint (`https://api.figma.com/v1/oauth/token`)

### 3. Wrong Authentication Method
- **What we did**: Pure PKCE with `token_endpoint_auth_method: "none"`
- **What works**: Hybrid PKCE + client_secret for confidential clients

### 4. Wrong User-Agent Strategy
- **What we did**: Tried to mimic Claude Code with `claude-code/1.0.72`
- **What works**: Simple `node` for programmatic requests

### 5. Beta Program Oversight
- **What we missed**: Figma MCP requires manual client registration during beta
- **What's needed**: Submit registration form and wait for approval
- **Evidence**: Official Figma documentation states client registration is required⁵

## Solutions & Recommendations

### Option 1: Register Our Own Figma MCP Client (REQUIRED)

**IMPORTANT**: Figma requires **manual client registration** during their MCP beta phase.

**Steps:**
1. Visit the [Figma MCP Server Guide](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server)
2. Submit the client registration form mentioned in their announcement:
   > "During the beta, we're collecting MCP client requests. Please register your client using this form. Our team will review submissions and reach out when we're ready to onboard new clients."
3. Wait for Figma team approval and client credentials
4. Configure the provided `client_id` and `client_secret` in our system

**Why This is Required:**
- Figma is in **beta phase** for MCP services
- All MCP clients must be manually approved
- VS Code works because it's pre-approved by Figma
- Dynamic registration is **not supported** during beta

**Benefits:**
- Official, legitimate approach
- Proper beta program participation
- Access to Figma support during integration
- Future-proof for when beta ends

### Option 2: Use VS Code's Client Credentials (NOT RECOMMENDED)

**Configuration:**
```json
{
  "oauth_provider_configuration": {
    "issuer": "https://www.figma.com",
    "authorization_endpoint": "https://www.figma.com/oauth/mcp",
    "token_endpoint": "https://api.figma.com/v1/oauth/token",
    "client_id": "[REDACTED_VSCODE_CLIENT_ID]",
    "client_secret": "[REDACTED_VSCODE_CLIENT_SECRET]",
    "client_type": "confidential",
    "scopes_supported": ["mcp:connect"]
  }
}
```

**Issues:**
- Uses VS Code's credentials (ethical concerns)
- Could break if VS Code changes their client
- Not sustainable long-term

### Option 3: Update AuthManager for Pre-configured Clients

**Required Changes:**
1. Support pre-configured OAuth clients (bypass discovery)
2. Use correct token endpoint: `https://api.figma.com/v1/oauth/token`
3. Send both PKCE parameters AND client_secret
4. Use `User-Agent: node` for token requests
5. Pass `Authorization: Bearer <token>` to MCP requests

**Code Changes Needed:**
```typescript
// In _exchangeCodeForTokens method
const requestBody = {
  grant_type: 'authorization_code',
  code: code,
  redirect_uri: this.defaultRedirectUri,
  client_id: client.client_id,
  client_secret: clientSecret, // ADD THIS
  code_verifier: codeVerifier
};

// Use simple User-Agent
const tokenResponse = await fetch(tokenEndpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
    'User-Agent': 'node' // CHANGE THIS
  },
  body: new URLSearchParams(requestBody)
});
```

## Recommended Implementation Plan

### Phase 1: Register Figma OAuth App
1. Create official Figma OAuth application
2. Get legitimate client_id and client_secret
3. Configure proper redirect URIs

### Phase 2: Update AuthManager
1. Add support for pre-configured OAuth clients
2. Use standard OAuth token endpoints (not MCP discovery)
3. Support hybrid PKCE + client_secret authentication
4. Use appropriate User-Agent headers

### Phase 3: Update MCP Configuration
1. Add Figma OAuth configuration to mcp-servers.json
2. Remove dynamic discovery for Figma
3. Use pre-configured endpoints and credentials

## Key Insights

1. **Figma MCP is in beta phase** - requires manual client registration, not dynamic registration
2. **Figma doesn't support pure public client PKCE** - they require confidential clients with client_secret
3. **VS Code is pre-approved** - explains why it works while our approach failed
4. **MCP discovery endpoints don't match OAuth endpoints** - use standard Figma OAuth endpoints
5. **User-Agent complexity was unnecessary** - simple `node` works fine

**The fundamental issue**: We were treating Figma like a production MCP service when it's actually in beta with manual client approval requirements.

## Community Research: Figma MCP OAuth Issues

### Limited Figma-Specific MCP Discussions
While searching for community discussions specifically about Figma MCP OAuth authentication problems, the findings were limited. Most MCP OAuth issues in the community relate to general authentication problems rather than Figma-specific integration challenges.

### Key Insights from VS Code Analysis

Based on the Charles Proxy session analysis of VS Code's successful Figma MCP integration, several critical discoveries were made:

1. **MCP OAuth spec bypassed entirely**: VS Code doesn't use MCP-discovered OAuth endpoints, instead using standard Figma OAuth endpoints¹
2. **Dynamic registration avoided**: VS Code uses pre-registered confidential clients rather than attempting dynamic client registration²
3. **Pre-registered clients work**: VS Code uses pre-registered clients, avoiding dynamic registration issues³
4. **Hybrid authentication required**: Figma requires both PKCE parameters AND client_secret, not pure public client PKCE⁴

### Sources and Evidence

¹ **Charles Proxy Analysis**: Token exchange requests go to `https://api.figma.com/v1/oauth/token`, not MCP-discovered endpoints  
² **VS Code Client Credentials**: Uses pre-registered client ID with client secret  
³ **No Dynamic Registration**: No client registration requests observed in successful VS Code → Figma OAuth flow  
⁴ **Token Exchange Analysis**: Both `code_verifier` (PKCE) and `client_secret` included in token requests  
⁵ **Figma Official Documentation**: [MCP Server Guide](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server) - "During the beta, we're collecting MCP client requests. Please register your client using this form."

### Why Our Approach Failed vs VS Code's Success

| Aspect | Our Approach (Failed) | VS Code Approach (Works) |
|--------|----------------------|-------------------------|
| **Client Registration** | Dynamic registration via MCP discovery | Pre-registered confidential client |
| **Authentication Method** | Pure PKCE (`token_endpoint_auth_method: "none"`) | Hybrid PKCE + client_secret |
| **Token Endpoint** | Discovered from MCP service | Standard Figma OAuth endpoint |
| **RFC 8707 Compliance** | Attempted to follow MCP spec exactly | Bypassed MCP OAuth spec entirely |

### Conclusion: Figma's MCP Service Design

Based on the evidence, **Figma's MCP service appears to bypass the official MCP OAuth specification entirely**:

- Uses standard OAuth 2.0 endpoints instead of MCP-discovered endpoints
- Requires pre-registered confidential clients
- Uses hybrid PKCE + client_secret authentication
- Avoids RFC 8707 resource parameter issues

This explains why VS Code works perfectly while spec-compliant MCP clients fail.
