#!/usr/bin/env node

/**
 * Test Claude Code SDK with the same directory structure as ClaudeCodeSDKService
 */

import { query } from '@anthropic-ai/claude-code';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

async function testClaudeCodeSDKWithSubdirectory() {
  console.log('🧪 Testing Claude Code SDK with subdirectory approach...');
  console.log('📍 Current working directory:', process.cwd());
  
  // Simulate the ClaudeCodeSDKService logic
  let baseDir;
  if (process.env.WORKING_DIR) {
    baseDir = path.resolve(process.env.WORKING_DIR);
    console.log('📍 Using WORKING_DIR from env:', baseDir);
  } else {
    baseDir = process.cwd(); // Use current dir instead of temp for testing
    console.log('📍 Using current working directory as base:', baseDir);
  }
  
  const workingDir = path.join(baseDir, 'claude-code-sdk-service');
  console.log('📁 Claude Code SDK working directory:', workingDir);
  
  // Ensure directory exists
  await fs.ensureDir(workingDir);
  console.log('✅ Working directory created/verified');
  
  // Simple prompt to write a file and show current directory
  const promptContent = `Please:
1. Show me the current working directory using pwd or similar command
2. Create a simple text file called "service-test.txt" with the content "Hello from ClaudeCodeSDKService pattern!"
3. List the files in the current directory to confirm the file was created`;
  
  const options = {
    maxTurns: 5,
    cwd: workingDir,
    outputFormat: 'stream-json',
    allowedTools: ['Read', 'Write', 'Bash'],
    permissionMode: 'acceptEdits'
  };
  
  console.log('🔧 Claude Code SDK options:', JSON.stringify(options, null, 2));
  console.log('🚀 Executing Claude Code SDK query...');
  
  try {
    const messages = [];
    
    for await (const message of query({
      prompt: promptContent,
      abortController: new AbortController(),
      options
    })) {
      messages.push(message);
      console.log('📦 Message type:', message.type);
      
      if (message.type === 'system' && message.subtype === 'init') {
        console.log('🏗️  System init - CWD:', message.cwd);
      }
      
      if (message.type === 'assistant' && message.message?.content) {
        for (const content of message.message.content) {
          if (content.type === 'text') {
            console.log('💬 Assistant text:', content.text);
          } else if (content.type === 'tool_use') {
            console.log('🔧 Tool use:', content.name);
            console.log('📋 Tool input:', JSON.stringify(content.input, null, 2));
          }
        }
      }
      
      if (message.type === 'result') {
        console.log('🎯 Result type:', message.subtype);
        if (message.subtype === 'success') {
          console.log('✅ Success!');
        } else {
          console.log('❌ Error result:', message.subtype);
        }
      }
    }
    
    // Check what files were created
    console.log('\n🔍 Checking for created files...');
    
    const testFile = path.join(workingDir, 'service-test.txt');
    console.log('🔍 Looking for file at:', testFile);
    if (await fs.pathExists(testFile)) {
      const content = await fs.readFile(testFile, 'utf8');
      console.log('✅ Found test file! Content:', content);
    } else {
      console.log('❌ Test file not found');
    }
    
    // List all files in working directory
    console.log('\n📂 Files in working directory:');
    try {
      const files = await fs.readdir(workingDir);
      for (const file of files) {
        const filePath = path.join(workingDir, file);
        const stats = await fs.stat(filePath);
        console.log(`  ${stats.isDirectory() ? '📁' : '📄'} ${file}`);
      }
    } catch (error) {
      console.log('❌ Error listing files:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Claude Code SDK test failed:', error);
    console.error('🔍 Error stack:', error.stack);
  }
  
  console.log('🏁 Test completed');
}

// Run the test
testClaudeCodeSDKWithSubdirectory().catch(console.error);
