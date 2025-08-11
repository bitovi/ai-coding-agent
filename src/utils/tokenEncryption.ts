import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Hash a string key to create a consistent 32-byte encryption key for AES-256
 */
function createEncryptionKey(keyString: string): Buffer {
  return crypto.createHash('sha256').update(keyString).digest();
}

/**
 * Encrypt data using AES-256-GCM with the provided key
 */
export function encrypt(data: string, encryptionKey: string): string {
  const key = createEncryptionKey(encryptionKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex'),
  });
}

/**
 * Decrypt data using AES-256-GCM with the provided key
 * Returns null if decryption fails (wrong key, corrupted data, etc.)
 */
export function decrypt(jsonStr: string, encryptionKey: string): string | null {
  try {
    const key = createEncryptionKey(encryptionKey);
    const { iv, tag, data } = JSON.parse(jsonStr);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    const decryptedBuffer = Buffer.concat([
      decipher.update(Buffer.from(data, 'hex')),
      decipher.final()
    ]);
    return decryptedBuffer.toString('utf8');
  } catch (error) {
    // Any error in decryption (wrong key, invalid JSON, etc.) returns null
    return null;
  }
}

/**
 * Save a token object to an encrypted file
 */
export function saveTokensToFile(tokenObj: any, filePath: string, encryptionKey: string): void {
  const data = encrypt(JSON.stringify(tokenObj), encryptionKey);
  
  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); // Restricted directory permissions
  }
  
  fs.writeFileSync(filePath, data, { mode: 0o600 }); // Owner read/write only
}

/**
 * Load tokens from an encrypted file
 * Returns null if file doesn't exist, decryption fails, or JSON parsing fails
 */
export function loadTokensFromFile(filePath: string, encryptionKey: string): any | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const encrypted = fs.readFileSync(filePath, 'utf8');
    const decrypted = decrypt(encrypted, encryptionKey);
    
    if (decrypted === null) {
      return null;
    }
    
    return JSON.parse(decrypted);
  } catch (error) {
    // Any error (file read, JSON parse, etc.) returns null
    return null;
  }
}
