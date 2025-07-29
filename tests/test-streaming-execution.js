#!/usr/bin/env node

/**
 * Test script to verify streaming prompt execution functionality
 */

const BASE_URL = 'http://localhost:3000';

async function testStreamingExecution() {
    console.log('🧪 Testing streaming prompt execution...\n');
    
    try {
        // Test the streaming endpoint directly
        console.log('1. Testing SSE streaming endpoint...');
        const response = await fetch(`${BASE_URL}/prompt/create-jira-issue/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({
                parameters: {
                    summary: "Test streaming issue",
                    description: "Testing the streaming functionality",
                    issueType: "Task"
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        console.log('✅ Streaming endpoint responded with status:', response.status);
        console.log('   Content-Type:', response.headers.get('content-type'));
        
        // Read the streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let eventCount = 0;
        
        console.log('📺 Streaming content:');
        console.log('---START STREAM---');
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                console.log('---END STREAM---');
                break;
            }
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line in buffer
            
            lines.forEach(line => {
                if (line.startsWith('data: ')) {
                    eventCount++;
                    const data = line.substring(6);
                    console.log(`Event ${eventCount}:`, data);
                    
                    if (data === '[DONE]') {
                        console.log('✅ Stream completed with [DONE] marker');
                        return;
                    }
                    
                    try {
                        const eventData = JSON.parse(data);
                        if (eventData.type === 'content') {
                            console.log('   Content chunk received:', eventData.content.substring(0, 50) + '...');
                        } else if (eventData.type === 'error') {
                            console.log('   Error event:', eventData.message);
                        }
                    } catch (e) {
                        // Plain text data
                        console.log('   Plain text:', data.substring(0, 50) + '...');
                    }
                }
            });
            
            // Prevent infinite loop in case of issues
            if (eventCount > 100) {
                console.log('⚠️  Stopping after 100 events to prevent infinite loop');
                break;
            }
        }
        
        console.log(`\n📊 Total events received: ${eventCount}`);
        
        // Test the enhanced activity page
        console.log('\n2. Testing enhanced activity page...');
        const activityResponse = await fetch(`${BASE_URL}/prompts/create-jira-issue/activity.html`);
        
        if (!activityResponse.ok) {
            throw new Error(`HTTP ${activityResponse.status}: ${activityResponse.statusText}`);
        }
        
        const activityHTML = await activityResponse.text();
        
        // Check for streaming UI elements
        const hasStreamingSection = activityHTML.includes('streaming-output-section');
        const hasStreamingOutput = activityHTML.includes('streaming-output');
        const hasStopButton = activityHTML.includes('stop-execution');
        const hasClearButton = activityHTML.includes('clear-output');
        const hasStreamingFunctions = activityHTML.includes('streamPromptExecution');
        
        console.log('✅ Activity page loaded successfully');
        console.log('   Has streaming section:', hasStreamingSection);
        console.log('   Has streaming output div:', hasStreamingOutput);
        console.log('   Has stop button:', hasStopButton);
        console.log('   Has clear button:', hasClearButton);
        console.log('   Has streaming functions:', hasStreamingFunctions);
        
        if (hasStreamingSection && hasStreamingOutput && hasStopButton && hasClearButton) {
            console.log('✅ All streaming UI elements found in activity page');
        } else {
            console.log('❌ Some streaming UI elements missing');
        }
        
        console.log('\n🎉 Streaming execution test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
testStreamingExecution();
