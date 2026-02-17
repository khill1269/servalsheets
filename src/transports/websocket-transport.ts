/**
 * WebSocket Transport for MCP
 *
 * Bidirectional WebSocket transport with:
 * - Auto-reconnection with exponential backoff
 * - Heartbeat/ping-pong for connection health
 * - Live resource subscriptions
 * - Compression support
 * - Low latency (<50ms)
 *
 * Target: 90% latency reduction vs HTTP (500ms → 50ms)
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
  JSONRPCMessage,
} from '@modelcontextprotocol/sdk/types.js';

export interface WebSocketTransportOptions {
  /**
   * Connection timeout in milliseconds
   * @default 5000
   */
  connectionTimeout?: number;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  requestTimeout?: number;

  /**
   * Heartbeat interval in milliseconds
   * @default 30000
   */
  heartbeatInterval?: number;

  /**
   * Heartbeat timeout in milliseconds (time to wait for pong)
   * @default 5000
   */
  heartbeatTimeout?: number;

  /**
   * Enable automatic reconnection
   * @default true
   */
  autoReconnect?: boolean;

  /**
   * Initial reconnection interval in milliseconds
   * @default 1000
   */
  reconnectInterval?: number;

  /**
   * Maximum reconnection attempts (0 = infinite)
   * @default 0
   */
  maxReconnectAttempts?: number;

  /**
   * Enable permessage-deflate compression
   * @default true
   */
  compression?: boolean;

  /**
   * Use binary frames for messages
   * @default false
   */
  useBinary?: boolean;

  /**
   * Maximum message size in bytes
   * @default 100MB
   */
  maxPayloadSize?: number;
}

export interface Subscription {
  uri: string;
  onUpdate(handler: (update: unknown) => void): void;
  unsubscribe(): Promise<void>;
}

interface PendingRequest {
  resolve: (response: JSONRPCResponse) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

/**
 * WebSocket Transport
 *
 * Provides bidirectional, real-time communication with MCP servers
 */
export class WebSocketTransport extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private options: Required<WebSocketTransportOptions>;
  private pendingRequests = new Map<string | number, PendingRequest>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatResponseTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isReconnecting = false;
  private isClosing = false;
  private subscriptions = new Map<string, Set<(update: unknown) => void>>();
  private messageHandlers = new Set<(message: unknown) => void>();
  private notificationHandlers = new Set<(notification: JSONRPCNotification) => void>();

  constructor(options: WebSocketTransportOptions = {}) {
    super();
    this.options = {
      connectionTimeout: options.connectionTimeout ?? 5000,
      requestTimeout: options.requestTimeout ?? 30000,
      heartbeatInterval: options.heartbeatInterval ?? 30000,
      heartbeatTimeout: options.heartbeatTimeout ?? 5000,
      autoReconnect: options.autoReconnect ?? true,
      reconnectInterval: options.reconnectInterval ?? 1000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 0,
      compression: options.compression ?? true,
      useBinary: options.useBinary ?? false,
      maxPayloadSize: options.maxPayloadSize ?? 100 * 1024 * 1024,
    };
  }

