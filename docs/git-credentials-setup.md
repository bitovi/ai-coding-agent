# Git Credentials Setup for Docker Deployment

This document explains how to configure Git authentication for the AI Coding Agent when deployed in Docker.

## Overview

The git-mcp-server requires Git access to perform repository operations. When running in Docker, you need to provide authentication credentials for private repositories or push operations.

## Setup Methods

### 1. Environment Variables (Recommended)

Set these environment variables when running the container:

```bash
# Required: GitHub Personal Access Token
GIT_TOKEN=ghp_your_github_token_here

# Optional: Git username (defaults to "token")
GIT_USERNAME=your-github-username

# Git author information for commits
GIT_AUTHOR_NAME="AI Coding Agent"
GIT_AUTHOR_EMAIL="ai-coding-agent@example.com"
```

### 2. Using Docker Compose

```yaml
version: '3.8'
services:
  ai-coding-agent:
    build: .
    environment:
      - GIT_TOKEN=${GIT_TOKEN}
      - GIT_USERNAME=${GIT_USERNAME}
      - GIT_AUTHOR_NAME=AI Coding Agent
      - GIT_AUTHOR_EMAIL=ai-coding-agent@example.com
    volumes:
      - git-repos:/shared/repos
```

### 3. Using Docker Run

```bash
docker run -d \
  -e GIT_TOKEN=ghp_your_token_here \
  -e GIT_AUTHOR_NAME="AI Coding Agent" \
  -e GIT_AUTHOR_EMAIL="ai-agent@example.com" \
  -v git-repos:/shared/repos \
  -p 3000:3000 \
  ai-coding-agent
```

## How It Works

1. **Entrypoint Script**: The container uses `/usr/local/bin/setup-git-credentials.sh` as its entrypoint
2. **Credential Store**: Creates `~/.git-credentials` file with the provided token
3. **Git Config**: Configures Git to use the credential store and sets user information
4. **Working Directory**: The git-mcp-server operates in `/shared/repos` by default

## GitHub Personal Access Token

To create a GitHub Personal Access Token:

1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Click "Generate new token (classic)"
3. Select these scopes:
   - `repo` (for private repositories)
   - `public_repo` (for public repositories)
   - `write:public_key` (if using deploy keys)

## Security Notes

- The `.git-credentials` file is created with 600 permissions (read/write for owner only)
- The container runs as a non-root user (`appuser`)
- Credentials are stored in the container's ephemeral filesystem, not in the image

## Troubleshooting

### Git Authentication Fails
```bash
# Check if credentials are set up
docker exec <container> cat /home/appuser/.git-credentials

# Check git configuration
docker exec <container> git config --list
```

### Permission Issues
```bash
# Check file permissions
docker exec <container> ls -la /home/appuser/.git-credentials

# Check working directory permissions
docker exec <container> ls -la /shared/repos
```

### No GIT_TOKEN Provided
If no `GIT_TOKEN` is provided, the container will start but Git operations requiring authentication will fail. Check the container logs:

```bash
docker logs <container_name>
```

You should see: "⚠️ No GIT_TOKEN provided, skipping Git credential setup"
