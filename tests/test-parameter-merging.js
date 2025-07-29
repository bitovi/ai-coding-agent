#!/usr/bin/env node

/**
 * Test script to verify parameter merging with defaults
 */

import { PromptManager } from '../src/prompts/PromptManager.js';

// Mock AICodingAgent class with just the mergeParametersWithDefaults method
class TestAgent {
  /**
   * Merge request parameters with default values from prompt schema
   */
  mergeParametersWithDefaults(prompt, requestParameters = {}) {
    const mergedParameters = { ...requestParameters };
    
    // Extract all parameter schemas from all messages
    prompt.messages.forEach(message => {
      if (message.parameters && message.parameters.properties) {
        Object.entries(message.parameters.properties).forEach(([paramName, paramSchema]) => {
          // If parameter not provided in request but has a default value, use the default
          if (mergedParameters[paramName] === undefined && paramSchema.default !== undefined) {
            mergedParameters[paramName] = paramSchema.default;
          }
        });
      }
    });
    
    return mergedParameters;
  }
}

async function runTests() {
  console.log('🧪 Testing parameter merging with defaults...\n');
  
  // Set environment variable to use example prompts
  process.env.PROMPTS = 'examples/prompts.json';
  
  const promptManager = new PromptManager();
  await promptManager.loadPrompts();
  const testAgent = new TestAgent();
  
  // Test 1: create-jira-issue prompt with default issueType
  const jiraprompt = promptManager.getPrompt('create-jira-issue');
  if (jiraprompt) {
    console.log('Test 1: create-jira-issue prompt with partial parameters');
    const requestParams = {
      summary: 'Test issue',
      description: 'This is a test issue'
      // issueType omitted - should default to "Task"
    };
    
    const mergedParams = testAgent.mergeParametersWithDefaults(jiraprompt, requestParams);
    console.log('Request parameters:', requestParams);
    console.log('Merged parameters:', mergedParams);
    console.log('✅ Default issueType applied:', mergedParams.issueType === 'Task');
    console.log();
  }
  
  // Test 2: project-status-report prompt with default timeframe
  const statusPrompt = promptManager.getPrompt('project-status-report');
  if (statusPrompt) {
    console.log('Test 2: project-status-report prompt with partial parameters');
    const requestParams = {
      projectKey: 'TEST-PROJECT'
      // timeframe omitted - should default to 7
    };
    
    const mergedParams = testAgent.mergeParametersWithDefaults(statusPrompt, requestParams);
    console.log('Request parameters:', requestParams);
    console.log('Merged parameters:', mergedParams);
    console.log('✅ Default timeframe applied:', mergedParams.timeframe === 7);
    console.log();
  }
  
  // Test 3: Override default value
  if (jiraprompt) {
    console.log('Test 3: create-jira-issue prompt with override');
    const requestParams = {
      summary: 'Bug report',
      description: 'Found a critical bug',
      issueType: 'Bug'  // Override default
    };
    
    const mergedParams = testAgent.mergeParametersWithDefaults(jiraprompt, requestParams);
    console.log('Request parameters:', requestParams);
    console.log('Merged parameters:', mergedParams);
    console.log('✅ Override preserved:', mergedParams.issueType === 'Bug');
    console.log();
  }
  
  // Test 4: No defaults available
  const analyzePrompt = promptManager.getPrompt('analyze-repository');
  if (analyzePrompt) {
    console.log('Test 4: analyze-repository prompt (no defaults)');
    const requestParams = {
      repository: 'owner/repo'
    };
    
    const mergedParams = testAgent.mergeParametersWithDefaults(analyzePrompt, requestParams);
    console.log('Request parameters:', requestParams);
    console.log('Merged parameters:', mergedParams);
    console.log('✅ No changes when no defaults:', JSON.stringify(requestParams) === JSON.stringify(mergedParams));
    console.log();
  }
  
  console.log('🎉 All parameter merging tests completed!');
}

runTests().catch(console.error);
