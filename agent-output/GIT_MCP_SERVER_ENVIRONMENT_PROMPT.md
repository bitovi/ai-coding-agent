# Git MCP Server Environment Variable Configuration

## Prompt for Coding Agent

Please modify the git-mcp-server to use environment variables for Git authentication instead of relying on mounted credential files. This is needed for cloud deployment compatibility.

### Required Changes:

1. **Remove dependency on mounted credential files** (`~/.git-credentials` and `~/.gitconfig`)

2. **Add support for environment variables:**
   - `GITHUB_TOKEN` - GitHub personal access token for authentication
   - `GIT_USER_NAME` - Git user name for commits (default: "AI Coding Agent")  
   - `GIT_USER_EMAIL` - Git user email for commits (default: "ai-coding-agent@example.com")

3. **Update Git configuration logic:**
   - Configure Git credentials programmatically using the `GITHUB_TOKEN`
   - Set up Git user identity using `GIT_USER_NAME` and `GIT_USER_EMAIL`
   - Ensure this works for HTTPS Git operations (clone, push, pull)

4. **Update the Dockerfile** to remove any references to mounted credential files

5. **Add initialization code** that runs on container startup to:
   - Configure Git credentials using: `git config --global credential.helper store`
   - Create credentials in memory/temporary location using the environment variables
   - Set Git user identity: `git config --global user.name` and `git config --global user.email`

6. **Ensure GitHub token authentication works** for both public and private repositories

### Expected Behavior:
- Container should start and configure Git authentication automatically using environment variables
- Should be able to clone private repositories using the provided GitHub token
- Should be able to push commits with the configured user identity
- Should work in cloud environments without mounting host files

### Technical Notes:
- Use Git's credential helper to store credentials temporarily
- Format for GitHub HTTPS authentication: `https://username:token@github.com`
- The token should have appropriate repository permissions (read/write as needed)

Please implement these changes while maintaining all existing functionality of the git-mcp-server.
