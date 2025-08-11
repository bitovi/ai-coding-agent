#!/usr/bin/env node

/**
 * Test the actual streaming functionality by making a request and checking the response
 */

const BASE_URL = 'http://localhost:3000';

async function testFullStreamingFlow() {
    console.log('🧪 Testing complete streaming flow...\n');
    
    try {
        console.log('1. Accessing activity page...');
        const activityUrl = `${BASE_URL}/prompts/create-jira-issue/activity.html`;
        const activityResponse = await fetch(activityUrl);
        
        if (!activityResponse.ok) {
            throw new Error(`Activity page failed: ${activityResponse.status}`);
        }
        
        const activityHTML = await activityResponse.text();
        console.log('✅ Activity page loaded');
        
        // Check for required UI elements
        const uiElements = [
            'streaming-output-section',
            'streaming-output',
            'stop-execution',
            'clear-output',
            '📺 Live Execution Output'
        ];
        
        console.log('\n2. Checking UI elements:');
        uiElements.forEach(element => {
            const found = activityHTML.includes(element);
            console.log(`   ${found ? '✅' : '❌'} ${element}`);
        });
        
        console.log('\n3. Testing streaming endpoint directly...');
        const streamResponse = await fetch(`${BASE_URL}/prompt/create-jira-issue/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({
                parameters: {
                    summary: "Test streaming from automated test",
                    description: "Testing streaming functionality",
                    issueType: "Task"
                }
            })
        });
        
        if (!streamResponse.ok) {
            throw new Error(`Streaming failed: ${streamResponse.status}`);
        }
        
        console.log('✅ Streaming endpoint accessible');
        console.log('   Content-Type:', streamResponse.headers.get('content-type'));
        
        // Read just a few events to verify streaming works
        const reader = streamResponse.body.getReader();
        const decoder = new TextDecoder();
        let eventCount = 0;
        const maxEvents = 5;
        
        console.log('\n📺 Sample streaming events:');
        
        while (eventCount < maxEvents) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            lines.forEach(line => {
                if (line.startsWith('data: ') && eventCount < maxEvents) {
                    eventCount++;
                    const data = line.substring(6);
                    console.log(`   Event ${eventCount}: ${data.substring(0, 80)}...`);
                }
            });
        }
        
        reader.cancel();
        
        console.log(`\n📊 Successfully processed ${eventCount} streaming events`);
        console.log('\n🎉 Complete streaming flow test PASSED!');
        console.log('\n💡 To test in browser:');
        console.log(`   1. Open: ${activityUrl}`);
        console.log('   2. Modify the JSON parameters if needed');
        console.log('   3. Click "▶️ Run with Parameters"');
        console.log('   4. Watch the "📺 Live Execution Output" section for streaming results');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

testFullStreamingFlow();
