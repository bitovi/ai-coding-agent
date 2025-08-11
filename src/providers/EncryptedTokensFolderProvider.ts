import path from 'path';
import fs from 'fs';
import { saveTokensToFile, loadTokensFromFile } from '../utils/tokenEncryption.js';

/**
 * Provides encrypted token storage in separate files for each service
 */
export class EncryptedTokensFolderProvider {
  private tokensPath: string;
  private encryptionKey: string;

  constructor(tokensPath: string, encryptionKey: string) {
    this.tokensPath = path.resolve(tokensPath);
    this.encryptionKey = encryptionKey;
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(this.tokensPath)) {
      fs.mkdirSync(this.tokensPath, { recursive: true, mode: 0o700 });
    }
    
    console.log(`🔐 Using encrypted token storage in: ${this.tokensPath}`);
  }

  /**
   * Get tokens for a service
   * Returns null if service doesn't exist, decryption fails, or wrong key
   */
  get(serviceName: string): any | null {
    const filePath = this.getServiceFilePath(serviceName);
    const tokens = loadTokensFromFile(filePath, this.encryptionKey);
    
    if (tokens === null && fs.existsSync(filePath)) {
      // File exists but couldn't decrypt - likely wrong key
      console.warn(`⚠️  Failed to decrypt tokens for ${serviceName} - key may have changed, removing old token file`);
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error(`❌ Failed to remove old token file for ${serviceName}:`, error);
      }
    }
    
    return tokens;
  }

  /**
   * Set tokens for a service
   */
  set(serviceName: string, tokenObject: any): void {
    const filePath = this.getServiceFilePath(serviceName);
    try {
      saveTokensToFile(tokenObject, filePath, this.encryptionKey);
      console.log(`✅ Encrypted tokens saved for ${serviceName}`);
    } catch (error) {
      console.error(`❌ Failed to save encrypted tokens for ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Delete tokens for a service
   */
  delete(serviceName: string): boolean {
    const filePath = this.getServiceFilePath(serviceName);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Deleted tokens for ${serviceName}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Failed to delete tokens for ${serviceName}:`, error);
      return false;
    }
  }

  /**
   * Check if tokens exist for a service
   */
  has(serviceName: string): boolean {
    return this.get(serviceName) !== null;
  }

  /**
   * Get all service names that have tokens
   */
  getServiceNames(): string[] {
    try {
      const files = fs.readdirSync(this.tokensPath);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'))
        .filter(serviceName => this.has(serviceName)); // Only include services with valid tokens
    } catch (error) {
      console.error('❌ Failed to list token files:', error);
      return [];
    }
  }

  /**
   * Get the file path for a service's tokens
   */
  private getServiceFilePath(serviceName: string): string {
    // Sanitize service name to be filesystem-safe
    const safeName = serviceName.replace(/[^a-zA-Z0-9\-_]/g, '_');
    return path.join(this.tokensPath, `${safeName}.json`);
  }
}
