# Local Development - Git Repositories Configuration

This guide shows how to configure Git repository storage for local development using environment variables.

## Environment Variable Configuration

The git-mcp-server now uses environment variables for flexible configuration:

- **`WORKING_DIR`**: Where Git repositories are stored
- **`GIT_HOME_DIR`**: Where Git credentials and config are stored

## Quick Setup

### 1. Copy the Environment File
```bash
cp .env.example .env
```

### 2. Edit Your Settings
Edit `.env` and set your values:
```bash
# Required
EMAIL=your.email@example.com
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Git configuration (already set for local development)
WORKING_DIR=./shared-repos
GIT_HOME_DIR=${HOME}
```

### 3. Create the Repositories Directory
```bash
mkdir shared-repos
```

### 4. Run the Application
```bash
# For local development (non-Docker)
npm run dev

# For Docker development
docker-compose up
```

## Configuration Examples

### For Local Development (Recommended)
```bash
# In .env file
WORKING_DIR=./shared-repos       # Relative to project root
GIT_HOME_DIR=${HOME}               # Use your actual home directory
```

### For Docker Production
```bash
# In docker-compose.yml or environment
WORKING_DIR=/shared/repos        # Container path
GIT_HOME_DIR=/home/appuser         # Container user home
```

### For Custom Locations
```bash
# In .env file
WORKING_DIR=/path/to/your/repos  # Any absolute path
GIT_HOME_DIR=/path/to/git/home     # Any absolute path
```

## Benefits of Local Directory

✅ **Easy Access**: You can browse repositories in your file system  
✅ **IDE Integration**: Your IDE can index and search the repositories  
✅ **Git Operations**: You can run git commands directly from your terminal  
✅ **Backup**: Easy to backup with your regular project backups  
✅ **Development**: No need to `docker exec` to access files  

## Directory Structure Example

```
ai-coding-agent/
├── shared-repos/           # ← Git repositories go here
│   ├── my-project/
│   ├── another-repo/
│   └── cloned-library/
├── src/
├── examples/
├── .env
└── docker-compose.yml
```

## Git Credentials for Local Development

For local development, you don't need the Docker credential setup. Just use your normal Git configuration:

```bash
# Check your git config
git config --list

# Set if needed
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

Your existing SSH keys or Git credential helper will work normally.
