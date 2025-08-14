#!/usr/bin/env node

/**
 * Test the /api/connections endpoint with authorization token support
 */

import fetch from 'node-fetch';

async function testConnectionsEndpoint() {
  console.log('🧪 Testing /api/connections endpoint with authorization token support\n');

  const baseUrl = 'http://localhost:3000';
  
  try {
    const response = await fetch(`${baseUrl}/api/connections`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('✅ Response received:');
    console.log(JSON.stringify(data, null, 2));
    
    // Check if connections exist
    if (data.success && data.data && data.data.connections) {
      console.log('\n📊 Connection Summary:');
      
      for (const connection of data.data.connections) {
        const status = connection.isAvailable ? '✅ Available' : '❌ Not Available';
        console.log(`  ${connection.name} (${connection.type}): ${status}`);
        
        if (connection.type === 'mcp-server') {
          console.log(`    URL: ${connection.details?.url || 'N/A'}`);
          if (connection.details?.lastAuthorized) {
            console.log(`    Last Authorized: ${connection.details.lastAuthorized}`);
          }
        }
      }
      
      // Look for servers that should be available due to authorization_token
      const authorizedServers = data.data.connections.filter(c => 
        c.type === 'mcp-server' && c.isAvailable
      );
      
      if (authorizedServers.length > 0) {
        console.log(`\n🔑 Found ${authorizedServers.length} authorized MCP server(s):`);
        authorizedServers.forEach(server => {
          console.log(`  - ${server.name}: ${server.description}`);
        });
      }
      
    } else {
      console.log('⚠️  Unexpected response format');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Tip: Make sure the development server is running on port 3000');
      console.log('   Run: npm run dev');
    }
  }
}

// Run the test
testConnectionsEndpoint();
