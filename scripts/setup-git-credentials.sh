#!/bin/sh

# Setup Git credentials for the AI Coding Agent
# This script configures Git authentication using environment variables

echo "🔧 Setting up Git configuration..."

# Set default Git user config if provided
if [ -n "$GIT_AUTHOR_NAME" ]; then
    git config --global user.name "$GIT_AUTHOR_NAME"
    echo "✅ Git user.name set to: $GIT_AUTHOR_NAME"
fi

if [ -n "$GIT_AUTHOR_EMAIL" ]; then
    git config --global user.email "$GIT_AUTHOR_EMAIL"
    echo "✅ Git user.email set to: $GIT_AUTHOR_EMAIL"
fi

# Create .git-credentials file if GIT_TOKEN is provided
if [ -n "$GIT_TOKEN" ]; then
    echo "🔐 Setting up Git credentials from GIT_TOKEN..."
    
    # Default username if not provided
    GIT_USERNAME=${GIT_USERNAME:-"token"}
    
    # Ensure home directory exists
    mkdir -p /home/appuser
    
    # Create .git-credentials file
    echo "https://${GIT_USERNAME}:${GIT_TOKEN}@github.com" > /home/appuser/.git-credentials
    
    # Set proper permissions
    chmod 600 /home/appuser/.git-credentials
    
    # Configure git to use the credential store
    git config --global credential.helper store
    git config --global credential.https://github.com.username "$GIT_USERNAME"
    
    echo "✅ Git credentials configured successfully"
else
    echo "⚠️  No GIT_TOKEN provided, skipping Git credential setup"
    echo "   For Git operations requiring authentication, set GIT_TOKEN environment variable"
fi

# Configure git for better Docker/container usage
git config --global init.defaultBranch main
git config --global safe.directory '*'

echo "🎉 Git setup complete!"

# Execute the original command
exec "$@"
