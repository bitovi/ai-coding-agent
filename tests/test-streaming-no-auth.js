#!/usr/bin/env node

/**
 * Test script to verify streaming prompt execution with auth disabled
 */

const BASE_URL = 'http://localhost:3000';

async function testStreamingWithoutAuth() {
    console.log('🧪 Testing streaming execution with DISABLE_AUTH=true...\n');
    
    try {
        // First test that we can access the activity page without auth
        console.log('1. Testing activity page access...');
        const activityResponse = await fetch(`${BASE_URL}/prompts/create-jira-issue/activity.html`);
        
        if (!activityResponse.ok) {
            throw new Error(`Activity page HTTP ${activityResponse.status}: ${activityResponse.statusText}`);
        }
        
        console.log('✅ Activity page accessible without authentication');
        
        // Test the streaming endpoint
        console.log('\n2. Testing SSE streaming endpoint...');
        const response = await fetch(`${BASE_URL}/prompt/create-jira-issue/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({
                parameters: {
                    summary: "Test streaming issue without auth",
                    description: "Testing the streaming functionality with auth disabled",
                    issueType: "Task"
                }
            })
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${response.statusText}\nBody: ${errorText}`);
        }
        
        console.log('✅ Streaming endpoint responded successfully');
        console.log('   Status:', response.status);
        console.log('   Content-Type:', response.headers.get('content-type'));
        
        // Read a few chunks of the streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let eventCount = 0;
        const maxEvents = 10; // Limit to first 10 events for testing
        
        console.log('\n📺 First few streaming events:');
        console.log('---START STREAM---');
        
        while (eventCount < maxEvents) {
            const { done, value } = await reader.read();
            
            if (done) {
                console.log('---STREAM ENDED---');
                break;
            }
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line in buffer
            
            lines.forEach(line => {
                if (line.startsWith('data: ')) {
                    eventCount++;
                    const data = line.substring(6);
                    console.log(`Event ${eventCount}:`, data.substring(0, 100) + (data.length > 100 ? '...' : ''));
                    
                    if (data === '[DONE]') {
                        console.log('✅ Stream completed with [DONE] marker');
                        return;
                    }
                }
            });
        }
        
        // Close the reader
        reader.cancel();
        
        console.log(`\n📊 Processed ${eventCount} events successfully`);
        console.log('\n🎉 Streaming execution test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
testStreamingWithoutAuth();
