import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('Current working directory:', process.cwd());
console.log('WORKING_DIR env var:', process.env.WORKING_DIR);

let baseDir;
if (process.env.WORKING_DIR) {
  // Resolve relative paths to absolute paths
  baseDir = path.resolve(process.env.WORKING_DIR);
} else {
  baseDir = '/tmp';
}

console.log('Resolved base directory:', baseDir);
console.log('Full claude-code-sdk-service path:', path.join(baseDir, 'claude-code-sdk-service'));
