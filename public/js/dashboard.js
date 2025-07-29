/**
 * AI Coding Agent - Dashboard JavaScript
 * Interactive functionality for the web interface with secure session-based authentication
 */

import { mergeParametersWithDefaults, processPrompt, getMissingRequiredParameters, validateParameters } from './prompt-utils.js';

/**
 * Initialize dashboard
 */
document.addEventListener('DOMContentLoaded', function() {
    // Show success message if user just logged in
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'login') {
        showMessage('🎉 Login successful! Welcome to your AI Coding Agent dashboard.', 'success');
        
        // Clean up URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
    }
    
    console.log('🤖 AI Coding Agent Dashboard initialized');
});

/**
 * Logout functionality
 */
async function logout() {
    try {
        const response = await fetch('/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            showMessage('👋 Logging out...', 'info');
            setTimeout(() => {
                window.location.href = '/login?message=logged_out';
            }, 1000);
        } else {
            console.error('Logout failed');
            // Still redirect to login page
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Logout error:', error);
        // Still redirect to login page
        window.location.href = '/login';
    }
}

/**
 * Show a message to the user
 */
function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.style.cssText = `
        padding: 12px 16px;
        margin: 20px 0;
        border-radius: 4px;
        font-weight: 500;
        ${type === 'success' ? 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : ''}
        ${type === 'error' ? 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;' : ''}
        ${type === 'info' ? 'background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;' : ''}
    `;
    messageDiv.textContent = message;
    
    const container = document.querySelector('.container') || document.body;
    container.insertBefore(messageDiv, container.firstChild);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 5000);
}

/**
 * Initiate OAuth authorization for an MCP service
 * @param {string} serviceName - Name of the MCP service to authorize
 */
function authorizeService(serviceName) {
    // Show loading state
    const button = event.target;
    const originalText = button.innerHTML;
    button.innerHTML = '🔄 Authorizing...';
    button.disabled = true;

    // Use session-based authentication (cookies are sent automatically)
    fetch(`/mcp/${serviceName}/authorize`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'same-origin' // Include cookies
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                if (response.status === 401) {
                    showMessage('Session expired. Please log in again.', 'error');
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                    return;
                }
                throw new Error(err.message || `HTTP ${response.status}: ${response.statusText}`);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data && data.authUrl) {
            // Open authorization URL in new window
            const authWindow = window.open(data.authUrl, '_blank', 'width=600,height=700');
            
            // Check if authorization was completed
            const checkAuth = setInterval(() => {
                if (authWindow.closed) {
                    clearInterval(checkAuth);
                    // Refresh the page to update authorization status
                    showMessage('Authorization completed. Refreshing dashboard...', 'success');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }
            }, 1000);
        } else {
            showMessage('Failed to initiate authorization', 'error');
            button.innerHTML = originalText;
            button.disabled = false;
        }
    })
    .catch(error => {
        if (error) {
            console.error('Authorization error:', error);
            showMessage('Failed to initiate authorization: ' + error.message, 'error');
        }
        button.innerHTML = originalText;
        button.disabled = false;
    });
}

/**
 * Execute a prompt with default parameters and stream the results
 * @param {string} promptName - Name of the prompt to run
 */
function runPrompt(promptName) {
    // For now, use simple parameters (in a real app you'd want a form)
    const parameters = {};
    
    // Show loading state
    const button = event.target;
    const originalText = button.innerHTML;
    button.innerHTML = '🔄 Running...';
    button.disabled = true;
    
    // Show streaming output section
    const streamingSection = document.getElementById('streaming-output-section');
    const outputDiv = document.getElementById('streaming-output');
    const stopButton = document.getElementById('stop-execution');
    
    streamingSection.style.display = 'block';
    outputDiv.innerHTML = '🚀 Starting execution with default parameters...\n';
    stopButton.style.display = 'inline-block';
    
    // Start streaming execution
    streamPromptExecution(promptName, parameters, outputDiv, stopButton, button, originalText);
}

/**
 * Execute a prompt with custom parameters from textarea and stream the results
 * @param {string} promptName - Name of the prompt to run
 */
