# Git MCP Server Integration Plan

## Overview

This document outlines the plan to integrate the [bitovi/git-mcp-server](https://github.com/bitovi/git-mcp-server) with the ai-coding-agent using Docker Compose. The integration will enable the AI coding agent to perform Git operations (clone, commit, push) on repositories through a shared volume system.

## Architecture

### Current Setup
- **ai-coding-agent**: Node.js Express application providing web UI and MCP client capabilities
- **git-mcp-server**: TypeScript-based MCP server providing Git operations via standardized tools

### Integration Approach
- **Docker Compose**: Orchestrate both services with shared volumes
- **Shared Volume**: `/shared/repos` - Common workspace for Git operations
- **MCP Communication**: ai-coding-agent connects to git-mcp-server via HTTP transport
- **Git Credentials**: Secure credential sharing through volume mounts

## Docker Compose Configuration

### Services

#### 1. git-mcp-server
- **Image**: Built from bitovi/git-mcp-server Dockerfile
- **Transport**: HTTP (port 3010)
- **Working Directory**: `/shared/repos`
- **Environment**:
  - `MCP_TRANSPORT_TYPE=http`
  - `MCP_HTTP_PORT=3010`
  - `MCP_HTTP_HOST=0.0.0.0`
  - `MCP_LOG_LEVEL=info`
- **Volumes**:
  - Shared repos: `/shared/repos`
  - Git credentials: `/home/appuser/.git-credentials`
  - SSH keys: `/home/appuser/.ssh` (if needed)

#### 2. ai-coding-agent
- **Image**: Built from existing ai-coding-agent structure
- **Ports**: 3000:3000 (web interface)
- **Working Directory**: `/shared/repos`
- **Environment**:
  - Standard ai-coding-agent environment variables
  - `GIT_MCP_SERVER_URL=http://git-mcp-server:3010`
- **Volumes**:
  - Shared repos: `/shared/repos`
  - Configuration: `/app/config`
- **Depends On**: git-mcp-server

### Volume Configuration
- **shared-repos**: Named volume for repository storage
- **git-credentials**: Bind mount for Git authentication
- **ssh-keys**: Bind mount for SSH keys (optional)

## Git Credentials Setup

### Options Evaluated

#### Option 1: Git Credentials File (Recommended)
- Mount `~/.git-credentials` file into container
- Simple format: `https://username:token@github.com`
- Automatically used by Git operations
- Secure with proper file permissions

#### Option 2: SSH Key Authentication
- Mount SSH private key and config
- More complex setup but potentially more secure
- Requires SSH key management

#### Option 3: Environment Variables
- Pass credentials as environment variables
- Less secure, credentials visible in process list
- Not recommended for production

### Chosen Approach: Git Credentials File
We'll use the Git credentials file approach for its simplicity and security balance.

## Required Changes

### 1. git-mcp-server Modifications

The git-mcp-server needs minimal changes to support credential file access:

**Dockerfile Enhancement Needed:**
```dockerfile
# Add Git credential helper configuration
RUN git config --global credential.helper store
```

**Runtime Requirements:**
- Ensure the container can access mounted credential files
- Proper file permissions for credential security

### 2. ai-coding-agent Modifications

**New MCP Client Integration:**
- Add HTTP MCP client to connect to git-mcp-server
- Configure MCP server endpoint in environment
- Update service layer to use Git MCP tools

**Environment Configuration:**
```javascript
// Add to ConfigManager.js
GIT_MCP_SERVER_URL: process.env.GIT_MCP_SERVER_URL || 'http://git-mcp-server:3010'
```

### 3. Docker Compose File

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  git-mcp-server:
    build:
      context: ./git-mcp-server
      dockerfile: Dockerfile
    container_name: git-mcp-server
    environment:
      - MCP_TRANSPORT_TYPE=http
      - MCP_HTTP_PORT=3010
      - MCP_HTTP_HOST=0.0.0.0
      - MCP_LOG_LEVEL=info
      - NODE_ENV=production
    ports:
      - "3010:3010"
    volumes:
      - shared-repos:/shared/repos
      - ${HOME}/.git-credentials:/home/appuser/.git-credentials:ro
      - ${HOME}/.gitconfig:/home/appuser/.gitconfig:ro
    working_dir: /shared/repos
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3010/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - ai-coding-network

  ai-coding-agent:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ai-coding-agent
    environment:
      - NODE_ENV=production
      - GIT_MCP_SERVER_URL=http://git-mcp-server:3010
      # ... other existing environment variables
    ports:
      - "3000:3000"
    volumes:
      - shared-repos:/shared/repos
      - ./config:/app/config
    working_dir: /shared/repos
    depends_on:
      git-mcp-server:
        condition: service_healthy
    networks:
      - ai-coding-network

volumes:
  shared-repos:
    driver: local

networks:
  ai-coding-network:
    driver: bridge
```

## Implementation Steps

### Phase 1: Infrastructure Setup

1. **Create git-mcp-server submodule/clone**
   ```bash
   git submodule add https://github.com/bitovi/git-mcp-server.git git-mcp-server
   ```

2. **Create ai-coding-agent Dockerfile**
   ```dockerfile
   FROM node:18-alpine
   
   WORKDIR /app
   
   # Install Git for local operations
   RUN apk add --no-cache git curl
   
   # Copy package files
   COPY package*.json ./
   RUN npm ci --only=production
   
   # Copy application code
   COPY . .
   
   # Create non-root user
   RUN addgroup -S appgroup && adduser -S appuser -G appgroup
   RUN chown -R appuser:appgroup /app
   USER appuser
   
   # Set working directory for shared repos
   RUN mkdir -p /shared/repos
   VOLUME ["/shared/repos"]
   
   EXPOSE 3000
   
   CMD ["npm", "start"]
   ```

3. **Create docker-compose.yml** (as detailed above)

### Phase 2: git-mcp-server Enhancements

**Prompt for git-mcp-server modifications:**

```
I need you to modify the git-mcp-server to better support containerized deployment with Git credentials. Please make the following changes:

1. **Dockerfile Enhancement**: 
   - Add Git credential helper configuration: `RUN git config --global credential.helper store`
   - Ensure the container can properly handle mounted credential files
   - Add a health check endpoint for Docker Compose health monitoring

2. **Health Check Endpoint**:
   - Add a simple HTTP endpoint `/health` that returns 200 OK when the server is ready
   - This should be available when MCP_TRANSPORT_TYPE=http

3. **Git Credential File Handling**:
   - Ensure the server properly uses mounted Git credential files
   - Add logging to indicate when credential files are detected and loaded
   - Handle cases where credential files might not be present

4. **Working Directory Configuration**:
   - Ensure all Git operations respect the container's working directory
   - Add environment variable support for setting default working directory
   - Environment variable: `GIT_DEFAULT_WORKING_DIR` (defaults to current working directory)

5. **Docker-Compose Ready**:
   - Ensure the server can bind to `0.0.0.0` for container networking
   - Add any necessary CORS headers for cross-container communication
   - Test that all Git operations work properly in containerized environment

The goal is to make the git-mcp-server work seamlessly in a Docker Compose environment where it shares a volume with another container (ai-coding-agent) and can access Git credentials through mounted files.

Please ensure all changes maintain backward compatibility with the existing functionality.
```

### Phase 3: ai-coding-agent Integration

1. **Add MCP HTTP Client Support**
   - Install MCP client dependencies
   - Create Git MCP client service
   - Add connection management and retry logic

2. **Service Layer Integration**
   - Extend existing services to use Git MCP tools
   - Add repository management capabilities
   - Implement error handling and status reporting

3. **Configuration Updates**
   - Add Git MCP server configuration options
   - Update environment variable handling
   - Add validation for Git MCP connectivity

### Phase 4: Testing and Deployment

1. **Integration Testing**
   - Test basic Git operations (clone, commit, push)
   - Verify shared volume functionality
   - Test credential file access
   - Validate error handling

2. **Production Readiness**
   - Add monitoring and logging
   - Configure proper security settings
   - Document deployment procedures
   - Create backup and recovery procedures

## Security Considerations

### Git Credentials
- Mount credentials as read-only
- Use proper file permissions (600)
- Consider using temporary credentials with limited scope
- Rotate credentials regularly

### Network Security
- Use internal Docker network for MCP communication
- Don't expose git-mcp-server port to host unless needed
- Implement proper CORS policies
- Add authentication if required

### Volume Security
- Ensure shared volume has proper permissions
- Consider using encrypted volumes for sensitive repositories
- Implement cleanup procedures for temporary files

## Monitoring and Troubleshooting

### Health Checks
- Both services include health check endpoints
- Docker Compose will restart unhealthy containers
- Monitor MCP connection status

### Logging
- Centralized logging for both services
- Structured logs for better debugging
- Include correlation IDs for request tracing

### Common Issues
- **Credential Issues**: Check file permissions and paths
- **Volume Mounting**: Verify shared volume configuration
- **Network Connectivity**: Test MCP HTTP communication
- **Git Operations**: Verify Git binary availability

## Benefits

1. **Isolation**: Each service runs in its own container
2. **Scalability**: Easy to scale or replace components
3. **Security**: Controlled access to Git credentials
4. **Maintainability**: Clear separation of concerns
5. **Development**: Easy local development with Docker Compose
6. **Production**: Production-ready containerized deployment

## Next Steps

1. Implement Phase 1 infrastructure setup
2. Request git-mcp-server modifications using provided prompt
3. Develop ai-coding-agent MCP client integration
4. Test integration end-to-end
5. Document final deployment procedures
6. Create monitoring and maintenance procedures

This integration will provide a robust, secure, and scalable foundation for AI-powered Git operations while maintaining clear separation between the coding agent and Git functionality.
