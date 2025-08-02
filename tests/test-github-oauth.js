#!/usr/bin/env node

import { GitHubOAuthService } from '../src/auth/GitHubOAuthService.js';
import express from 'express';
import open from 'open';

/**
 * Test script for GitHub OAuth service
 * This demonstrates both web flow and device flow
 */

// Set up test environment variables if not already set
if (!process.env.GITHUB_CLIENT_ID) {
  console.error('❌ GITHUB_CLIENT_ID environment variable is required');
  console.log('   Create a GitHub OAuth app at: https://github.com/settings/applications/new');
  console.log('   Set Authorization callback URL to: http://localhost:3000/oauth/github/callback');
  process.exit(1);
}

if (!process.env.GITHUB_CLIENT_SECRET) {
  console.error('❌ GITHUB_CLIENT_SECRET environment variable is required');
  process.exit(1);
}

const githubOAuth = new GitHubOAuthService();
const app = express();
const port = 3000;

// Parse JSON bodies
app.use(express.json());

// Serve a simple test page
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>GitHub OAuth Test</title></head>
      <body>
        <h1>GitHub OAuth Service Test</h1>
        
        <h2>Web Application Flow</h2>
        <p>Click the button below to test the GitHub OAuth web flow:</p>
        <button onclick="window.location.href='/test/web-flow'">Start Web Flow</button>
        
        <h2>Device Flow</h2>
        <p>Click the button below to test the GitHub OAuth device flow:</p>
        <button onclick="testDeviceFlow()">Start Device Flow</button>
        
        <div id="device-flow-result"></div>
        
        <h2>Stored Sessions</h2>
        <button onclick="showSessions()">Show Sessions</button>
        <div id="sessions-result"></div>
        
        <script>
          async function testDeviceFlow() {
            const response = await fetch('/test/device-flow', { method: 'POST' });
            const data = await response.json();
            
            if (data.error) {
              document.getElementById('device-flow-result').innerHTML = 
                '<p style="color: red;">Error: ' + data.error + '</p>';
              return;
            }
            
            document.getElementById('device-flow-result').innerHTML = 
              '<h3>Device Flow Started</h3>' +
              '<p><strong>User Code:</strong> ' + data.userCode + '</p>' +
              '<p><strong>Verification URL:</strong> <a href="' + data.verificationUri + '" target="_blank">' + data.verificationUri + '</a></p>' +
              '<p>Go to the URL above and enter the user code, then click the button below to check status:</p>' +
              '<button onclick="pollDeviceFlow(\\'' + data.deviceCode + '\\')">Check Status</button>' +
              '<div id="poll-result"></div>';
          }
          
          async function pollDeviceFlow(deviceCode) {
            const response = await fetch('/test/device-flow/poll', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ deviceCode })
            });
            const data = await response.json();
            
            if (data.pending) {
              document.getElementById('poll-result').innerHTML = 
                '<p style="color: orange;">Still waiting for authorization...</p>';
              setTimeout(() => pollDeviceFlow(deviceCode), 5000);
            } else if (data.error) {
              document.getElementById('poll-result').innerHTML = 
                '<p style="color: red;">Error: ' + data.error + '</p>';
            } else {
              document.getElementById('poll-result').innerHTML = 
                '<h4 style="color: green;">Success!</h4>' +
                '<p><strong>User:</strong> ' + data.userInfo.login + ' (' + data.userInfo.name + ')</p>' +
                '<p><strong>Token Type:</strong> ' + data.tokens.token_type + '</p>' +
                '<p><strong>Scopes:</strong> ' + data.tokens.scope + '</p>';
            }
          }
          
          async function showSessions() {
            const response = await fetch('/test/sessions');
            const data = await response.json();
            
            document.getElementById('sessions-result').innerHTML = 
              '<h3>Active Sessions</h3>' +
              '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
          }
        </script>
      </body>
    </html>
  `);
});

// Test web flow
app.get('/test/web-flow', (req, res) => {
  try {
    const sessionId = 'test-web-session-' + Date.now();
    const authUrl = githubOAuth.initiateWebFlow(sessionId, {
      scopes: ['repo', 'user:email', 'read:org']
    });
    
    console.log(`🔗 Redirecting to GitHub OAuth: ${authUrl}`);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Web flow error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle OAuth callback
app.get('/oauth/github/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }
    
    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }
    
    const result = await githubOAuth.handleCallback(code, state);
    
    res.send(`
      <html>
        <head><title>GitHub OAuth Success</title></head>
        <body>
          <h1>🎉 GitHub OAuth Successful!</h1>
          <h2>User Information</h2>
          <ul>
            <li><strong>Username:</strong> ${result.userInfo.login}</li>
            <li><strong>Name:</strong> ${result.userInfo.name || 'N/A'}</li>
            <li><strong>Email:</strong> ${result.userInfo.email || 'N/A'}</li>
            <li><strong>Public Repos:</strong> ${result.userInfo.public_repos}</li>
          </ul>
          
          <h2>Token Information</h2>
          <ul>
            <li><strong>Token Type:</strong> ${result.tokens.token_type}</li>
            <li><strong>Scopes:</strong> ${result.tokens.scope}</li>
            <li><strong>Session ID:</strong> ${result.sessionId}</li>
          </ul>
          
          <h2>Git Credentials</h2>
          <p>You can now use this token for Git operations:</p>
          <pre>git clone https://oauth2:${result.tokens.access_token}@github.com/username/repo.git</pre>
          
          <p><a href="/">← Back to test page</a></p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).send(`
      <html>
        <head><title>OAuth Error</title></head>
        <body>
          <h1>❌ OAuth Error</h1>
          <p>${error.message}</p>
          <p><a href="/">← Back to test page</a></p>
        </body>
      </html>
    `);
  }
});

