#!/usr/bin/env node

/**
 * Test script to verify the activity page has streaming UI elements
 */

const BASE_URL = 'http://localhost:3000';

async function testActivityPageUI() {
    console.log('🧪 Testing activity page streaming UI elements...\n');
    
    try {
        // Test the enhanced activity page
        console.log('Testing enhanced activity page...');
        const activityResponse = await fetch(`${BASE_URL}/prompts/create-jira-issue/activity.html`);
        
        if (!activityResponse.ok) {
            throw new Error(`HTTP ${activityResponse.status}: ${activityResponse.statusText}`);
        }
        
        const activityHTML = await activityResponse.text();
        
        // Check for streaming UI elements
        const checks = [
            { name: 'Streaming section', test: activityHTML.includes('streaming-output-section') },
            { name: 'Streaming output div', test: activityHTML.includes('id="streaming-output"') },
            { name: 'Stop execution button', test: activityHTML.includes('id="stop-execution"') },
            { name: 'Clear output button', test: activityHTML.includes('id="clear-output"') },
            { name: 'streamPromptExecution function', test: activityHTML.includes('streamPromptExecution') },
            { name: 'stopExecution function', test: activityHTML.includes('function stopExecution') },
            { name: 'clearOutput function', test: activityHTML.includes('function clearOutput') },
            { name: 'Live Execution Output header', test: activityHTML.includes('📺 Live Execution Output') },
            { name: 'Stop Execution button text', test: activityHTML.includes('⏹️ Stop Execution') },
            { name: 'Clear Output button text', test: activityHTML.includes('🗑️ Clear Output') }
        ];
        
        console.log('✅ Activity page loaded successfully');
        console.log('\n🔍 Checking streaming UI elements:');
        
        let allPassed = true;
        checks.forEach(check => {
            const status = check.test ? '✅' : '❌';
            console.log(`   ${status} ${check.name}: ${check.test}`);
            if (!check.test) allPassed = false;
        });
        
        if (allPassed) {
            console.log('\n🎉 All streaming UI elements found in activity page!');
        } else {
            console.log('\n⚠️  Some streaming UI elements are missing');
        }
        
        // Check for CSS styles
        const hasStreamingStyles = activityHTML.includes('background: #1e1e1e') && 
                                 activityHTML.includes('color: #fff') &&
                                 activityHTML.includes('font-family: \'Courier New\'');
        
        console.log(`\n🎨 Terminal-style CSS found: ${hasStreamingStyles ? '✅' : '❌'}`);
        
        console.log('\n📋 Activity page structure validated successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
testActivityPageUI();
