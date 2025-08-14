#!/bin/bash
set -e

# Required env vars
: "${AWS_SECRET_ACCESS_KEY?Need to set AWS_SECRET_ACCESS_KEY}"
: "${AWS_ACCESS_KEY_ID?Need to set AWS_ACCESS_KEY_ID}"
: "${ANTHROPIC_API_KEY?Need to set ANTHROPIC_API_KEY}"
: "${EMAIL?Need to set EMAIL}"
: "${ACCESS_TOKEN?Need to set ACCESS_TOKEN}"
: "${BASE_URL?Need to set BASE_URL}"
: "${PORT?Need to set PORT}"
: "${MCP_SERVERS?Need to set MCP_SERVERS}"
: "${PROMPTS?Need to set PROMPTS}"
: "${WORKING_DIR?Need to set WORKING_DIR}"
: "${GIT_HOME_DIR?Need to set GIT_HOME_DIR}"
: "${GIT_AUTHOR_NAME?Need to set GIT_AUTHOR_NAME}"
: "${GIT_AUTHOR_EMAIL?Need to set GIT_AUTHOR_EMAIL}"
: "${GIT_TOKEN?Need to set GIT_TOKEN}"
: "${GIT_USERNAME?Need to set GIT_USERNAME}"
: "${OAUTH_REDIRECT_URI?Need to set OAUTH_REDIRECT_URI}"

# Set restrictive permissions for security
umask 077

cat <<EOF > .env
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
EMAIL=$EMAIL
ACCESS_TOKEN=$ACCESS_TOKEN
BASE_URL=$BASE_URL
PORT=$PORT
MCP_SERVERS=$MCP_SERVERS
PROMPTS=$PROMPTS
WORKING_DIR=$WORKING_DIR
GIT_HOME_DIR=$GIT_HOME_DIR
GIT_AUTHOR_NAME=$GIT_AUTHOR_NAME
GIT_AUTHOR_EMAIL=$GIT_AUTHOR_EMAIL
GIT_TOKEN=$GIT_TOKEN
GIT_USERNAME=$GIT_USERNAME
OAUTH_REDIRECT_URI=$OAUTH_REDIRECT_URI
EOF

#VITE_FRONTEND_SENTRY_DSN=$VITE_FRONTEND_SENTRY_DSN
#BACKEND_SENTRY_DSN=$BACKEND_SENTRY_DSN

# Need repo_env for ec2-deploy
cp .env repo_env

# Ensure restrictive permissions on sensitive files
chmod 600 .env repo_env

echo ".env and repo_env created at $(pwd)"

# Cleanup function for security
cleanup() {
    rm -f .env repo_env
}

# Register cleanup on script exit
trap cleanup EXIT