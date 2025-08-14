FROM node:20-alpine

ENV HOME=/home/appuser
# Install system dependencies
RUN apk add --no-cache \
    git \
    wget \
    curl \
    ca-certificates \
    bash \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Create shared repos directory
RUN mkdir -p /shared/repos

# Copy package files first for better Docker layer caching
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install root dependencies first
RUN npm ci --only=production && npm cache clean --force

# Install frontend dependencies
WORKDIR /app/frontend
RUN npm ci && npm cache clean --force

# Copy application code
WORKDIR /app
COPY . .

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Build backend
WORKDIR /app
RUN npm run build:backend

# Copy and set up the Git credentials script
COPY scripts/setup-git-credentials.sh /usr/local/bin/setup-git-credentials.sh
RUN chmod +x /usr/local/bin/setup-git-credentials.sh

# Create non-root user for security
RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app && \
    chown -R appuser:appgroup /shared/repos

# Switch to non-root user
USER appuser

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/config

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV SHELL=/bin/bash

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use the Git setup script as entrypoint
ENTRYPOINT ["/usr/local/bin/setup-git-credentials.sh"]

# Default command
CMD ["npm", "start"]
