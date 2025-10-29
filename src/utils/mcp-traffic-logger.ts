import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const appendFile = promisify(fs.appendFile);
const mkdir = promisify(fs.mkdir);

interface LogEntry {
  timestamp: string;
  requestId: string;
  mcpName: string;
  direction: 'REQUEST' | 'RESPONSE' | 'STREAM_CHUNK' | 'ERROR';
  event: string;
  data: any;
}

interface RequestLogData {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  isStreaming?: boolean;
}

interface ResponseLogData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: any;
  isStreaming?: boolean;
  contentType?: string;
}

interface StreamChunkLogData {
  chunkNumber: number;
  chunkSize: number;
  content: string;
  isSSE?: boolean;
}

interface ErrorLogData {
  error: string;
  message: string;
  stack?: string;
  context?: any;
}

export class McpTrafficLogger {
  private logsDir: string;
  private sessionId: string;

  constructor(logsDir: string = './logs/mcp-traffic') {
    this.logsDir = logsDir;
    this.sessionId = new Date().toISOString().replace(/[:.]/g, '-');
    this.ensureLogsDirectory();
  }

  private async ensureLogsDirectory(): Promise<void> {
    try {
      await mkdir(this.logsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getLogFileName(mcpName: string): string {
    const safeServerName = mcpName.replace(/[^a-zA-Z0-9-_]/g, '-');
    return path.join(this.logsDir, `mcp-traffic-${safeServerName}-${this.sessionId}.jsonl`);
  }

  private async writeLogEntry(entry: LogEntry): Promise<void> {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      const fileName = this.getLogFileName(entry.mcpName);
      await appendFile(fileName, logLine);
      
      // Also write to a combined log file
      const combinedFileName = path.join(this.logsDir, `mcp-traffic-combined-${this.sessionId}.jsonl`);
      await appendFile(combinedFileName, logLine);
    } catch (error) {
      console.error('Failed to write log entry:', error);
    }
  }

  public async logRequest(
    mcpName: string,
    requestData: RequestLogData,
    requestId?: string
  ): Promise<string> {
    const id = requestId || this.generateRequestId();
    
    // Sanitize headers to hide sensitive information in logs while keeping for debugging
    const sanitizedHeaders = { ...requestData.headers };
    if (sanitizedHeaders.Authorization) {
      sanitizedHeaders.Authorization = '[REDACTED - Bearer token present]';
    }
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      requestId: id,
      mcpName,
      direction: 'REQUEST',
      event: 'HTTP_REQUEST',
      data: {
        ...requestData,
        headers: sanitizedHeaders,
        fullHeaders: requestData.headers // Keep full headers for analysis
      }
    };

    await this.writeLogEntry(entry);
    console.log(`📝 [TRAFFIC-LOG] Logged request ${id} for ${mcpName}`);
    return id;
  }

  public async logResponse(
    requestId: string,
    mcpName: string,
    responseData: ResponseLogData
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      mcpName,
      direction: 'RESPONSE',
      event: 'HTTP_RESPONSE',
      data: responseData
    };

    await this.writeLogEntry(entry);
    console.log(`📝 [TRAFFIC-LOG] Logged response for request ${requestId} (${mcpName})`);
  }

  public async logStreamChunk(
    requestId: string,
    mcpName: string,
    chunkData: StreamChunkLogData
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      mcpName,
      direction: 'STREAM_CHUNK',
      event: 'STREAM_DATA',
      data: chunkData
    };

    await this.writeLogEntry(entry);
    
    // Only log every 10th chunk to console to avoid spam
    if (chunkData.chunkNumber % 10 === 0 || chunkData.chunkNumber <= 5) {
      console.log(`📝 [TRAFFIC-LOG] Logged stream chunk ${chunkData.chunkNumber} for request ${requestId} (${mcpName})`);
    }
  }

  public async logError(
    requestId: string,
    mcpName: string,
    errorData: ErrorLogData
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      mcpName,
      direction: 'ERROR',
      event: 'REQUEST_ERROR',
      data: errorData
    };

    await this.writeLogEntry(entry);
    console.log(`📝 [TRAFFIC-LOG] Logged error for request ${requestId} (${mcpName}): ${errorData.message}`);
  }

  public async logCustomEvent(
    requestId: string,
    mcpName: string,
    event: string,
    data: any
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      mcpName,
      direction: 'REQUEST',
      event,
      data
    };

    await this.writeLogEntry(entry);
    console.log(`📝 [TRAFFIC-LOG] Logged custom event ${event} for request ${requestId} (${mcpName})`);
  }
}

// Singleton instance
export const mcpTrafficLogger = new McpTrafficLogger();
