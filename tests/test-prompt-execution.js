#!/usr/bin/env node

/**
 * Test script to verify prompt execution is working
 */

import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const BASE_URL = 'http://localhost:3000';
const ACCESS_TOKEN = 'test_access_token';

async function testPromptExecution() {
  console.log('🧪 Testing Prompt Execution\n');
  
  try {
    // Step 1: Check if server is running
    console.log('Step 1: Checking if server is running...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    if (!healthResponse.ok) {
      throw new Error(`Server not running: ${healthResponse.status}`);
    }
    console.log('✅ Server is running\n');
    
    // Step 2: Get dashboard page to extract prompts and servers info
    console.log('Step 2: Getting dashboard page data...');
    const dashboardResponse = await fetch(`${BASE_URL}/`, {
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Accept': 'text/html'
      }
    });
    
    if (!dashboardResponse.ok) {
      throw new Error(`Failed to get dashboard: ${dashboardResponse.status}`);
    }
    
    const dashboardHTML = await dashboardResponse.text();
    
    // Parse the HTML to extract prompt information
    const dom = new JSDOM(dashboardHTML);
    const document = dom.window.document;
    
    // Look for prompt cards
    const promptCards = document.querySelectorAll('.prompt-card');
    console.log(`✅ Found ${promptCards.length} prompts in dashboard`);
    
    const prompts = [];
    promptCards.forEach(card => {
      const nameElement = card.querySelector('h3');
      const runButton = card.querySelector('button[onclick*="runPrompt"]');
      
      if (nameElement && runButton) {
        const promptName = runButton.getAttribute('onclick').match(/runPrompt\('([^']+)'\)/)?.[1];
        if (promptName) {
          prompts.push({
            name: promptName,
            displayName: nameElement.textContent.trim()
          });
        }
      }
    });
    
    prompts.forEach(prompt => {
      console.log(`   - ${prompt.name} (${prompt.displayName})`);
    });
    
    if (prompts.length === 0) {
      throw new Error('No prompts found in dashboard');
    }
    console.log('');
    
    // Step 3: Try to run the first prompt
    const testPrompt = prompts[0];
    console.log(`Step 3: Testing prompt execution for "${testPrompt.name}"...`);
    
    // Execute the prompt with sample parameters
    const promptResponse = await fetch(`${BASE_URL}/prompt/${testPrompt.name}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      },
      body: JSON.stringify({ 
        parameters: {
          // Provide sample parameters that might be needed
          summary: 'Test Issue Summary',
          description: 'Test issue description for automated testing',
          repository: 'test/repo',
          filePath: '/test/file.js',
          projectKey: 'TEST',
          timeframe: 7
        }
      })
    });
    
    console.log(`📊 Prompt execution response status: ${promptResponse.status}`);
    
    if (promptResponse.status === 401) {
      // Expected if servers are not authorized
      const errorData = await promptResponse.json();
      console.log('⚠️  Got 401 response - authorization required:');
      console.log(`   Error: ${errorData.error}`);
      console.log(`   Message: ${errorData.message}`);
      if (errorData.unauthorizedServers) {
        console.log(`   Unauthorized servers: ${errorData.unauthorizedServers.join(', ')}`);
      }
      console.log('   → This is expected when MCP servers are not authorized');
      console.log('   → Use the OAuth flow to authorize the required servers');
      
    } else if (promptResponse.status === 200) {
      // Success - should be streaming response
      console.log('✅ Prompt execution started successfully!');
      console.log('   → Server-Sent Events stream has begun');
      
      // Try to read a bit of the stream
      const reader = promptResponse.body.getReader();
      let streamData = '';
      let chunks = 0;
      const maxChunks = 3;
      
      console.log('📡 Reading streaming response...');
      
      try {
        const timeout = setTimeout(() => {
          reader.cancel();
        }, 5000); // 5 second timeout
        
        while (chunks < maxChunks) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = new TextDecoder().decode(value);
          streamData += chunk;
          chunks++;
          
          console.log(`   Chunk ${chunks}: ${chunk.substring(0, 100)}...`);
        }
        
        clearTimeout(timeout);
        reader.releaseLock();
        
      } catch (streamError) {
        console.log('⚠️  Stream reading ended:', streamError.message);
      }
      
    } else if (promptResponse.status === 404) {
      console.log(`❌ Prompt "${testPrompt.name}" not found`);
      console.log('   → This suggests the prompt name extraction from HTML failed');
      throw new Error(`Prompt not found: ${testPrompt.name}`);
      
    } else {
      // Unexpected status
      const responseText = await promptResponse.text();
      console.log(`❌ Unexpected response status: ${promptResponse.status}`);
      console.log(`   Response: ${responseText.substring(0, 300)}...`);
      throw new Error(`Prompt execution failed with status ${promptResponse.status}`);
    }
    
    console.log('\n🎉 Prompt execution test completed!');
    
    // Summary
    console.log('\n📋 Test Summary:');
    console.log('✅ Server is running and responding');
    console.log('✅ Dashboard loads successfully');
    console.log('✅ Prompts are loaded and accessible');
    console.log('✅ Prompt execution endpoint is working');
    
    if (promptResponse.status === 401) {
      console.log('\nℹ️  Next Steps:');
      console.log('1. Authorize required MCP servers using the dashboard');
      console.log('2. Run the OAuth flow tests to authorize services');
      console.log('3. Then re-run this test to see full execution');
    } else if (promptResponse.status === 200) {
      console.log('✅ Full prompt execution flow is working!');
    }
    
  } catch (error) {
    console.error('❌ Prompt execution test failed:', error.message);
    
    console.log('\n🔍 Debugging Information:');
    console.log('Make sure:');
    console.log('1. The development server is running (npm run dev)');
    console.log('2. The ACCESS_TOKEN in .env matches the one used in this test');
    console.log('3. Prompts are configured in examples/prompts.json or environment');
    console.log('4. MCP servers are configured in examples/mcp-servers.json or environment');
    console.log('5. Install jsdom dependency: npm install jsdom');
    
    process.exit(1);
  }
}

// Run the test
testPromptExecution();
