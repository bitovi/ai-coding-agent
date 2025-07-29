import path from 'path';

/**
 * Service for rendering web UI pages
 */
export class WebUIService {
  constructor() {
    this.baseHTML = this.getBaseHTML();
  }

  /**
   * Render the main index page
   */
  renderIndexPage(req, res, { prompts, mcpServers, authManager, user }) {
    const promptsHTML = this.renderPromptsList(prompts, authManager);
    const connectionsHTML = this.renderConnectionsList(mcpServers, authManager);

    const html = this.baseHTML
      .replace('{{TITLE}}', 'AI Coding Agent Dashboard')
      .replace('{{CONTENT}}', this.getIndexPageContent(promptsHTML, connectionsHTML, user));

    res.send(html);
  }

  /**
   * Render prompt activity page
   */
  renderPromptActivityPage(req, res, { promptName, promptManager, executionHistoryService }) {
    const prompt = promptManager.getPrompt(promptName);
    if (!prompt) {
      return res.status(404).send('Prompt not found');
    }

    // Get actual execution history from ExecutionHistoryService
    const history = executionHistoryService 
      ? executionHistoryService.getPromptHistory(promptName, 20)
      : [];
    
    const activityHTML = this.renderPromptActivity(prompt, history);

    const html = this.baseHTML
      .replace('{{TITLE}}', `${promptName} - Activity`)
      .replace('{{CONTENT}}', activityHTML);

    res.send(html);
  }

  /**
   * Render login page
   */
  renderLoginPage(req, res) {
    const loginPagePath = path.join(process.cwd(), 'public', 'login.html');
    res.sendFile(loginPagePath);
  }

