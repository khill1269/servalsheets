/**
 * WebSocket MCP Server
 *
 * WebSocket server with MCP protocol support:
 * - Multiple concurrent connections
 * - Per-client MCP server instances
 * - Broadcast capabilities
 * - Compression support
 * - Health monitoring
 */

import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { createServer, Server as HttpServer } from 'http';
import { EventEmitter } from 'events';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../utils/logger.js';
import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
  JSONRPCMessage,
} from '@modelcontextprotocol/sdk/types.js';

export interface WebSocketServerOptions {
  /**
   * Port to listen on
   * @default 3001
   */
  port?: number;

  /**
   * Host to bind to
   * @default 'localhost'
   */
  host?: string;

  /**
   * Enable compression
   * @default true
   */
  compression?: boolean;

  /**
   * Maximum payload size in bytes
   * @default 100MB
   */
  maxPayloadSize?: number;

  /**
   * Client timeout in milliseconds
   * @default 60000
   */
  clientTimeout?: number;

  /**
   * MCP server factory (creates MCP server per client)
   */
  createMcpServer?: () => Promise<McpServer>;
}

interface ClientContext {
  id: string;
  ws: WebSocket;
  mcpServer?: McpServer;
  subscriptions: Set<string>;
  connected: Date;
}

type RequestHandler = (
  request: JSONRPCRequest,
  respond: (response: JSONRPCResponse) => void
) => void;

type PingHandler = () => void;

/**
 * WebSocket Server for MCP
 *
 * Manages WebSocket connections and routes messages to MCP server instances
 */
export class WebSocketServer extends EventEmitter {
  private wss: WSServer | null = null;
  private httpServer: HttpServer | null = null;
  private options: Required<Omit<WebSocketServerOptions, 'createMcpServer'>>;
  private createMcpServerFn?: () => Promise<McpServer>;
  private clientsMap = new Map<string, ClientContext>();
  private requestHandlers = new Set<RequestHandler>();
  private pingHandlers = new Set<PingHandler>();

  constructor(options: WebSocketServerOptions = {}) {
    super();
    this.options = {
      port: options.port ?? 3001,
      host: options.host ?? 'localhost',
      compression: options.compression ?? true,
      maxPayloadSize: options.maxPayloadSize ?? 100 * 1024 * 1024,
      clientTimeout: options.clientTimeout ?? 60000,
    };
    this.createMcpServerFn = options.createMcpServer;
  }

