#!/usr/bin/env node

/**
 * Test the actual clone-github-repository prompt with ClaudeCodeSDKService
 */

import { query } from '@anthropic-ai/claude-code';
import fs from 'fs-extra';
import path from 'path';

async function testGitClonePrompt() {
  console.log('🧪 Testing actual git clone prompt with Claude Code SDK...');
  
  // Set up working directory like ClaudeCodeSDKService
  const baseDir = process.env.WORKING_DIR || process.cwd();
  const workingDir = path.join(path.resolve(baseDir), 'claude-code-sdk-service');
  
  console.log('📁 Working directory:', workingDir);
  await fs.ensureDir(workingDir);
  
  // Use the actual prompt content from prompts.json
  const promptContent = `Clone the GitHub repository 'bitovi/bitovi-jira-redirect' to the current working directory using git tools. Make sure to clone it into the current working directory where this process is running, not into any parent directories. If there's already a local copy in the current directory, update it to the latest version by running 'git pull' inside the repository folder.`;
  
  const options = {
    maxTurns: 10,
    cwd: workingDir,
    outputFormat: 'stream-json',
    allowedTools: ['Read', 'Write', 'Bash'],
    permissionMode: 'acceptEdits'
  };
  
  console.log('🔧 Options:', JSON.stringify(options, null, 2));
  console.log('🚀 Testing git clone prompt...');
  
  try {
    let foundCloneCommand = false;
    let actualCwd = null;
    
    for await (const message of query({
      prompt: promptContent,
      abortController: new AbortController(),
      options
    })) {
      
      if (message.type === 'system' && message.subtype === 'init') {
        actualCwd = message.cwd;
        console.log('🏗️  System CWD:', actualCwd);
      }
      
      if (message.type === 'assistant' && message.message?.content) {
        for (const content of message.message.content) {
          if (content.type === 'text') {
            console.log('💬 Assistant:', content.text.substring(0, 200) + '...');
          } else if (content.type === 'tool_use') {
            console.log('🔧 Tool:', content.name);
            console.log('📋 Input:', JSON.stringify(content.input, null, 2));
            
            if (content.name === 'Bash' && content.input.command?.includes('git clone')) {
              foundCloneCommand = true;
              console.log('🎯 Found git clone command!');
            }
          }
        }
      }
      
      if (message.type === 'result') {
        console.log('🎯 Result:', message.subtype);
        if (message.subtype === 'success') {
          console.log('✅ Git operation completed successfully');
        }
      }
    }
    
    // Check the results
    console.log('\n🔍 Checking results...');
    console.log('📁 Expected working directory:', workingDir);
    console.log('📁 Actual CWD from Claude:', actualCwd);
    console.log('🔍 Found git clone command:', foundCloneCommand);
    
    // Check if the repository was cloned
    const repoPath = path.join(workingDir, 'bitovi-jira-redirect');
    console.log('🔍 Checking for repo at:', repoPath);
    
    if (await fs.pathExists(repoPath)) {
      console.log('✅ Repository exists!');
      
      // Check if it's a git repository
      const gitPath = path.join(repoPath, '.git');
      if (await fs.pathExists(gitPath)) {
        console.log('✅ Git repository confirmed');
        
        // List some files in the repo
        const files = await fs.readdir(repoPath);
        console.log('📂 Files in repository:', files.slice(0, 10));
      } else {
        console.log('❌ Not a git repository');
      }
    } else {
      console.log('❌ Repository not found');
      
      // List what's actually in the working directory
      console.log('📂 Contents of working directory:');
      const files = await fs.readdir(workingDir);
      for (const file of files) {
        const filePath = path.join(workingDir, file);
        const stats = await fs.stat(filePath);
        console.log(`  ${stats.isDirectory() ? '📁' : '📄'} ${file}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('🔍 Stack:', error.stack);
  }
  
  console.log('🏁 Git clone test completed');
}

// Run the test
testGitClonePrompt().catch(console.error);