  /**
   * Get base HTML template
   */
  getBaseHTML() {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>{{TITLE}}</title>
          <link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
          <link rel="stylesheet" href="/static/css/styles.css">
      </head>
      <body>
          {{CONTENT}}
          <script type="module" src="/static/js/dashboard.js"></script>
      </body>
      </html>
    `;
  }

  /**
   * Get index page content
   */
  getIndexPageContent(promptsHTML, connectionsHTML, user) {
    return `
      <div class="container">
          <div class="header">
              <h1>🤖 AI Coding Agent</h1>
              <p>Claude Code with MCP Service Integration</p>
              ${user ? this.getUserInfoHTML(user) : ''}
          </div>
          
          <div class="section">
              <div class="section-header">
                  📋 Your Prompts
              </div>
              <div class="section-content">
                  ${promptsHTML}
              </div>
          </div>
          
          <div class="section">
              <div class="section-header">
                  🔗 Your Connections
              </div>
              <div class="section-content">
                  ${connectionsHTML}
              </div>
          </div>
      </div>
    `;
  }

  /**
   * Get user info HTML with logout button
   */
  getUserInfoHTML(user) {
    return `
      <div class="user-info">
        <span class="user-email">👤 ${user.email}</span>
        <button onclick="logout()" class="logout-btn">
          🚪 Logout
        </button>
      </div>
    `;
  }

  /**
   * Render prompts list
   */
  renderPromptsList(prompts, authManager) {
    if (prompts.length === 0) {
      return `
        <div class="empty-state">
          <h3>No prompts configured</h3>
          <p>Configure prompts in your PROMPTS environment variable</p>
        </div>
      `;
    }

    const promptCards = prompts.map(prompt => {
      const mcpServerStatuses = prompt.mcp_servers.map(serverName => {
        const isAuthorized = authManager.isAuthorized(serverName);
        const statusClass = isAuthorized ? 'status-authorized' : 'status-unauthorized';
        return `
          <li>
            <span class="status-indicator ${statusClass}"></span>
            ${serverName}
          </li>
        `;
      }).join('');

      const allAuthorized = prompt.mcp_servers.every(serverName => authManager.isAuthorized(serverName));

      return `
        <div class="card">
          <h3>${prompt.name}</h3>
          <p>${prompt.messages[0]?.content?.substring(0, 100) || 'No description'}...</p>
          <ul class="status-list">
            ${mcpServerStatuses}
          </ul>
          <div class="button-group">
            <a href="/prompts/${encodeURIComponent(prompt.name)}/activity.html" class="btn btn-small">
              📊 Activity
            </a>
            ${allAuthorized ? 
              `<button onclick="runPrompt('${prompt.name}')" class="btn btn-success btn-small">
                ▶️ Run
              </button>` :
              `<button class="btn btn-small btn-disabled" disabled>
                ⏸️ Needs Auth
              </button>`
            }
          </div>
        </div>
      `;
    }).join('');

    return `<div class="grid">${promptCards}</div>`;
  }

  /**
   * Render connections list
   */
  renderConnectionsList(mcpServers, authManager) {
    if (mcpServers.length === 0) {
      return `
        <div class="empty-state">
          <h3>No MCP servers configured</h3>
          <p>Configure MCP servers in your MCP_SERVERS environment variable</p>
        </div>
      `;
    }

    const connectionCards = mcpServers.map(server => {
      const isAuthorized = server.authorization_token || authManager.isAuthorized(server.name);
      const statusClass = isAuthorized ? 'status-authorized' : 'status-unauthorized';
      const statusText = isAuthorized ? 'Authorized' : 'Not Authorized';

      return `
        <div class="card">
          <h3>${server.name}</h3>
          <p><strong>Type:</strong> ${server.type}</p>
          <p><strong>URL:</strong> ${server.url}</p>
          <div class="connection-status">
            <span class="status-indicator ${statusClass}"></span>
            <span>${statusText}</span>
          </div>
          ${!isAuthorized ? 
            `<button onclick="authorizeService('${server.name}')" class="btn btn-success btn-small">
              🔐 Authorize
            </button>` :
            `<button class="btn btn-small btn-disabled" disabled>
              ✅ Connected
            </button>`
          }
        </div>
      `;
    }).join('');

    return `<div class="grid">${connectionCards}</div>`;
  }

  /**
   * Render prompt activity
   */
  renderPromptActivity(prompt, history) {
    const activityItems = history.map(item => {
      const statusClass = item.status === 'completed' ? 'status-success' : 
                         item.status === 'error' ? 'status-error' : 'status-pending';
      
      // Get the response text from execution messages
      const responseText = item.messages
        ?.filter(msg => msg.type === 'content_block_delta' && msg.data.delta?.text)
        .map(msg => msg.data.delta.text)
        .join('') || '';
      
      // Format duration
      const duration = item.duration ? `${item.duration}ms` : 'N/A';
      
      // Count tool uses
      const toolCount = item.toolUses?.length || 0;
      
      return `
        <div class="activity-item">
          <div class="activity-header">
            <div>
              <strong>Execution ${item.id.substring(0, 8)}...</strong>
              <span class="activity-timestamp">${new Date(item.timestamp).toLocaleString()}</span>
              <span class="execution-info">
                Duration: ${duration} | Tools: ${toolCount} | User: ${item.userEmail}
              </span>
            </div>
            <span class="activity-status ${statusClass}">${item.status}</span>
          </div>
          ${item.parameters && Object.keys(item.parameters).length > 0 ? 
            `<p><strong>Parameters:</strong> <code>${JSON.stringify(item.parameters)}</code></p>` : 
            '<p><em>No parameters</em></p>'
          }
          ${responseText ? 
            `<div><strong>Response:</strong>
             <div class="response-output">${responseText}</div>
             </div>` : 
            ''
          }
          ${item.toolUses && item.toolUses.length > 0 ? 
            `<div><strong>Tools Used:</strong>
             ${item.toolUses.map(tool => `<span class="tool-badge">${tool.name} (${tool.server_name})</span>`).join(' ')}
             </div>` : 
            ''
          }
          ${item.error ? 
            `<div class="error-message">
             <strong>Error:</strong> ${item.error.message}
             </div>` : 
            ''
          }
          <button onclick="runPromptWithParameters('${prompt.name}')" class="btn btn-small rerun-button">
            🔄 Re-run with same parameters
          </button>
        </div>
      `;
    }).join('');

    // Extract parameters from prompt messages
    const promptParameters = [];
    prompt.messages.forEach((message, index) => {
      if (message.parameters) {
        promptParameters.push({
          messageIndex: index + 1,
          role: message.role,
          parameters: message.parameters
        });
      }
    });

    // Render messages with syntax highlighting for content
    const messagesHTML = prompt.messages.map((message, index) => {
      const hasParameters = message.parameters ? 'Has parameters' : 'No parameters';
      return `
        <div class="prompt-message">
          <div class="message-header">
            <strong>Message ${index + 1}:</strong> 
            <span class="message-role message-role-${message.role}">
              ${message.role}
            </span>
            <span class="message-meta">${hasParameters}</span>
          </div>
          <div class="message-content">
            <pre>${message.content}</pre>
          </div>
        </div>
      `;
    }).join('');

    // Render parameters schema
    const parametersHTML = promptParameters.length > 0 ? 
      promptParameters.map(paramInfo => {
        const schema = paramInfo.parameters;
        const propertiesHTML = schema.properties ? 
          Object.entries(schema.properties).map(([name, prop]) => {
            const required = schema.required?.includes(name) ? ' (required)' : ' (optional)';
            const defaultValue = prop.default !== undefined ? ` [default: ${JSON.stringify(prop.default)}]` : '';
            const hasDefault = prop.default !== undefined ? ' 🔧' : '';
            return `
              <li class="parameter-item">
                <strong>${name}</strong><span class="parameter-required">${required}${hasDefault}</span>: 
                <em>${prop.type || 'any'}</em>${defaultValue}
                ${prop.description ? `<br><span class="parameter-description">${prop.description}</span>` : ''}
              </li>
            `;
          }).join('') : '<li>No parameters defined</li>';
          
        return `
          <div class="parameter-section">
            <h4 class="parameter-title">Message ${paramInfo.messageIndex} (${paramInfo.role}) Parameters:</h4>
            <ul class="parameter-list">
              ${propertiesHTML}
            </ul>
          </div>
        `;
      }).join('') :
      '<p class="no-parameters">This prompt does not accept parameters</p>';

    // Generate example parameters JSON
    const exampleParams = {};
    promptParameters.forEach(paramInfo => {
      if (paramInfo.parameters.properties) {
        Object.entries(paramInfo.parameters.properties).forEach(([name, prop]) => {
          if (prop.default !== undefined) {
            exampleParams[name] = prop.default;
          } else if (prop.type === 'string') {
            exampleParams[name] = prop.description ? `Example ${prop.description.toLowerCase()}` : `example ${name}`;
          } else if (prop.type === 'number') {
            exampleParams[name] = 42;
          } else if (prop.type === 'boolean') {
            exampleParams[name] = true;
          } else {
            exampleParams[name] = `example ${name}`;
          }
        });
      }
    });

    const exampleParamsJSON = Object.keys(exampleParams).length > 0 ? 
      JSON.stringify(exampleParams, null, 2) : '{}';

    return `
      <div class="container">
        <div class="header">
          <h1>📊 ${prompt.name}</h1>
          <p>Prompt Activity & History</p>
        </div>
        
        <script>
          // Make prompt data available to frontend JavaScript
          window.currentPrompt = ${JSON.stringify(prompt, null, 2)};
        </script>
        
        <div class="section">
          <div class="section-header">
            📋 Prompt Details
          </div>
          <div class="section-content">
            <p><strong>MCP Services:</strong> ${prompt.mcp_servers.join(', ')}</p>
            <p><strong>Messages:</strong> ${prompt.messages.length} message(s)</p>
            
            <h3 class="section-title">📝 Prompt Messages</h3>
            ${messagesHTML}
            
            <h3 class="section-title">⚙️ Parameters</h3>
            ${parametersHTML}
          </div>
        </div>

        <div class="section">
          <div class="section-header">
            ▶️ Run Prompt
          </div>
          <div class="section-content">
            <div class="form-group">
              <label for="prompt-parameters" class="form-label">
                Parameters (JSON):
              </label>
              <textarea 
                id="prompt-parameters" 
                class="form-textarea"
                placeholder="Enter parameters as JSON..."
              >${exampleParamsJSON}</textarea>
              <div class="form-help">
                💡 Tip: Parameters will be substituted into the prompt messages using {{parameterName}} syntax<br/>
                🔧 Parameters with default values will be automatically applied if not specified
              </div>
            </div>
            
            <button onclick="runPromptWithParameters('${prompt.name}')" class="btn button-spacing">
              ▶️ Run with Parameters
            </button>
            <button onclick="runPrompt('${prompt.name}')" class="btn btn-secondary">
              ▶️ Run with Default Parameters
            </button>
            <button onclick="previewPrompt('${prompt.name}')" class="btn btn-secondary">
              👁️ Preview Processed Prompt
            </button>
          </div>
        </div>
        
        <div class="section streaming-section" id="preview-section">
          <div class="section-header">
            👁️ Prompt Preview (with Parameters Applied)
          </div>
          <div class="section-content">
            <div id="preview-output"></div>
            <div class="streaming-controls">
              <button onclick="hidePreview()" class="btn btn-secondary">
                ❌ Hide Preview
              </button>
            </div>
          </div>
        </div>
        
        <div class="section streaming-section" id="streaming-output-section">
          <div class="section-header">
            📺 Live Execution Output
          </div>
          <div class="section-content">
            <div id="streaming-output" class="streaming-output"></div>
            <div class="streaming-controls">
              <button id="stop-execution" onclick="stopExecution()" class="btn btn-secondary button-hidden">
                ⏹️ Stop Execution
              </button>
              <button id="clear-output" onclick="clearOutput()" class="btn btn-secondary button-left-margin">
                🗑️ Clear Output
              </button>
            </div>
          </div>
        </div>
        
        <div class="section">
          <div class="section-header">
            📈 Execution History
          </div>
          <div class="section-content">
            ${history.length === 0 ? 
              `<div class="empty-state">
                <h3>No executions yet</h3>
                <p>Run this prompt to see its activity here</p>
              </div>` : 
              activityItems
            }
          </div>
        </div>
      </div>
    `;
  }
}