  /**
   * Start WebSocket server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server
        this.httpServer = createServer();

        // Create WebSocket server
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const wssOptions: any = {
          server: this.httpServer,
          maxPayload: this.options.maxPayloadSize,
          clientTracking: true,
        };

        if (this.options.compression) {
          wssOptions.perMessageDeflate = {
            zlibDeflateOptions: {
              chunkSize: 1024,
              memLevel: 7,
              level: 3,
            },
            zlibInflateOptions: {
              chunkSize: 10 * 1024,
            },
            clientNoContextTakeover: true,
            serverNoContextTakeover: true,
            serverMaxWindowBits: 10,
            concurrencyLimit: 10,
            threshold: 1024,
          };
        }

        this.wss = new WSServer(wssOptions);

        // Handle new connections
        this.wss.on('connection', (ws, req) => {
          this.handleConnection(ws, req);
        });

        this.wss.on('error', (error) => {
          logger.error('WebSocket server error', { error });
          this.emit('error', error);
        });

        // Start HTTP server
        this.httpServer.listen(this.options.port, this.options.host, () => {
          logger.info('WebSocket server started', {
            host: this.options.host,
            port: this.options.port,
          });
          this.emit('listening');
          resolve();
        });

        this.httpServer.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop WebSocket server
   */
  async stop(): Promise<void> {
    // Close all client connections
    for (const [id, client] of this.clientsMap.entries()) {
      try {
        client.ws.close(1000, 'Server shutdown');
      } catch (error) {
        logger.error('Error closing client', { id, error });
      }
    }
    this.clientsMap.clear();

    // Close WebSocket server
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => {
          this.wss = null;
          resolve();
        });
      });
    }

    // Close HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => {
          this.httpServer = null;
          resolve();
        });
      });
    }

    logger.info('WebSocket server stopped');
    this.emit('close');
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: unknown): void {
    const data = JSON.stringify(message);
    const OPEN = 1; // WebSocket.OPEN

    for (const client of this.clientsMap.values()) {
      if (client.ws.readyState === OPEN) {
        try {
          client.ws.send(data);
        } catch (error) {
          logger.error('Broadcast error', { clientId: client.id, error });
        }
      }
    }
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, message: unknown): void {
    const client = this.clientsMap.get(clientId);
    const OPEN = 1; // WebSocket.OPEN
    if (client && client.ws.readyState === OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Send to client error', { clientId, error });
      }
    }
  }

  /**
   * Register request handler for testing
   */
  onRequest(handler: RequestHandler): void {
    this.requestHandlers.add(handler);
  }

  /**
   * Register ping handler for testing
   */
  onPing(handler: PingHandler): void {
    this.pingHandlers.add(handler);
  }

  /**
   * Get all connected clients (for testing)
   */
  get clients(): Set<WebSocket> {
    const set = new Set<WebSocket>();
    for (const client of this.clientsMap.values()) {
      set.add(client.ws);
    }
    return set;
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clientsMap.size;
  }

  /**
   * Handle new client connection
   */
  private async handleConnection(ws: WebSocket, req: unknown): Promise<void> {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const client: ClientContext = {
      id: clientId,
      ws,
      subscriptions: new Set(),
      connected: new Date(),
    };

    this.clientsMap.set(clientId, client);

    logger.info('Client connected', {
      clientId,
      remoteAddress: (req as any)?.socket?.remoteAddress || 'unknown',
    });

    this.emit('connection', clientId);

    // Initialize MCP server for this client if factory provided
    if (this.createMcpServerFn) {
      try {
        client.mcpServer = await this.createMcpServerFn();
      } catch (error) {
        logger.error('Failed to create MCP server for client', { clientId, error });
        ws.close(1011, 'Internal server error');
        this.clientsMap.delete(clientId);
        return;
      }
    }

    // Set client timeout
    ws.on('pong', () => {
      // Client responded to ping
    });

    const timeout = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
        // Notify test handlers
        for (const handler of this.pingHandlers) {
          try {
            handler();
          } catch (error) {
            logger.error('Ping handler error', { error });
          }
        }
      }
    }, this.options.clientTimeout / 2);

    ws.on('message', async (data) => {
      try {
        await this.handleClientMessage(client, data);
      } catch (error) {
        logger.error('Message handling error', { clientId, error });
        this.sendError(client, null, -32603, 'Internal error');
      }
    });

    ws.on('close', (code, reason) => {
      clearInterval(timeout);
      this.handleClientClose(client, code, reason.toString());
    });

    ws.on('error', (error) => {
      logger.error('Client error', { clientId, error });
    });

    ws.on('ping', () => {
      ws.pong();
    });
  }

  /**
   * Handle message from client
   */
  private async handleClientMessage(
    client: ClientContext,
    data: Buffer | ArrayBuffer | Buffer[]
  ): Promise<void> {
    const message = JSON.parse(data.toString());

    // Handle JSON-RPC messages
    if (message.jsonrpc === '2.0') {
      if ('method' in message) {
        if ('id' in message) {
          // Request
          await this.handleRequest(client, message as JSONRPCRequest);
        } else {
          // Notification
          await this.handleNotification(client, message as JSONRPCNotification);
        }
      }
    }
  }

  /**
   * Handle JSON-RPC request
   */
  private async handleRequest(client: ClientContext, request: JSONRPCRequest): Promise<void> {
    // Notify test handlers
    for (const handler of this.requestHandlers) {
      try {
        handler(request, (response) => {
          this.sendToClient(client.id, response);
        });
      } catch (error) {
        logger.error('Request handler error', { error });
      }
    }

    // If test handlers are present, they handle the response
    if (this.requestHandlers.size > 0) {
      return;
    }

    // Handle built-in methods
    try {
      switch (request.method) {
        case 'resources/subscribe':
          await this.handleSubscribe(client, request);
          break;

        case 'resources/unsubscribe':
          await this.handleUnsubscribe(client, request);
          break;

        default:
          // Forward to MCP server if available (integration deferred)
          this.sendError(client, request.id, -32601, 'Method not found');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      logger.error('Request handling error', { method: request.method, error });
      this.sendError(client, request.id, -32603, error.message || 'Internal error');
    }
  }

  /**
   * Handle subscription request
   */
  private async handleSubscribe(client: ClientContext, request: JSONRPCRequest): Promise<void> {
    const { uri } = request.params as any;
    client.subscriptions.add(uri);

    this.sendToClient(client.id, {
      jsonrpc: '2.0',
      id: request.id,
      result: { subscribed: true, uri },
    });

    logger.info('Client subscribed', { clientId: client.id, uri });
  }

  /**
   * Handle unsubscription request
   */
  private async handleUnsubscribe(client: ClientContext, request: JSONRPCRequest): Promise<void> {
    const { uri } = request.params as any;
    client.subscriptions.delete(uri);

    this.sendToClient(client.id, {
      jsonrpc: '2.0',
      id: request.id,
      result: { unsubscribed: true, uri },
    });

    logger.info('Client unsubscribed', { clientId: client.id, uri });
  }

  /**
   * Handle client notification
   */
  private async handleNotification(
    client: ClientContext,
    notification: JSONRPCNotification
  ): Promise<void> {
    logger.debug('Client notification', {
      clientId: client.id,
      method: notification.method,
    });
  }

  /**
   * Handle client disconnect
   */
  private handleClientClose(client: ClientContext, code: number, reason: string): void {
    logger.info('Client disconnected', {
      clientId: client.id,
      code,
      reason,
    });

    this.clientsMap.delete(client.id);
    this.emit('disconnect', client.id);
  }

  /**
   * Send error response to client
   */
  private sendError(
    client: ClientContext,
    id: string | number | null,
    code: number,
    message: string
  ): void {
    this.sendToClient(client.id, {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
      },
    });
  }
}
