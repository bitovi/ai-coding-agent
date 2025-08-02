#!/usr/bin/env node

/**
 * Isolated test for Claude Code SDK to understand where files are written
 * This test calls the query function directly with hard-coded values
 */

import { query } from '@anthropic-ai/claude-code';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

async function testClaudeCodeSDKIsolated() {
  console.log('🧪 Starting isolated Claude Code SDK test...');
  console.log('📍 Current working directory:', process.cwd());
  console.log('📍 __dirname equivalent:', path.dirname(new URL(import.meta.url).pathname));
  console.log('📍 WORKING_DIR env var:', process.env.WORKING_DIR);
  
  // Set up test directory
  const testDir = path.join(process.cwd(), 'test-claude-code-output');
  console.log('📁 Test directory:', testDir);
  
  // Ensure test directory exists
  await fs.ensureDir(testDir);
  console.log('✅ Test directory created/verified');
  
  // Simple prompt to write a file
  const promptContent = `Please create a simple text file called "test-output.txt" in the current directory with the content "Hello from Claude Code SDK test!". Just write the file, don't explain what you're doing.`;
  
  const options = {
    maxTurns: 3,
    cwd: testDir,  // Set working directory explicitly
    outputFormat: 'stream-json',
    allowedTools: ['Read', 'Write', 'Bash'],
    permissionMode: 'acceptEdits'
  };
  
  console.log('🔧 Claude Code SDK options:', JSON.stringify(options, null, 2));
  console.log('📝 Prompt content:', promptContent);
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
        console.log('🏗️  System init - Available tools:', message.tools);
      }
      
      if (message.type === 'assistant' && message.message?.content) {
        for (const content of message.message.content) {
          if (content.type === 'text') {
            console.log('💬 Assistant text:', content.text.substring(0, 100) + '...');
          } else if (content.type === 'tool_use') {
            console.log('🔧 Tool use:', content.name);
            console.log('📋 Tool input:', JSON.stringify(content.input, null, 2));
          }
        }
      }
      
      if (message.type === 'result') {
        console.log('🎯 Result type:', message.subtype);
        if (message.subtype === 'success') {
          console.log('✅ Success! Session:', message.session_id);
          console.log('⏱️  Duration:', message.duration_ms, 'ms');
          console.log('💰 Cost:', message.total_cost_usd, 'USD');
          console.log('🔄 Turns:', message.num_turns);
        } else {
          console.log('❌ Error result:', message);
        }
      }
    }
    
    console.log('📊 Total messages received:', messages.length);
    
    // Check what files were created and where
    console.log('\n🔍 Checking for created files...');
    
    // Check in test directory
    const testFile = path.join(testDir, 'test-output.txt');
    console.log('🔍 Looking for file at:', testFile);
    if (await fs.pathExists(testFile)) {
      const content = await fs.readFile(testFile, 'utf8');
      console.log('✅ Found test file! Content:', content);
    } else {
      console.log('❌ Test file not found in test directory');
    }
    
    // Check in current working directory
    const cwdFile = path.join(process.cwd(), 'test-output.txt');
    console.log('🔍 Looking for file in CWD:', cwdFile);
    if (await fs.pathExists(cwdFile)) {
      const content = await fs.readFile(cwdFile, 'utf8');
      console.log('✅ Found file in CWD! Content:', content);
    } else {
      console.log('❌ File not found in CWD');
    }
    
    // List all files in test directory
    console.log('\n📂 Files in test directory:');
    try {
      const files = await fs.readdir(testDir);
      for (const file of files) {
        const filePath = path.join(testDir, file);
        const stats = await fs.stat(filePath);
        console.log(`  ${stats.isDirectory() ? '📁' : '📄'} ${file}`);
        
        if (stats.isFile() && file.endsWith('.txt')) {
          const content = await fs.readFile(filePath, 'utf8');
          console.log(`     Content: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
        }
      }
    } catch (error) {
      console.log('❌ Error listing files:', error.message);
    }
    
    // List all files in current working directory
    console.log('\n📂 Files in current working directory:');
    try {
      const files = await fs.readdir(process.cwd());
      const txtFiles = files.filter(f => f.endsWith('.txt'));
      for (const file of txtFiles) {
        console.log(`  📄 ${file}`);
        const content = await fs.readFile(path.join(process.cwd(), file), 'utf8');
        console.log(`     Content: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
      }
    } catch (error) {
      console.log('❌ Error listing CWD files:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Claude Code SDK test failed:', error);
    console.error('🔍 Error stack:', error.stack);
  }
  
  console.log('🏁 Isolated test completed');
}

// Run the test
testClaudeCodeSDKIsolated().catch(console.error);
