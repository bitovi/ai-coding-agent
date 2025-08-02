#!/bin/bash

# Git MCP Server Integration Setup Script
# This script sets up the git-mcp-server integration with ai-coding-agent

set -e

echo "🚀 Setting up Git MCP Server Integration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker and Docker Compose are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Dependencies check passed"
}

# Clone or update git-mcp-server
setup_git_mcp_server() {
    print_status "Setting up git-mcp-server..."
    
    if [ ! -d "git-mcp-server" ]; then
        print_status "Cloning git-mcp-server repository..."
        git clone https://github.com/bitovi/git-mcp-server.git git-mcp-server
        print_success "git-mcp-server cloned successfully"
    else
        print_status "git-mcp-server directory already exists, updating..."
        cd git-mcp-server
        git pull origin main
        cd ..
        print_success "git-mcp-server updated successfully"
    fi
}

# Create shared directories
create_directories() {
    print_status "Creating shared directories..."
    
    mkdir -p shared-repos
    mkdir -p logs
    mkdir -p config
    
    # Set proper permissions
    chmod 755 shared-repos
    chmod 755 logs
    chmod 755 config
    
    print_success "Directories created successfully"
}

# Check Git credentials setup
check_git_credentials() {
    print_status "Checking Git credentials setup..."
    
    # Check if GITHUB_TOKEN is set in environment or .env file
    if [ -z "$GITHUB_TOKEN" ]; then
        print_error "GITHUB_TOKEN is not set"
        echo ""
        echo "Please add your GitHub token to the .env file:"
        echo "  GITHUB_TOKEN=ghp_your_github_token_here"
        echo ""
        echo "For GitHub, use a Personal Access Token with appropriate repository permissions."
        echo "Create one at: https://github.com/settings/tokens"
        return 1
    else
        print_success "GitHub token found in environment"
    fi
    
    # Check Git user configuration from environment or defaults
    if [ -z "$GIT_USER_NAME" ]; then
        print_warning "GIT_USER_NAME not set, will use default: 'AI Coding Agent'"
    else
        print_success "Git user name configured: $GIT_USER_NAME"
    fi
    
    if [ -z "$GIT_USER_EMAIL" ]; then
        print_warning "GIT_USER_EMAIL not set, will use default: 'ai-coding-agent@example.com'"
    else
        print_success "Git user email configured: $GIT_USER_EMAIL"
    fi
}

# Create environment file template
create_env_template() {
    print_status "Creating environment template..."
    
    if [ ! -f ".env.docker" ]; then
        cat > .env.docker << 'EOF'
# Docker Compose Environment Variables
# Copy this to .env and fill in your values

# Anthropic API Key (required)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# GitHub Token (required for Git operations)
GITHUB_TOKEN=ghp_your_github_token_here

# Git user configuration (optional, defaults provided)
GIT_USER_NAME=AI Coding Agent
GIT_USER_EMAIL=ai-coding-agent@example.com

# Google OAuth (optional, for authentication)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Session Secret (required for web sessions)
SESSION_SECRET=your_random_session_secret_here

# Email Configuration (optional, for notifications)
EMAIL_FROM=your_email@example.com
EMAIL_USER=your_smtp_username
EMAIL_PASS=your_smtp_password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

# Disable authentication for development (optional)
# DISABLE_AUTH=true

# Git MCP Server URL (automatically set for Docker Compose)
# GIT_MCP_SERVER_URL=http://git-mcp-server:3010
EOF
        print_success "Environment template created at .env.docker"
        print_warning "Please copy .env.docker to .env and fill in your values"
    else
        print_success "Environment template already exists"
    fi
}

