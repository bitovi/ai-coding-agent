#!/usr/bin/env node

/**
 * Quick test to verify spawn works with Claude CLI
 */

import { spawn } from 'child_process';
import { access } from 'fs/promises';

async function testSpawn() {
  console.log('🧪 Testing spawn with Claude CLI...\n');

  try {
    // Check if the CLI exists
    const claudePath = './node_modules/.bin/claude';
    console.log(`1. Checking if CLI exists at: ${claudePath}`);
    
    try {
      await access(claudePath);
      console.log('   ✅ CLI file exists\n');
    } catch (error) {
      console.log('   ❌ CLI file not found\n');
      return;
    }

    // Test basic spawn with --version
    console.log('2. Testing spawn with --version...');
    
    const process = spawn(claudePath, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      console.log(`   Exit code: ${code}`);
      console.log(`   Stdout: ${stdout.trim()}`);
      if (stderr) {
        console.log(`   Stderr: ${stderr.trim()}`);
      }
      
      if (code === 0) {
        console.log('   ✅ Spawn test successful!\n');
        
        // Test with a simple prompt
        testPromptSpawn();
      } else {
        console.log('   ❌ Spawn test failed\n');
      }
    });

    process.on('error', (error) => {
      console.log(`   ❌ Spawn error: ${error.message}\n`);
    });

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function testPromptSpawn() {
  console.log('3. Testing spawn with simple prompt...');
  
  const claudePath = './node_modules/.bin/claude';
  const args = ['-p', '--output-format', 'text', 'Hello, Claude! Please respond with just "Test successful"'];
  
  console.log(`   Command: ${claudePath} ${args.join(' ')}`);
  
  const process = spawn(claudePath, args, {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';

  process.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  process.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  process.on('close', (code) => {
    console.log(`   Exit code: ${code}`);
    console.log(`   Response: ${stdout.trim()}`);
    if (stderr) {
      console.log(`   Stderr: ${stderr.trim()}`);
    }
    
    if (code === 0) {
      console.log('   ✅ Prompt test successful!\n');
    } else {
      console.log('   ❌ Prompt test failed\n');
    }
    
    console.log('🎉 All spawn tests completed!');
  });

  process.on('error', (error) => {
    console.log(`   ❌ Prompt spawn error: ${error.message}\n`);
  });
}

// Run the test
testSpawn().catch(console.error);