function runPromptWithParameters(promptName) {
    // Get parameters from textarea
    const textarea = document.getElementById('prompt-parameters');
    let parameters = {};
    
    try {
        const paramText = textarea.value.trim();
        if (paramText) {
            parameters = JSON.parse(paramText);
        }
    } catch (error) {
        showMessage('Invalid JSON in parameters field: ' + error.message, 'error');
        return;
    }
    
    // Show loading state
    const button = event.target;
    const originalText = button.innerHTML;
    button.innerHTML = '🔄 Running...';
    button.disabled = true;
    
    // Show streaming output section
    const streamingSection = document.getElementById('streaming-output-section');
    const outputDiv = document.getElementById('streaming-output');
    const stopButton = document.getElementById('stop-execution');
    
    streamingSection.style.display = 'block';
    outputDiv.innerHTML = '🚀 Starting execution...\n';
    stopButton.style.display = 'inline-block';
    
    // Start streaming execution
    streamPromptExecution(promptName, parameters, outputDiv, stopButton, button, originalText);
}

/**
 * Stream prompt execution results using Server-Sent Events
 * @param {string} promptName - Name of the prompt to run
 * @param {Object} parameters - Parameters for the prompt
 * @param {HTMLElement} outputDiv - Element to display streaming output
 * @param {HTMLElement} stopButton - Stop execution button
 * @param {HTMLElement} runButton - The run button to reset
 * @param {string} originalButtonText - Original text of the run button
 */
function streamPromptExecution(promptName, parameters, outputDiv, stopButton, runButton, originalButtonText) {
    // Use fetch to start the streaming request
    fetch(`/prompt/${promptName}/run`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ parameters })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                if (response.status === 401) {
                    showMessage('Session expired. Please log in again.', 'error');
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                    return;
                }
                throw new Error(err.message || 'Failed to run prompt');
            });
        }
        
        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        function readStream() {
            return reader.read().then(({ done, value }) => {
                if (done) {
                    outputDiv.innerHTML += '\n✅ Execution completed.\n';
                    stopButton.style.display = 'none';
                    runButton.innerHTML = originalButtonText;
                    runButton.disabled = false;
                    
                    // Show success message and reload history after a delay
                    showMessage('Prompt execution completed!', 'success');
                    /*setTimeout(() => {
                        // Refresh the execution history section
                        window.location.reload();
                    }, 2000);*/
                    return;
                }
                
                // Decode the chunk and process SSE data
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer
                
                let currentEvent = '';
                lines.forEach(line => {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.substring(7);
                    } else if (line.startsWith('data: ')) {
                        const data = line.substring(6);
                        if (data === '[DONE]') {
                            outputDiv.innerHTML += '\n✅ Execution completed.\n';
                            stopButton.style.display = 'none';
                            runButton.innerHTML = originalButtonText;
                            runButton.disabled = false;
                            
                            showMessage('Prompt execution completed!', 'success');
                            setTimeout(() => {
                                window.location.reload();
                            }, 2000);
                            return;
                        }
                        
                        try {
                            const eventData = JSON.parse(data);
                            
                            // Handle different SSE event types from Claude
                            if (currentEvent === 'content_block_delta' && eventData.delta && eventData.delta.text) {
                                // This is the actual text content from Claude
                                outputDiv.innerHTML += eventData.delta.text;
                                outputDiv.scrollTop = outputDiv.scrollHeight; // Auto-scroll
                            } else if (currentEvent === 'status' && eventData.message === 'Starting prompt execution...') {
                                // Initial status message - already shown in the UI
                            } else if (currentEvent === 'complete' && eventData.message === 'Prompt execution completed') {
                                // Completion message
                                outputDiv.innerHTML += '\n✅ Execution completed.\n';
                                stopButton.style.display = 'none';
                                runButton.innerHTML = originalButtonText;
                                runButton.disabled = false;
                                showMessage('Prompt execution completed!', 'success');
                                setTimeout(() => {
                                    window.location.reload();
                                }, 2000);
                                return;
                            } else if (currentEvent === 'error' || eventData.error) {
                                // Error event
                                const errorMsg = eventData.error || eventData.message || 'Unknown error';
                                outputDiv.innerHTML += `\n❌ Error: ${errorMsg}\n`;
                                outputDiv.scrollTop = outputDiv.scrollHeight;
                            } else if (currentEvent === 'mcp_tool_use' && eventData.server_name && eventData.name) {
                                // MCP tool use event
                                outputDiv.innerHTML += `\n🔧 Using tool: ${eventData.name} on ${eventData.server_name}\n`;
                                outputDiv.scrollTop = outputDiv.scrollHeight;
                            } else if (currentEvent === 'mcp_tool_result' && eventData.content) {
                                // MCP tool result
                                const resultText = Array.isArray(eventData.content) 
                                    ? eventData.content.map(c => c.text || JSON.stringify(c)).join('\n')
                                    : eventData.content;
                                outputDiv.innerHTML += `📄 Tool result:\n${resultText}\n`;
                                outputDiv.scrollTop = outputDiv.scrollHeight;
                            }
                            // Ignore other event types like message_start, content_block_start, etc.
                            
                        } catch (e) {
                            // If not JSON, treat as plain text
                            outputDiv.innerHTML += data;
                            outputDiv.scrollTop = outputDiv.scrollHeight;
                        }
                    }
                });
                
                return readStream();
            });
        }
        
        return readStream();
    })
    .catch(error => {
        if (error) {
            console.error('Execution error:', error);
            outputDiv.innerHTML += `\n❌ Error: ${error.message}\n`;
            showMessage('Failed to run prompt: ' + error.message, 'error');
        }
        stopButton.style.display = 'none';
        runButton.innerHTML = originalButtonText;
        runButton.disabled = false;
    });
}

