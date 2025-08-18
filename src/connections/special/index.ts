import * as gitCredentials from './git-credentials.js';

/**
 * Special connection configuration
 */
export interface SpecialConnectionConfig {
  name: string;
  description: string;
  method: string;
  type: 'credential';
}

/**
 * Connection status interface
 */
export interface ConnectionStatus {
  available: boolean;
  type: string;
  details?: any;
}

/**
 * Setup configuration for credential connections
 */
export interface CredentialSetupConfig {
  token?: string;
}

/**
 * Complete special connection interface that includes both config and methods
 */
export interface SpecialConnection extends SpecialConnectionConfig {
  isAuthorized: () => boolean;
  getDetails: () => any;
  setup: (config: CredentialSetupConfig) => Promise<boolean>;
}

/**
 * Manager for special connections (credential-based connections)
 * Provides a consistent API similar to AuthManager for handling special connections
 */
export class SpecialConnectionsManager {
  private connections: Map<string, SpecialConnection>;

  constructor() {
    this.connections = new Map();
    
    // Register git-credentials connection
    this._registerGitCredentials();
  }

  /**
   * Check if a specific connection is available (similar to AuthManager.isAuthorized)
   * @param connectionName - Name of the connection to check
   * @returns True if the connection is available
   */
  isAvailable(connectionName: string): boolean {
    const connection = this.connections.get(connectionName);
    if (connection && typeof connection.isAuthorized === 'function') {
      try {
        return connection.isAuthorized();
      } catch (error) {
        console.warn(`Error checking connection ${connectionName}:`, error);
        return false;
      }
    }
    return false;
  }

  /**
   * Get connection details (similar to AuthManager.getTokens)
   * @param connectionName - Name of the connection
   * @returns Connection details or undefined
   */
  getConnectionDetails(connectionName: string): any {
    const connection = this.connections.get(connectionName);
    if (connection && typeof connection.getDetails === 'function') {
      try {
        return connection.getDetails();
      } catch (error) {
        console.warn(`Error getting details for connection ${connectionName}:`, error);
        return {};
      }
    }
    return {};
  }

  /**
   * Set up a credential connection (similar to AuthManager authorization methods)
   * @param connectionName - Name of the connection to set up
   * @param config - Setup configuration
   * @returns True if setup was successful
   */
  async setup(connectionName: string, config: CredentialSetupConfig): Promise<boolean> {
    const connection = this.connections.get(connectionName);
    if (connection && typeof connection.setup === 'function') {
      try {
        return await connection.setup(config);
      } catch (error) {
        console.error(`Error setting up connection ${connectionName}:`, error);
        return false;
      }
    }
    return false;
  }

  /**
   * Get all registered connections
   * @returns Array of connection configurations
   */
  getAllConnections(): SpecialConnectionConfig[] {
    return Array.from(this.connections.values()).map(conn => ({
      name: conn.name,
      description: conn.description,
      method: conn.method,
      type: conn.type
    }));
  }

  /**
   * Get connection status details for all registered connections
   * @returns Object mapping connection names to their status
   */
  getAllConnectionStatuses(): Record<string, ConnectionStatus> {
    const statuses: Record<string, ConnectionStatus> = {};
    
    for (const [connectionName, connection] of this.connections) {
      statuses[connectionName] = {
        available: this.isAvailable(connectionName),
        type: connection.type,
        details: this.getConnectionDetails(connectionName)
      };
    }
    
    return statuses;
  }

  /**
   * Check if a connection exists
   * @param connectionName - Name of the connection
   * @returns True if the connection is registered
   */
  hasConnection(connectionName: string): boolean {
    return this.connections.has(connectionName);
  }

  /**
   * Get connection configuration
   * @param connectionName - Name of the connection
   * @returns Connection configuration or undefined
   */
  getConnection(connectionName: string): SpecialConnectionConfig | undefined {
    const connection = this.connections.get(connectionName);
    if (connection) {
      return {
        name: connection.name,
        description: connection.description,
        method: connection.method,
        type: connection.type
      };
    }
    return undefined;
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Register git-credentials connection
   * @private
   */
  private _registerGitCredentials(): void {
    const connectionName = 'git-credentials';
    
    // Register the connection with both config and methods
    this.connections.set(connectionName, {
      name: connectionName,
      description: 'Git credentials for repository access',
      method: 'token',
      type: 'credential',
      isAuthorized: gitCredentials.isAuthorized,
      getDetails: gitCredentials.getDetails,
      setup: gitCredentials.setup
    });
  }
}

// Export singleton instance for use across the application
export const specialConnectionsManager = new SpecialConnectionsManager();

// ==================== BACKWARD COMPATIBILITY ====================

/**
 * Check if git credentials are available for Claude Code operations
 * @returns True if git credentials are configured
 * @deprecated Use specialConnectionsManager.isAvailable('git-credentials') instead
 */
export function validateGitCredentials(): boolean {
  return specialConnectionsManager.isAvailable('git-credentials');
}

/**
 * Get detailed git credential status for debugging
 * @returns Detailed credential status
 * @deprecated Use specialConnectionsManager.getConnectionDetails('git-credentials') instead
 */
export function getGitCredentialDetails(): any {
  return specialConnectionsManager.getConnectionDetails('git-credentials');
}

/**
 * Registry of connection validators
 * Maps connection names to their validator functions
 * @deprecated Use SpecialConnectionsManager instead
 */
export const connectionValidators: Record<string, () => boolean> = {
  'git-credentials': validateGitCredentials
};

/**
 * Check if a specific connection type is available
 * @param connectionType - Type of connection to validate
 * @returns True if the connection is available
 * @deprecated Use specialConnectionsManager.isAvailable instead
 */
export function isConnectionAvailable(connectionType: string): boolean {
  return specialConnectionsManager.isAvailable(connectionType);
}

/**
 * Get connection status details for all registered connection types
 * @returns Object mapping connection types to their status
 * @deprecated Use specialConnectionsManager.getAllConnectionStatuses instead
 */
export function getAllConnectionStatuses(): Record<string, ConnectionStatus> {
  return specialConnectionsManager.getAllConnectionStatuses();
}

// Re-export types for convenience
export type { CredentialDetails } from './git-credentials.js';
