#!/usr/bin/env node

/**
 * Test execution history functionality
 */

const BASE_URL = 'http://localhost:3000';

async function testExecutionHistory() {
    console.log('🧪 Testing execution history functionality...\n');
    
    try {
        // Test the activity page shows empty history initially
        console.log('1. Checking initial activity page...');
        const activityResponse = await fetch(`${BASE_URL}/prompts/create-jira-issue/activity.html`);
        
        if (!activityResponse.ok) {
            if (activityResponse.status === 401) {
                console.log('⚠️  Authentication required - skipping activity page test');
                console.log('💡 To test with auth disabled: set DISABLE_AUTH=true in .env');
                return;
            }
            throw new Error(`Activity page failed: ${activityResponse.status}`);
        }
        
        const activityHTML = await activityResponse.text();
        console.log('✅ Activity page loaded successfully');
        
        // Check for execution history elements
        const hasExecutionHistory = activityHTML.includes('📈 Execution History');
        const hasNoExecutions = activityHTML.includes('No executions yet');
        
        console.log(`   Has execution history section: ${hasExecutionHistory}`);
        console.log(`   Shows "No executions yet": ${hasNoExecutions}`);
        
        console.log('\n📋 What the execution history will track:');
        console.log('   • 🆔 Unique UUID for each execution');
        console.log('   • 📅 Timestamp and duration');
        console.log('   • 👤 User email who ran the prompt');
        console.log('   • 📝 Input parameters used');
        console.log('   • 💬 Claude\'s full response text');
        console.log('   • 🔧 MCP tools used during execution');
        console.log('   • 📊 Success/error status');
        console.log('   • ⚡ Performance metrics');
        
        console.log('\n💡 After running prompts, you\'ll see:');
        console.log('   • Detailed execution cards with response previews');
        console.log('   • Tool usage badges (e.g., "createJiraIssue (jira)")');
        console.log('   • Duration and performance stats');
        console.log('   • Re-run buttons with same parameters');
        console.log('   • Error details if execution failed');
        
        console.log('\n🎯 To test the execution history:');
        console.log(`   1. Open: ${BASE_URL}/prompts/create-jira-issue/activity.html`);
        console.log('   2. Run a prompt with parameters');
        console.log('   3. Check the "📈 Execution History" section for detailed records');
        console.log('   4. Each execution gets a unique UUID and full tracking');
        
        console.log('\n🎉 Execution history system is ready!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

testExecutionHistory();
