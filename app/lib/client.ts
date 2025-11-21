/**
 * MCP Client - Server-Side Only
 *
 * IMPORTANT: This module is designed to run ONLY on the server-side (Node.js).
 * It should NEVER be imported or used in client-side/browser code.
 *
 * All client-side memory operations should go through the API routes:
 * - /api/memory/add-episode
 * - /api/memory/search-nodes
 * - /api/memory/search-facts
 * - /api/memory/get-episodes
 * - /api/memory/delete-episode
 * - /api/memory/delete-entity-edge
 * - /api/memory/forget
 */

import { v4 as uuidv4 } from 'uuid';

// Enforce server-side only execution
if (typeof window !== 'undefined') {
  throw new Error(
    'MCPClient can only be used server-side. ' +
    'Client-side code should call the /api/memory/* endpoints instead.'
  );
}

interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id: string | number;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number;
}

interface InitializeRequest extends JSONRPCRequest {
  method: 'initialize';
  params: {
    protocolVersion: string;
    capabilities: {
      roots?: { listChanged?: boolean };
      sampling?: {};
    };
    clientInfo: {
      name: string;
      version: string;
    };
  };
}

/**
 * Parse SSE-formatted response text and extract JSON-RPC messages
 */
function parseSSEResponse(text: string): JSONRPCResponse[] {
  const messages: JSONRPCResponse[] = [];

  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        messages.push(JSON.parse(line.substring(6)));
      } catch (e) {
        console.error('Failed to parse SSE data:', line.substring(6), e);
      }
    }
  }

  return messages;
}

export class MCPClient {
  private baseUrl: string;
  private sessionId: string | null = null;
  private isConnected: boolean = false;

  constructor(baseUrl: string = process.env.MCP_SERVER_URL || 'http://localhost:8000/mcp') {
    // Server-side only - connect directly to MCP server
    this.baseUrl = baseUrl;
  }

  /**
   * Build headers for MCP requests
   */
  private buildHeaders(includeSessionId = true): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };

    if (includeSessionId && this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    return headers;
  }

  /**
   * Parse response based on content type (SSE or JSON)
   */
  private async parseResponse(response: Response): Promise<JSONRPCResponse> {
    const contentType = response.headers.get('Content-Type') || '';

    if (contentType.includes('text/event-stream')) {
      const text = await response.text();
      const messages = parseSSEResponse(text);
      if (messages.length === 0) {
        throw new Error('No messages found in SSE response');
      }
      return messages[0];
    }

    return response.json();
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('MCP client already connected, reusing existing session');
      return;
    }

    console.log(`Initializing MCP connection to ${this.baseUrl}`);

    // Send initialize request
    const initRequest: InitializeRequest = {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
        },
        clientInfo: {
          name: 'plucky-mcp-client',
          version: '1.0.0',
        },
      },
      id: uuidv4(),
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.buildHeaders(false),
      body: JSON.stringify(initRequest),
    });

    if (!response.ok) {
      throw new Error(`HTTP error during initialization! status: ${response.status}`);
    }

    // Extract session ID (case-insensitive)
    const sessionId = response.headers.get('Mcp-Session-Id') || response.headers.get('mcp-session-id');
    if (sessionId) {
      this.sessionId = sessionId;
      console.log(`Session ID received: ${this.sessionId}`);
    }

    // Parse initialization result
    const initResult = await this.parseResponse(response);

    if (initResult.error) {
      throw new Error(`MCP Initialization Error: ${initResult.error.message}`);
    }

    console.log('MCP initialized:', initResult.result);

    // Send initialized notification to complete handshake
    const notifyResponse = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {},
      }),
    });

    if (!notifyResponse.ok) {
      const errorText = await notifyResponse.text();
      throw new Error(`Notification failed! status: ${notifyResponse.status}, body: ${errorText}`);
    }

    this.isConnected = true;
    console.log('MCP connection established');
  }

  async callTool(name: string, args: any): Promise<any> {
    if (!this.isConnected) {
      await this.connect();
    }

    console.log(`Calling tool: ${name}`, args);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name,
          arguments: args,
        },
        id: uuidv4(),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await this.parseResponse(response);

    if (result.error) {
      throw new Error(`MCP Error: ${result.error.message}`);
    }

    return result.result;
  }

  async close() {
    if (!this.isConnected) return;

    if (this.sessionId) {
      try {
        await fetch(this.baseUrl, {
          method: 'DELETE',
          headers: { 'Mcp-Session-Id': this.sessionId },
        });
        console.log('MCP session terminated');
      } catch (error) {
        console.error('Error terminating MCP session:', error);
      }
    }

    this.isConnected = false;
    this.sessionId = null;
  }
}

// Server-side singleton instance
// This single instance will be reused across all API route calls,
// maintaining one persistent MCP session

// Use global to persist across Next.js hot reloads in development
const globalForMCP = globalThis as unknown as {
  mcpClient: MCPClient | undefined;
};

export const mcpClient =
  globalForMCP.mcpClient ??
  new MCPClient(process.env.MCP_SERVER_URL || 'http://localhost:8000/mcp');

// Store in global to prevent recreation on hot reload
if (typeof window === 'undefined') {
  globalForMCP.mcpClient = mcpClient;
}
