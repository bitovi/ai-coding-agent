#!/usr/bin/env node

/**
 * Test the updated prompt preview format
 */

import { mergeParametersWithDefaults, processPrompt } from '../public/js/prompt-utils.js';

// Test data - simulate the create-jira-issue prompt
const testPrompt = {
  "name": "create-jira-issue",
  "mcp_servers": ["jira"],
  "messages": [
    {
      "role": "user",
      "content": "Create a Jira issue with summary '{{summary}}' and description '{{description}}'. Use issue type '{{issueType}}' if specified, otherwise use 'Task'.",
      "parameters": {
        "type": "object",
        "properties": {
          "summary": {
            "type": "string",
            "description": "Brief summary of the issue"
          },
          "description": {
            "type": "string", 
            "description": "Detailed description of the issue"
          },
          "issueType": {
            "type": "string",
            "description": "Type of issue (Task, Bug, Story, etc.)",
            "default": "Task"
          }
        },
        "required": ["summary", "description"]
      }
    }
  ]
};

console.log('🧪 Testing Updated Preview Format...\n');

// Test with the corrected format (no extra quotes)
const requestParameters = {
  "summary": "Example brief summary of the issue",
  "description": "Example detailed description of the issue"
};

console.log('Input parameters from textarea:');
console.log(JSON.stringify(requestParameters, null, 2));

const mergedParameters = mergeParametersWithDefaults(testPrompt, requestParameters);
console.log('\nMerged with defaults:');
console.log(JSON.stringify(mergedParameters, null, 2));

const processedPrompt = processPrompt(testPrompt, mergedParameters);
console.log('\n🎯 PREVIEW OUTPUT (what the user should see):');
console.log('===============================================');

processedPrompt.messages.forEach((message, index) => {
  console.log(`\nMessage ${index + 1} (${message.role}):`);
  console.log(`"${message.content}"`);
});

console.log('\n===============================================');
console.log('✅ This should show clean parameter substitution without extra quotes!');

// Test what it should NOT show (the old format with extra quotes)
console.log('\n❌ OLD FORMAT (should not happen):');
const badParameters = {
  "summary": "\"Example brief summary of the issue\"",
  "description": "\"Example detailed description of the issue\""
};
const badProcessed = processPrompt(testPrompt, badParameters);
console.log('Bad message content:');
console.log(`"${badProcessed.messages[0].content}"`);
console.log('☝️ Notice the ugly \\"quoted\\" values - this is what we fixed!');
