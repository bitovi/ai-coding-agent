#!/usr/bin/env node

/**
 * Test the prompt preview functionality
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

// Test what the preview should show
const requestParameters = {
  "summary": "Example issue summary",
  "description": "Example issue description"
};

console.log('🧪 Testing prompt preview functionality...\n');

console.log('1. Request parameters:');
console.log(JSON.stringify(requestParameters, null, 2));

console.log('\n2. Merged parameters (with defaults):');
const mergedParameters = mergeParametersWithDefaults(testPrompt, requestParameters);
console.log(JSON.stringify(mergedParameters, null, 2));

console.log('\n3. Processed prompt:');
const processedPrompt = processPrompt(testPrompt, mergedParameters);
console.log('Messages:');
processedPrompt.messages.forEach((msg, i) => {
  console.log(`  Message ${i + 1} (${msg.role}):`);
  console.log(`    ${msg.content}`);
});

console.log('\n✅ Preview test completed!');
