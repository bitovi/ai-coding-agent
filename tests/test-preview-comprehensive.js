#!/usr/bin/env node

/**
 * Comprehensive test for prompt preview functionality
 */

import { mergeParametersWithDefaults, processPrompt, getMissingRequiredParameters, validateParameters } from '../public/js/prompt-utils.js';

// Simulate the create-jira-issue prompt data that would be in window.currentPrompt
const mockPrompt = {
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

console.log('🧪 Comprehensive Preview Test...\n');

// Test Case 1: Complete parameters (should show all values, including overridden default)
console.log('=== Test Case 1: Complete Parameters ===');
const completeParams = {
  "summary": "Fix login bug",
  "description": "The login form doesn't validate email addresses properly",
  "issueType": "Bug"
};

const mergedComplete = mergeParametersWithDefaults(mockPrompt, completeParams);
const processedComplete = processPrompt(mockPrompt, mergedComplete);
const missingComplete = getMissingRequiredParameters(mockPrompt, mergedComplete);
const errorsComplete = validateParameters(mockPrompt, mergedComplete);

console.log('Request parameters:', JSON.stringify(completeParams, null, 2));
console.log('Merged parameters:', JSON.stringify(mergedComplete, null, 2));
console.log('Missing required:', missingComplete);
console.log('Validation errors:', errorsComplete);
console.log('Processed message content:');
console.log(`  "${processedComplete.messages[0].content}"`);

// Test Case 2: Partial parameters (should use default for issueType)
console.log('\n=== Test Case 2: Partial Parameters (using default) ===');
const partialParams = {
  "summary": "Add user dashboard",
  "description": "Create a new dashboard for user analytics"
};

const mergedPartial = mergeParametersWithDefaults(mockPrompt, partialParams);
const processedPartial = processPrompt(mockPrompt, mergedPartial);
const missingPartial = getMissingRequiredParameters(mockPrompt, mergedPartial);
const errorsPartial = validateParameters(mockPrompt, mergedPartial);

console.log('Request parameters:', JSON.stringify(partialParams, null, 2));
console.log('Merged parameters:', JSON.stringify(mergedPartial, null, 2));
console.log('Missing required:', missingPartial);
console.log('Validation errors:', errorsPartial);
console.log('Processed message content:');
console.log(`  "${processedPartial.messages[0].content}"`);

// Test Case 3: Missing required parameters
console.log('\n=== Test Case 3: Missing Required Parameters ===');
const incompleteParams = {
  "summary": "Test issue"
  // missing description (required)
};

const mergedIncomplete = mergeParametersWithDefaults(mockPrompt, incompleteParams);
const processedIncomplete = processPrompt(mockPrompt, mergedIncomplete);
const missingIncomplete = getMissingRequiredParameters(mockPrompt, mergedIncomplete);
const errorsIncomplete = validateParameters(mockPrompt, mergedIncomplete);

console.log('Request parameters:', JSON.stringify(incompleteParams, null, 2));
console.log('Merged parameters:', JSON.stringify(mergedIncomplete, null, 2));
console.log('Missing required:', missingIncomplete);
console.log('Validation errors:', errorsIncomplete);
console.log('Processed message content:');
console.log(`  "${processedIncomplete.messages[0].content}"`);

console.log('\n✅ All preview tests completed!');
