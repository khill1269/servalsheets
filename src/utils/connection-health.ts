/**
 * Connection Health Monitor
 *
 * Monitors MCP client connection health and logs disconnects/reconnects.
 * Helps diagnose connection stability issues.
 *
 * Features:
 * - Heartbeat tracking (records last activity)
 * - Disconnect detection with configurable timeout
 * - Connection event logging
 * - Statistics for debugging
 *
 * Environment Variables:
 * - MCP_HEALTH_CHECK_INTERVAL_MS: Health check interval (default: 30000 = 30s)
 * - MCP_DISCONNECT_THRESHOLD_MS: Disconnect threshold (default: 180000 = 3min)
 * - MCP_WARN_THRESHOLD_MS: Warning threshold (default: 120000 = 2min)
 */

import { logger } from './logger.js';

export interface ConnectionHealthConfig {
  /** Heartbeat check interval in ms (default: 30000 = 30 seconds) */
  checkIntervalMs?: number;
  /** Consider disconnected after this many ms without activity (default: 180000 = 3 minutes) */
  disconnectThresholdMs?: number;
  /** Log warnings after this many ms without activity (default: 120000 = 2 minutes) */
  warnThresholdMs?: number;
}

export interface ConnectionStats {
  /** Total number of heartbeats recorded */
  totalHeartbeats: number;
  /** Time since last activity (ms) */
  timeSinceLastActivity: number;
  /** Number of disconnect warnings issued */
  disconnectWarnings: number;
  /** When monitoring started */
  monitoringStarted: number;
  /** Uptime in seconds */
  uptimeSeconds: number;
  /** Current connection status */
  status: 'healthy' | 'warning' | 'disconnected' | 'unknown';
  /** Last activity timestamp */
  lastActivity: number;
}

interface ConnectionEvent {
  type: 'heartbeat' | 'warning' | 'disconnect' | 'reconnect' | 'start' | 'stop';
  timestamp: number;
  metadata?: Record<string, unknown>;
}

const DEFAULT_CONFIG: Required<ConnectionHealthConfig> = {
  checkIntervalMs: parseInt(
    process.env['MCP_HEALTH_CHECK_INTERVAL_MS'] || '30000',
    10
  ), // Check every 30 seconds
  disconnectThresholdMs: parseInt(
    process.env['MCP_DISCONNECT_THRESHOLD_MS'] || '180000',
    10
  ), // Disconnected after 3 minutes
  warnThresholdMs: parseInt(process.env['MCP_WARN_THRESHOLD_MS'] || '120000', 10), // Warn after 2 minutes
};

export class ConnectionHealthMonitor {
  private config: Required<ConnectionHealthConfig>;
  private lastActivity: number = Date.now();
  private monitoringStarted: number = 0;
  private checkInterval: NodeJS.Timeout | null = null;
  private totalHeartbeats: number = 0;
  private disconnectWarnings: number = 0;
  private isDisconnected: boolean = false;
  private connectionId: string = '';
  private eventLog: ConnectionEvent[] = [];
  private maxEventLogSize: number = 100;

  constructor(config?: ConnectionHealthConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.connectionId = this.generateConnectionId();
  }