# Validate environment
validate_environment() {
    print_status "Validating environment..."
    
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Using defaults where possible."
        return 0
    fi
    
    # Source .env file
    set -a
    source .env
    set +a
    
    # Check required variables
    if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "your_anthropic_api_key_here" ]; then
        print_error "ANTHROPIC_API_KEY is required in .env file"
        return 1
    fi
    
    if [ -z "$GITHUB_TOKEN" ] || [ "$GITHUB_TOKEN" = "ghp_your_github_token_here" ]; then
        print_error "GITHUB_TOKEN is required in .env file"
        return 1
    fi
    
    if [ -z "$SESSION_SECRET" ] || [ "$SESSION_SECRET" = "your_random_session_secret_here" ]; then
        print_warning "SESSION_SECRET should be set to a random string in .env file"
    fi
    
    print_success "Environment validation passed"
}

# Build Docker images
build_images() {
    print_status "Building Docker images..."
    
    # Check if git-mcp-server needs modifications
    if [ ! -f "git-mcp-server/.docker-ready" ]; then
        print_warning "git-mcp-server may need modifications for Docker integration"
        print_warning "Please apply the modifications described in the integration plan"
        print_warning "After modifications, create a file: touch git-mcp-server/.docker-ready"
        
        read -p "Continue with build anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Build cancelled. Please apply git-mcp-server modifications first."
            exit 0
        fi
    fi
    
    docker-compose build --no-cache
    print_success "Docker images built successfully"
}

# Start services
start_services() {
    print_status "Starting services..."
    
    docker-compose up -d
    
    # Wait for services to be healthy
    print_status "Waiting for services to start..."
    sleep 10
    
    # Check service health
    if docker-compose ps | grep -q "unhealthy"; then
        print_error "Some services are unhealthy. Check logs with: docker-compose logs"
        return 1
    fi
    
    print_success "Services started successfully"
}

# Show status
show_status() {
    print_status "Service Status:"
    docker-compose ps
    
    echo ""
    print_success "Setup completed successfully!"
    echo ""
    echo "🌐 AI Coding Agent: http://localhost:3000"
    echo "🔧 Git MCP Server: http://localhost:3010"
    echo ""
    echo "📋 Useful commands:"
    echo "  docker-compose logs -f                 # View logs"
    echo "  docker-compose down                    # Stop services"
    echo "  docker-compose up -d --build          # Rebuild and restart"
    echo "  docker-compose exec ai-coding-agent sh # Shell into ai-coding-agent"
    echo "  docker-compose exec git-mcp-server sh  # Shell into git-mcp-server"
    echo ""
    echo "📁 Shared repository directory: ./shared-repos"
    echo ""
}

# Main execution
main() {
    echo "🔧 Git MCP Server Integration Setup"
    echo "=================================="
    
    check_dependencies
    setup_git_mcp_server
    create_directories
    check_git_credentials
    create_env_template
    
    if ! validate_environment; then
        print_error "Environment validation failed. Please fix the issues and run again."
        exit 1
    fi
    
    build_images
    start_services
    show_status
}

# Handle script arguments
case "${1:-setup}" in
    "setup")
        main
        ;;
    "build")
        print_status "Building images only..."
        build_images
        ;;
    "start")
        print_status "Starting services..."
        start_services
        show_status
        ;;
    "stop")
        print_status "Stopping services..."
        docker-compose down
        print_success "Services stopped"
        ;;
    "status")
        show_status
        ;;
    "logs")
        docker-compose logs -f
        ;;
    "clean")
        print_warning "This will remove all containers, images, and volumes!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker-compose down -v --rmi all
            docker system prune -f
            print_success "Cleanup completed"
        fi
        ;;
    *)
        echo "Usage: $0 {setup|build|start|stop|status|logs|clean}"
        echo ""
        echo "Commands:"
        echo "  setup  - Full setup (default)"
        echo "  build  - Build Docker images only"
        echo "  start  - Start services"
        echo "  stop   - Stop services"
        echo "  status - Show service status"
        echo "  logs   - Show service logs"
        echo "  clean  - Remove all containers and images"
        exit 1
        ;;
esac
