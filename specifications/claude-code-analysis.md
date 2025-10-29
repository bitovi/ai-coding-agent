# Claude Code → Figma MCP Connection Analysis

## Session Overview

This Charles Proxy session captures Claude Code's Figma MCP OAuth authorization flow from October 2, 2025. Unlike the VS Code session which showed the complete token exchange, this session only captures the **browser-side authorization flow** because Claude Code's token exchange happens on the backend.

## Key Discoveries

### 1. Claude Code Uses Different OAuth Client

**Claude Code Client ID**: `[REDACTED_CLAUDE_CLIENT_ID]`
- **Different from VS Code**: `[REDACTED_VSCODE_CLIENT_ID]`
- **Application Name**: "Claude Code" (from OAuth payload)
- **Logo**: `https://s3-alpha.figma.com/oauth_img/de38d984-c096-4275-86fb-266a04b3a523`

### 2. OAuth Authorization Flow

#### Authorization URL
```
https://www.figma.com/oauth/mcp?response_type=code&client_id=[REDACTED_CLAUDE_CLIENT_ID]&code_challenge=[REDACTED_CODE_CHALLENGE]&code_challenge_method=S256&redirect_uri=http%3A%2F%2Flocalhost%3A62777%2Fcallback&state=[REDACTED_STATE]&scope=mcp%3Aconnect
```

**Key Parameters:**
- `client_id`: `[REDACTED_CLAUDE_CLIENT_ID]`
- `code_challenge`: `[REDACTED_CODE_CHALLENGE]`
- `code_challenge_method`: `S256` (PKCE)
- `redirect_uri`: `http://localhost:62777/callback`
- `scope`: `mcp:connect`

#### Authorization Code Callback
```
http://localhost:62777/callback?code=[REDACTED_AUTH_CODE]&state=[REDACTED_STATE]
```

**Authorization Code**: `[REDACTED_AUTH_CODE]`

### 3. User Details from Session

From OAuth authorization page analytics:
- **User ID**: `[REDACTED_USER_ID]` 
- **Name**: "[REDACTED_NAME]"
- **Email**: `[REDACTED_EMAIL]`
- **Existing OAuth Clients**: VS Code (`[REDACTED_VSCODE_CLIENT_ID]`) and another client (`[REDACTED_OTHER_CLIENT_ID]`)

### 4. Missing Backend Token Exchange

**What's Missing**: The actual token exchange request (POST to `https://api.figma.com/v1/oauth/token`) is **not captured** in this session because:
- Claude Code processes OAuth callbacks on its backend server
- The authorization code is sent to Claude Code's server at `localhost:62777/callback`
- Token exchange happens server-to-server (not in browser)
- Charles only captured the browser-side authorization flow

## Comparison with VS Code and Our AuthManager

### Similarities
| Aspect | Claude Code | VS Code | Our AuthManager |
|--------|-------------|---------|-----------------|
| **Authorization Endpoint** | `https://www.figma.com/oauth/mcp` | `https://www.figma.com/oauth/mcp` | `https://www.figma.com/oauth/mcp` ✅ |
| **PKCE Usage** | ✅ S256 | ✅ S256 | ✅ S256 |
| **Scope** | `mcp:connect` | `mcp:connect` | `mcp:connect` ✅ |
| **Response Type** | `code` | `code` | `code` ✅ |

### Key Differences 
| Aspect | Claude Code | VS Code | Our AuthManager |
|--------|-------------|---------|-----------------|
| **Client ID** | `[REDACTED_CLAUDE_CLIENT_ID]` | `[REDACTED_VSCODE_CLIENT_ID]` | Dynamic registration (failed) ❌ |
| **Client Type** | Pre-registered confidential | Pre-registered confidential | Dynamic public client ❌ |
| **Token Exchange** | Backend server-to-server | Frontend with client_secret | Frontend without client_secret ❌ |
| **Redirect URI** | `localhost:62777/callback` | `127.0.0.1:33418/` | `localhost:3000/oauth/callback` |
| **Beta Approval** | ✅ Approved | ✅ Approved | ❌ Not registered |

### AuthManager Problems Confirmed

1. **Dynamic Registration**: Both Claude Code and VS Code use **pre-registered** OAuth clients
2. **Client Type**: Both use **confidential clients** with client secrets
3. **Beta Registration**: Both are **pre-approved** by Figma's MCP beta program
4. **Token Exchange**: Both likely use **server-side** token exchange with client_secret

## Behavioral Analysis

### Claude Code's Approach
1. **Pre-registered OAuth Application**: Registered with Figma as "Claude Code"
2. **PKCE for Security**: Uses proper PKCE flow for additional security
3. **Backend Token Exchange**: Processes authorization code on server-side
4. **Beta Program Participation**: Pre-approved by Figma's MCP beta program

### Why Claude Code Works vs Our Approach
1. **Legitimate Client**: Claude Code has official client credentials from Figma
2. **Proper Architecture**: Uses backend server for token exchange (more secure)
3. **Beta Approval**: Part of Figma's approved MCP client program
4. **Confidential Client**: Can use client_secret for authentication

## Conclusions

### Claude Code's Success Factors
1. **Official Registration**: Pre-registered OAuth client with Figma
2. **Beta Program Membership**: Approved participant in Figma's MCP beta
3. **Proper OAuth Flow**: Confidential client with server-side token exchange
4. **PKCE Implementation**: Correct security implementation

### Our Path Forward
1. **Register with Figma**: Submit application to Figma's MCP beta program
2. **Backend Token Exchange**: Move token exchange to server-side
3. **Confidential Client Setup**: Use client_secret in token requests
4. **Follow Claude Code Pattern**: Similar architecture and flow

### Missing Information
- **Token Exchange Details**: Server-side exchange not captured in browser session
- **Client Secret**: Not visible in frontend flow (properly secured)
- **MCP Communication**: Actual MCP requests would happen after token exchange
- **User-Agent**: Backend requests likely use different User-Agent than browser

## Next Steps

1. **Compare with VS Code session** to understand token exchange differences
2. **Apply for Figma MCP beta registration** using their official form
3. **Implement backend token exchange** similar to Claude Code's architecture
4. **Update AuthManager** to handle pre-configured confidential clients

This analysis confirms that both Claude Code and VS Code use the same fundamental approach: **pre-registered confidential OAuth clients with beta program approval**.