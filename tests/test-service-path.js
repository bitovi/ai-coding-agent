import { ClaudeServiceFactory } from './src/services/ClaudeServiceFactory.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('Testing Claude Code SDK service path resolution...');
process.env.CLAUDE_SERVICE = 'CLAUDECODESDK';

try {
  const service = ClaudeServiceFactory.create();
  console.log('✅ Service created successfully');
  console.log('✅ Path resolution is working correctly');
} catch (error) {
  console.error('❌ Error creating service:', error.message);
}
