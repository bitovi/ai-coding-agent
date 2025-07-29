#!/usr/bin/env node

/**
 * Test the streaming parsing logic with mock SSE data
 */

// Mock Server-Sent Events data like what Claude actually sends
const mockSSEData = `event: status
data: {"message":"Starting prompt execution..."}

event: message_start
data: {"message":{"id":"msg_123","type":"message","role":"assistant","model":"claude-3-5-sonnet-20241022"}}

event: content_block_start
data: {"index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"index":0,"delta":{"type":"text_delta","text":"I'll help you create a Jira issue."}}

event: content_block_delta
data: {"index":0,"delta":{"type":"text_delta","text":" Let me use the Jira tools to do this."}}

event: mcp_tool_use
data: {"server_name":"jira","name":"jira_createJiraIssue","input":{"summary":"Test streaming issue","description":"Testing the streaming functionality","issueType":"Task"}}

event: mcp_tool_result
data: {"tool_use_id":"tool_123","is_error":false,"content":[{"type":"text","text":"Issue created successfully with ID: TEST-123"}]}

event: content_block_delta
data: {"index":0,"delta":{"type":"text_delta","text":" The issue has been created successfully!"}}

event: content_block_stop
data: {"index":0}

event: message_stop
data: {}

event: complete
data: {"message":"Prompt execution completed"}
`;

console.log('🧪 Mock SSE Data for Testing UI:\n');
console.log('This is what the server actually sends:');
console.log('=====================================');
console.log(mockSSEData);
console.log('=====================================\n');

console.log('📋 Expected UI behavior:');
console.log('1. Show: "🚀 Starting execution..."');
console.log('2. Show: "I\'ll help you create a Jira issue."');
console.log('3. Show: " Let me use the Jira tools to do this."');
console.log('4. Show: "🔧 Using tool: jira_createJiraIssue on jira"');
console.log('5. Show: "📄 Tool result:\\nIssue created successfully with ID: TEST-123"');
console.log('6. Show: " The issue has been created successfully!"');
console.log('7. Show: "✅ Execution completed."');
console.log('\n💡 The key insight is that text content comes in content_block_delta events');
console.log('   with eventData.delta.text containing the actual text to display.');