  /**
   * Connect to WebSocket server
   */
  async connect(url: string): Promise<void> {
    this.url = url;
    this.isClosing = false;

    return new Promise((resolve, reject) => {
      let settled = false;

      const safeReject = (error: unknown) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      };

      const safeResolve = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      try {
        const wsOptions: WebSocket.ClientOptions = {
          handshakeTimeout: this.options.connectionTimeout,
          maxPayload: this.options.maxPayloadSize,
        };

        if (this.options.compression) {
          wsOptions.perMessageDeflate = {
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

        this.ws = new WebSocket(url, wsOptions);

        const connectionTimeout = setTimeout(() => {
          this.ws?.terminate();
          safeReject(new Error(`Connection timeout after ${this.options.connectionTimeout}ms`));
        }, this.options.connectionTimeout);

        this.ws.on('open', () => {
          clearTimeout(connectionTimeout);
          logger.info('WebSocket connected', { url });
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connect');
          safeResolve();
        });

        this.ws.on('error', (error) => {
          clearTimeout(connectionTimeout);

          // Only log and emit errors if we're not in reconnecting state
          if (!this.isReconnecting) {
            logger.error('WebSocket error', { error: error.message, url });
            this.emit('error', error);
          }

          // Reject if the connect() promise hasn't been settled yet
          safeReject(error);
        });

        this.ws.on('close', (code, reason) => {
          clearTimeout(connectionTimeout);
          this.handleClose(code, reason.toString());
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });

        this.ws.on('pong', () => {
          this.handlePong();
        });
      } catch (error) {
        safeReject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  async disconnect(): Promise<void> {
    this.isClosing = true;
    this.stopHeartbeat();
    this.stopReconnecting();

    // Reject all pending requests
    const pendingError = new Error('Transport disconnected');
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timer);
      pending.reject(pendingError);
      this.pendingRequests.delete(id);
    }

    if (this.ws) {
      const ws = this.ws;
      this.ws = null;

      return new Promise((resolve) => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.once('close', () => resolve());
          ws.close(1000, 'Client disconnect');

          // Force close after timeout
          setTimeout(() => {
            ws.terminate();
            resolve();
          }, 1000);
        } else {
          resolve();
        }
      });
    }
  }

  /**
   * Check if transport is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Send JSON-RPC request and wait for response
   */
  async sendRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    if (!this.isConnected()) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timeout after ${this.options.requestTimeout}ms`));
      }, this.options.requestTimeout);

      this.pendingRequests.set(request.id, {
        resolve,
        reject,
        timer,
      });

      try {
        this.send(request);
      } catch (error) {
        clearTimeout(timer);
        this.pendingRequests.delete(request.id);
        reject(error);
      }
    });
  }

  /**
   * Register handler for server notifications
   */
  onNotification(handler: (notification: JSONRPCNotification) => void): void {
    this.notificationHandlers.add(handler);
  }

  /**
   * Register handler for all server messages
   */
  onMessage(handler: (message: unknown) => void): void {
    this.messageHandlers.add(handler);
  }

  /**
   * Subscribe to resource updates
   */
  async subscribe(uri: string): Promise<Subscription> {
    const updateHandlers = new Set<(update: unknown) => void>();
    this.subscriptions.set(uri, updateHandlers);

    // Send subscription request to server
    await this.sendRequest({
      jsonrpc: '2.0',
      id: `subscribe-${uri}-${Date.now()}`,
      method: 'resources/subscribe',
      params: { uri },
    });

    return {
      uri,
      onUpdate: (handler) => {
        updateHandlers.add(handler);
      },
      unsubscribe: async () => {
        this.subscriptions.delete(uri);
        await this.sendRequest({
          jsonrpc: '2.0',
          id: `unsubscribe-${uri}-${Date.now()}`,
          method: 'resources/unsubscribe',
          params: { uri },
        });
      },
    };
  }

  /**
   * Send message over WebSocket
   */
  private send(message: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not open');
    }

    const data = JSON.stringify(message);

    if (this.options.useBinary) {
      this.ws.send(Buffer.from(data), { binary: true });
    } else {
      this.ws.send(data);
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      // Notify raw message handlers
      for (const handler of this.messageHandlers) {
        try {
          handler(message);
        } catch (error) {
          logger.error('Message handler error', { error });
        }
      }

      // Handle JSON-RPC messages
      if (message.jsonrpc === '2.0') {
        if ('id' in message && ('result' in message || 'error' in message)) {
          // Response to our request
          this.handleResponse(message as JSONRPCResponse);
        } else if ('method' in message && !('id' in message)) {
          // Server notification
          this.handleNotification(message as JSONRPCNotification);
        }
      }
    } catch (error) {
      logger.error('Failed to parse WebSocket message', { error, data: data.toString() });
      this.emit('error', error);
    }
  }

  /**
   * Handle JSON-RPC response
   */
  private handleResponse(response: JSONRPCResponse): void {
    if (response.id === undefined || response.id === null) {
      return;
    }
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(response.id);
      pending.resolve(response);
    }
  }

  /**
   * Handle server notification
   */
  private handleNotification(notification: JSONRPCNotification): void {
    // Notify handlers
    for (const handler of this.notificationHandlers) {
      try {
        handler(notification);
      } catch (error) {
        logger.error('Notification handler error', { error });
      }
    }

    // Handle resource update notifications
    if (notification.method === 'notifications/resources/updated') {
      const { uri, data } = notification.params as any;
      const handlers = this.subscriptions.get(uri);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler({ uri, data });
          } catch (error) {
            logger.error('Subscription handler error', { error });
          }
        }
      }
    }
  }

  /**
   * Handle connection close
   */
  private handleClose(code: number, reason: string): void {
    logger.info('WebSocket closed', { code, reason, url: this.url });
    this.stopHeartbeat();
    this.emit('disconnect', { code, reason });

    // Auto-reconnect if enabled and not intentionally closing
    if (this.options.autoReconnect && !this.isClosing && this.url) {
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.isReconnecting || this.isClosing) {
      return;
    }

    if (
      this.options.maxReconnectAttempts > 0 &&
      this.reconnectAttempts >= this.options.maxReconnectAttempts
    ) {
      logger.error('Max reconnection attempts reached', {
        attempts: this.reconnectAttempts,
      });
      this.emit('reconnectFailed');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Exponential backoff: interval * 2^attempt (capped at 30s)
    const delay = Math.min(
      this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    logger.info('Attempting reconnection', {
      attempt: this.reconnectAttempts,
      delay,
      url: this.url,
    });

    this.emit('reconnecting', this.reconnectAttempts);

    this.reconnectTimer = setTimeout(async () => {
      try {
        if (this.url) {
          await this.connect(this.url);
          logger.info('Reconnected successfully');
          this.isReconnecting = false;
          this.emit('reconnect');
        }
      } catch (error) {
        logger.debug('Reconnection attempt failed', { error, attempt: this.reconnectAttempts });
        this.isReconnecting = false;
        // Schedule next attempt (this will check max attempts again)
        setImmediate(() => this.attemptReconnect());
      }
    }, delay);
  }

  /**
   * Stop reconnection attempts
   */
  private stopReconnecting(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isReconnecting = false;
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected() && this.ws) {
        // Send ping
        this.ws.ping();

        // Set timeout to detect if pong is not received
        this.heartbeatResponseTimer = setTimeout(() => {
          logger.warn('Heartbeat timeout - connection lost');
          this.ws?.terminate();
        }, this.options.heartbeatTimeout);
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatResponseTimer) {
      clearTimeout(this.heartbeatResponseTimer);
      this.heartbeatResponseTimer = null;
    }
  }

  /**
   * Handle pong response
   */
  private handlePong(): void {
    if (this.heartbeatResponseTimer) {
      clearTimeout(this.heartbeatResponseTimer);
      this.heartbeatResponseTimer = null;
    }
  }
}
