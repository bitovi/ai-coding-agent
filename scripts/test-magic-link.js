#!/usr/bin/env node

import dotenv from 'dotenv';
import { AuthService } from '../src/auth/AuthService.js';
import { EmailProvider } from '../src/providers/EmailProvider.ts';

dotenv.config();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: ts-node scripts/test-magic-link.ts <email>');
    process.exit(1);
  }

  const emailProvider = new EmailProvider();
  const authService = new AuthService(emailProvider);

  try {
    const result = await authService.requestMagicLink(email);
    console.log('Result:', result);
  } catch (err) {
    console.error('Error:', err);
  }
}

main()
	.catch(console.error)
	.then(() => {
		process.exit(0);
	});
