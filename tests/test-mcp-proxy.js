#!/usr/bin/env node

/**
 * Test script for MCP Proxy functionality
 * 
 * This script tests the MCP proxy endpoints to ensure they work correctly
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testMcpProxyEndpoints() {
  console.log('🧪 Testing MCP Proxy Endpoints');
  console.log(`🎯 Base URL: ${BASE_URL}`);
  
  // Test 1: Get proxy status for Jira
  console.log('\n📊 Test 1: Get Jira proxy status');
  try {
    const response = await fetch(`${BASE_URL}/api/mcp/jira/proxy/status`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Jira proxy status:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Failed to get Jira proxy status:', data);
    }
  } catch (error) {
    console.log('❌ Error testing Jira proxy status:', error.message);
  }
  
  // Test 2: Test proxy request (tools/list)
  console.log('\n🔧 Test 2: Proxy tools/list request');
  try {
    const response = await fetch(`${BASE_URL}/api/mcp/jira/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'tools/list',
        params: {}
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Proxy request successful:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Proxy request failed:', data);
    }
  } catch (error) {
    console.log('❌ Error testing proxy request:', error.message);
  }
  
  // Test 3: Test GitHub proxy status
  console.log('\n📊 Test 3: Get GitHub proxy status');
  try {
    const response = await fetch(`${BASE_URL}/api/mcp/github/proxy/status`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ GitHub proxy status:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Failed to get GitHub proxy status:', data);
    }
  } catch (error) {
    console.log('❌ Error testing GitHub proxy status:', error.message);
  }
  
  // Test 4: Check connections API includes proxy info
  console.log('\n🔗 Test 4: Check connections include proxy info');
  try {
    const response = await fetch(`${BASE_URL}/api/connections`);
    const data = await response.json();
    
    if (response.ok && data.success) {
      const mcpConnections = data.data.connections.filter(c => c.type === 'mcp-server');
      console.log('✅ MCP connections with proxy info:');
      mcpConnections.forEach(conn => {
        console.log(`  - ${conn.name}: proxy=${conn.isProxy}, endpoints=${JSON.stringify(conn.proxyEndpoints)}`);
      });
    } else {
      console.log('❌ Failed to get connections:', data);
    }
  } catch (error) {
    console.log('❌ Error testing connections:', error.message);
  }
  
  console.log('\n🏁 MCP Proxy testing completed');
}

// Only run if called directly
if (process.argv[1].endsWith('test-mcp-proxy.js')) {
  testMcpProxyEndpoints().catch(console.error);
}

export { testMcpProxyEndpoints };