// Test device flow
app.post('/test/device-flow', async (req, res) => {
  try {
    const sessionId = 'test-device-session-' + Date.now();
    const deviceFlow = await githubOAuth.initiateDeviceFlow(sessionId, {
      scopes: ['repo', 'user:email', 'read:org']
    });
    
    res.json(deviceFlow);
  } catch (error) {
    console.error('Device flow error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Poll device flow
app.post('/test/device-flow/poll', async (req, res) => {
  try {
    const { deviceCode } = req.body;
    
    if (!deviceCode) {
      return res.status(400).json({ error: 'Device code is required' });
    }
    
    const result = await githubOAuth.pollDeviceFlow(deviceCode);
    
    if (result === null) {
      res.json({ pending: true });
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('Device flow poll error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get sessions
app.get('/test/sessions', (req, res) => {
  try {
    const sessions = githubOAuth.getSessions();
    const sessionData = {};
    
    for (const sessionId of sessions) {
      const tokens = githubOAuth.getTokens(sessionId);
      sessionData[sessionId] = {
        hasTokens: !!tokens,
        tokenType: tokens?.token_type,
        scopes: tokens?.scope,
        storedAt: tokens?.stored_at ? new Date(tokens.stored_at).toISOString() : null
      };
    }
    
    res.json(sessionData);
  } catch (error) {
    console.error('Sessions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(port, () => {
  console.log('🚀 GitHub OAuth Test Server started');
  console.log(`📍 Server running at: http://localhost:${port}`);
  console.log('');
  console.log('Setup instructions:');
  console.log('1. Create a GitHub OAuth app at: https://github.com/settings/applications/new');
  console.log('2. Set Authorization callback URL to: http://localhost:3000/oauth/github/callback');
  console.log('3. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables');
  console.log('');
  console.log('Test both flows:');
  console.log('- Web Flow: Standard OAuth redirect flow');
  console.log('- Device Flow: For CLI/headless applications');
  console.log('');
  
  // Open browser automatically
  setTimeout(() => {
    open(`http://localhost:${port}`);
  }, 1000);
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\\n🧹 Cleaning up expired sessions...');
  githubOAuth.cleanupExpiredSessions();
  console.log('👋 Goodbye!');
  process.exit(0);
});