/**
 * Stop the current prompt execution
 */
function stopExecution() {
    // Note: In a real implementation, you'd want to send a cancellation request to the server
    // For now, we'll just hide the stop button and show a message
    const stopButton = document.getElementById('stop-execution');
    const outputDiv = document.getElementById('streaming-output');
    
    stopButton.style.display = 'none';
    outputDiv.innerHTML += '\n⚠️ Execution stopped by user.\n';
    
    showMessage('Execution stopped', 'info');
}

/**
 * Clear the streaming output display
 */
function clearOutput() {
    const outputDiv = document.getElementById('streaming-output');
    outputDiv.innerHTML = '';
}

/**
 * Preview the processed prompt with current parameters
 * @param {string} promptName - Name of the prompt to preview
 */
function previewPrompt(promptName) {
    try {
        // Get current prompt data
        const prompt = window.currentPrompt;
        if (!prompt) {
            showMessage('Prompt data not available', 'error');
            return;
        }
        
        // Get parameters from textarea
        const textarea = document.getElementById('prompt-parameters');
        let requestParameters = {};
        
        try {
            const paramText = textarea.value.trim();
            if (paramText) {
                requestParameters = JSON.parse(paramText);
            }
        } catch (error) {
            showMessage('Invalid JSON in parameters field: ' + error.message, 'error');
            return;
        }
        
        // Merge with defaults and process the prompt
        const mergedParameters = mergeParametersWithDefaults(prompt, requestParameters);
        const processedPrompt = processPrompt(prompt, mergedParameters);
        
        // Validate parameters
        const missingRequired = getMissingRequiredParameters(prompt, mergedParameters);
        const validationErrors = validateParameters(prompt, mergedParameters);
        
        // Show preview section
        const previewSection = document.getElementById('preview-section');
        const previewOutput = document.getElementById('preview-output');
        
        let previewHTML = '';
        
        // Show parameter status if there are issues
        if (missingRequired.length > 0) {
            previewHTML += `<div class="error-message">
                <strong>Missing Required Parameters:</strong> ${missingRequired.join(', ')}
            </div>`;
        }
        
        if (validationErrors.length > 0) {
            previewHTML += `<div class="error-message">
                <strong>Validation Errors:</strong><br>
                ${validationErrors.map(err => `• ${err}`).join('<br>')}
            </div>`;
        }
        
        processedPrompt.messages.forEach((message, index) => {
            const roleClass = message.role === 'user' ? 'message-role-user' : 'message-role-assistant';
            
            previewHTML += `
                <div class="prompt-message" style="margin-top: 10px;">
                    <div>
                        <strong>Message ${index + 1}:</strong>
                        <span class="message-role ${roleClass}">${message.role}</span>
                    </div>
                    <div class="message-content">
                        <pre>${message.content}</pre>
                    </div>
                </div>
            `;
        });
        
        
        previewOutput.innerHTML = previewHTML;
        previewSection.style.display = 'block';
        
        // Scroll to preview section
        previewSection.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Preview error:', error);
        showMessage('Error generating preview: ' + error.message, 'error');
    }
}

/**
 * Hide the prompt preview
 */
function hidePreview() {
    const previewSection = document.getElementById('preview-section');
    previewSection.style.display = 'none';
}

// Make functions available globally for onclick handlers
window.logout = logout;
window.authorizeService = authorizeService;
window.runPrompt = runPrompt;
window.runPromptWithParameters = runPromptWithParameters;
window.stopExecution = stopExecution;
window.clearOutput = clearOutput;
window.previewPrompt = previewPrompt;
window.hidePreview = hidePreview;

/**
 * Handle keyboard shortcuts and other dashboard interactions
 */
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + R to refresh
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        showMessage('Refreshing dashboard...', 'info');
        setTimeout(() => {
            window.location.reload();
        }, 500);
    }
});