  /**
   * Generate a unique connection ID for this session
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start monitoring connection health
   */
  start(): void {
    if (this.checkInterval) {
      logger.warn('Connection health monitor already running');
      return;
    }

    this.monitoringStarted = Date.now();
    this.lastActivity = Date.now();
    this.isDisconnected = false;

    this.logEvent('start', { connectionId: this.connectionId });

    logger.info('Connection health monitor started', {
      connectionId: this.connectionId,
      checkIntervalMs: this.config.checkIntervalMs,
      disconnectThresholdMs: this.config.disconnectThresholdMs,
      warnThresholdMs: this.config.warnThresholdMs,
    });

    this.checkInterval = setInterval(() => {
      this.checkHealth();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.logEvent('stop', { stats: this.getStats() });
      logger.info('Connection health monitor stopped', {
        connectionId: this.connectionId,
        stats: this.getStats(),
      });
    }
  }

  /**
   * Record a heartbeat (call this on any MCP activity)
   */
  recordHeartbeat(source?: string): void {
    const wasDisconnected = this.isDisconnected;

    this.lastActivity = Date.now();
    this.totalHeartbeats++;
    this.isDisconnected = false;

    // If we were disconnected and now have activity, log reconnection
    if (wasDisconnected) {
      this.logEvent('reconnect', { source });
      logger.info('MCP connection restored', {
        connectionId: this.connectionId,
        source,
      });
    }

    this.logEvent('heartbeat', { source });
  }

  /**
   * Check connection health and log warnings/disconnects
   */
  private checkHealth(): void {
    const now = Date.now();
    const timeSinceActivity = now - this.lastActivity;

    if (timeSinceActivity >= this.config.disconnectThresholdMs) {
      // Disconnected
      if (!this.isDisconnected) {
        this.isDisconnected = true;
        this.disconnectWarnings++;
        this.logEvent('disconnect', { timeSinceActivity });
        logger.error('MCP client appears disconnected', {
          connectionId: this.connectionId,
          lastActivity: new Date(this.lastActivity).toISOString(),
          timeSinceActivityMs: timeSinceActivity,
          totalWarnings: this.disconnectWarnings,
          suggestion: 'Check MCP client (Claude Desktop) connection status',
        });
      }
    } else if (timeSinceActivity >= this.config.warnThresholdMs) {
      // Warning - no activity but not yet disconnected
      this.logEvent('warning', { timeSinceActivity });
      logger.warn('MCP client activity delayed', {
        connectionId: this.connectionId,
        lastActivity: new Date(this.lastActivity).toISOString(),
        timeSinceActivityMs: timeSinceActivity,
        thresholdMs: this.config.warnThresholdMs,
      });
    }
  }

  /**
   * Log an event for debugging
   */
  private logEvent(
    type: ConnectionEvent['type'],
    metadata?: Record<string, unknown>
  ): void {
    this.eventLog.push({
      type,
      timestamp: Date.now(),
      metadata,
    });

    // Keep event log bounded
    if (this.eventLog.length > this.maxEventLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxEventLogSize);
    }
  }

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    const now = Date.now();
    const timeSinceActivity = now - this.lastActivity;

    let status: ConnectionStats['status'];
    if (this.monitoringStarted === 0) {
      status = 'unknown';
    } else if (timeSinceActivity >= this.config.disconnectThresholdMs) {
      status = 'disconnected';
    } else if (timeSinceActivity >= this.config.warnThresholdMs) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    return {
      totalHeartbeats: this.totalHeartbeats,
      timeSinceLastActivity: timeSinceActivity,
      disconnectWarnings: this.disconnectWarnings,
      monitoringStarted: this.monitoringStarted,
      uptimeSeconds:
        this.monitoringStarted > 0
          ? Math.floor((now - this.monitoringStarted) / 1000)
          : 0,
      status,
      lastActivity: this.lastActivity,
    };
  }

  /**
   * Get recent events for debugging
   */
  getRecentEvents(count: number = 20): ConnectionEvent[] {
    return this.eventLog.slice(-count);
  }

  /**
   * Get the connection ID
   */
  getConnectionId(): string {
    return this.connectionId;
  }

  /**
   * Check if currently considered disconnected
   */
  isCurrentlyDisconnected(): boolean {
    return this.isDisconnected;
  }
}

// Singleton instance
let healthMonitor: ConnectionHealthMonitor | null = null;

/**
 * Get or create the connection health monitor singleton
 */
export function getConnectionHealthMonitor(): ConnectionHealthMonitor {
  if (!healthMonitor) {
    healthMonitor = new ConnectionHealthMonitor();
  }
  return healthMonitor;
}

/**
 * Start connection health monitoring with optional config
 */
export function startConnectionHealthMonitoring(
  config?: ConnectionHealthConfig
): ConnectionHealthMonitor {
  const monitor = new ConnectionHealthMonitor(config);
  monitor.start();
  healthMonitor = monitor;
  return monitor;
}

/**
 * Stop connection health monitoring
 */
export function stopConnectionHealthMonitoring(): void {
  if (healthMonitor) {
    healthMonitor.stop();
  }
}
