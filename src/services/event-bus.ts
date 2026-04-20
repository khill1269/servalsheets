/**
 * ServalSheets - Pluggable Event Bus
 *
 * Fans sheet-change events to external messaging backends.
 * Backend is selected via EVENT_BUS_BACKEND env var.
 *
 * Supported backends:
 *   memory   — in-process (default; useful for testing and dev)
 *   kafka    — Apache Kafka via kafkajs (npm install kafkajs)
 *   pubsub   — Google Cloud Pub/Sub via @google-cloud/pubsub
 *   sns      — AWS SNS via @aws-sdk/client-sns
 *
 * Env vars:
 *   EVENT_BUS_BACKEND           memory | kafka | pubsub | sns
 *   KAFKA_BROKERS               comma-separated broker addresses
 *   KAFKA_TOPIC                 topic name
 *   KAFKA_CLIENT_ID             client identifier (default: servalsheets)
 *   PUBSUB_PROJECT_ID           GCP project id
 *   PUBSUB_TOPIC_ID             Pub/Sub topic id
 *   SNS_TOPIC_ARN               full ARN
 *   AWS_REGION                  AWS region
 */

import { logger } from '../utils/logger.js';

// Bypass TypeScript's static module resolution for optional peer dependencies.
// These packages may not be installed; dynamic import is caught at runtime.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const optionalImport = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;

// ============================================================================
// Event shape
// ============================================================================

export type SheetEventType =
  | 'sheet.write'
  | 'sheet.format'
  | 'sheet.create'
  | 'sheet.delete'
  | 'sheet.share'
  | 'sheet.comment'
  | 'sheet.import'
  | 'sheet.export';

export interface SheetChangeEvent {
  /** Event type */
  eventType: SheetEventType;
  /** Spreadsheet that changed */
  spreadsheetId: string;
  /** Sheet tab name, if applicable */
  sheetName?: string;
  /** A1 notation range affected, if applicable */
  range?: string;
  /** Actor who triggered the change (userId / email) */
  actorId?: string;
  /** MCP tool that triggered the change */
  toolName?: string;
  /** MCP action that triggered the change */
  actionName?: string;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Additional event-specific payload */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Backend interface
// ============================================================================

export interface EventBusBackend {
  readonly name: string;
  publish(event: SheetChangeEvent): Promise<void>;
  /** Optional: called once at startup. Implementations may connect here. */
  initialize?(): Promise<void>;
  /** Optional: clean shutdown. */
  shutdown?(): Promise<void>;
}

// ============================================================================
// In-memory backend (default / dev / test)
// ============================================================================

type InMemoryListener = (event: SheetChangeEvent) => void;

export class InMemoryEventBus implements EventBusBackend {
  readonly name = 'memory';
  private listeners: InMemoryListener[] = [];

  subscribe(listener: InMemoryListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  async publish(event: SheetChangeEvent): Promise<void> {
    for (const listener of this.listeners) {
      try { listener(event); } catch { /* isolate listener errors */ }
    }
  }
}

// ============================================================================
// Kafka backend
// ============================================================================

export class KafkaEventBus implements EventBusBackend {
  readonly name = 'kafka';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private producer: any = null;
  private readonly brokers: string[];
  private readonly topic: string;
  private readonly clientId: string;

  constructor(brokers: string[], topic: string, clientId = 'servalsheets') {
    this.brokers = brokers;
    this.topic = topic;
    this.clientId = clientId;
  }

  async initialize(): Promise<void> {
    let kafka: { Kafka: new (config: unknown) => unknown };
    try {
      kafka = await optionalImport('kafkajs') as typeof kafka;
    } catch {
      throw new Error(
        'Kafka backend requires kafkajs — run: npm install kafkajs'
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new (kafka as any).Kafka({ clientId: this.clientId, brokers: this.brokers });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.producer = (client as any).producer();
    await this.producer.connect();
    logger.info('Kafka event bus connected', { brokers: this.brokers, topic: this.topic });
  }

  async publish(event: SheetChangeEvent): Promise<void> {
    if (!this.producer) throw new Error('KafkaEventBus not initialized');
    await this.producer.send({
      topic: this.topic,
      messages: [{ key: event.spreadsheetId, value: JSON.stringify(event) }],
    });
  }

  async shutdown(): Promise<void> {
    if (this.producer) await this.producer.disconnect();
  }
}

// ============================================================================
// Google Pub/Sub backend
// ============================================================================

export class PubSubEventBus implements EventBusBackend {
  readonly name = 'pubsub';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private topic: any = null;
  private readonly projectId: string;
  private readonly topicId: string;

  constructor(projectId: string, topicId: string) {
    this.projectId = projectId;
    this.topicId = topicId;
  }

  async initialize(): Promise<void> {
    let pubsubModule: { PubSub: new (config: unknown) => unknown };
    try {
      pubsubModule = await optionalImport('@google-cloud/pubsub') as typeof pubsubModule;
    } catch {
      throw new Error(
        'Pub/Sub backend requires @google-cloud/pubsub — run: npm install @google-cloud/pubsub'
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new (pubsubModule as any).PubSub({ projectId: this.projectId });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.topic = (client as any).topic(this.topicId);
    logger.info('Pub/Sub event bus initialized', { projectId: this.projectId, topicId: this.topicId });
  }

  async publish(event: SheetChangeEvent): Promise<void> {
    if (!this.topic) throw new Error('PubSubEventBus not initialized');
    const data = Buffer.from(JSON.stringify(event));
    await this.topic.publishMessage({ data, attributes: { eventType: event.eventType, spreadsheetId: event.spreadsheetId } });
  }
}

// ============================================================================
// AWS SNS backend
// ============================================================================

export class SnsEventBus implements EventBusBackend {
  readonly name = 'sns';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;
  private readonly topicArn: string;
  private readonly region: string;

  constructor(topicArn: string, region: string) {
    this.topicArn = topicArn;
    this.region = region;
  }

  async initialize(): Promise<void> {
    let snsModule: { SNSClient: new (config: unknown) => unknown };
    try {
      snsModule = await optionalImport('@aws-sdk/client-sns') as typeof snsModule;
    } catch {
      throw new Error(
        'SNS backend requires @aws-sdk/client-sns — run: npm install @aws-sdk/client-sns'
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.client = new (snsModule as any).SNSClient({ region: this.region });
    logger.info('SNS event bus initialized', { topicArn: this.topicArn, region: this.region });
  }

  async publish(event: SheetChangeEvent): Promise<void> {
    if (!this.client) throw new Error('SnsEventBus not initialized');
    let publishCommand: new (input: unknown) => unknown;
    try {
      const mod = await optionalImport('@aws-sdk/client-sns') as { PublishCommand: typeof publishCommand };
      publishCommand = mod.PublishCommand;
    } catch {
      throw new Error('SnsEventBus: @aws-sdk/client-sns not available');
    }
    await this.client.send(new publishCommand({
      TopicArn: this.topicArn,
      Message: JSON.stringify(event),
      MessageAttributes: {
        eventType: { DataType: 'String', StringValue: event.eventType },
        spreadsheetId: { DataType: 'String', StringValue: event.spreadsheetId },
      },
    }));
  }
}

// ============================================================================
// Fan-out backend: publish to multiple backends simultaneously
// ============================================================================

export class FanOutEventBus implements EventBusBackend {
  readonly name = 'fanout';
  constructor(private readonly backends: EventBusBackend[]) {}

  async initialize(): Promise<void> {
    await Promise.all(this.backends.map(b => b.initialize?.()));
  }

  async publish(event: SheetChangeEvent): Promise<void> {
    const results = await Promise.allSettled(this.backends.map(b => b.publish(event)));
    for (const [i, result] of results.entries()) {
      if (result.status === 'rejected') {
        logger.error('Event bus backend publish failed', {
          backend: this.backends[i]?.name,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }
  }

  async shutdown(): Promise<void> {
    await Promise.allSettled(this.backends.map(b => b.shutdown?.()));
  }
}

// ============================================================================
// Event Bus Manager (singleton)
// ============================================================================

export class EventBusManager {
  private backend: EventBusBackend;
  private initialized = false;

  constructor(backend: EventBusBackend) {
    this.backend = backend;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.backend.initialize?.();
    this.initialized = true;
    logger.info('Event bus initialized', { backend: this.backend.name });
  }

  async publish(event: SheetChangeEvent): Promise<void> {
    if (!this.initialized) {
      logger.warn('Event bus not initialized — dropping event', { eventType: event.eventType });
      return;
    }
    try {
      await this.backend.publish(event);
    } catch (err) {
      logger.error('Event bus publish error', {
        backend: this.backend.name,
        eventType: event.eventType,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async shutdown(): Promise<void> {
    await this.backend.shutdown?.();
    this.initialized = false;
  }

  get backendName(): string {
    return this.backend.name;
  }
}

// ============================================================================
// Factory — selects backend from env
// ============================================================================

function buildBackendFromEnv(): EventBusBackend {
  const backend = (process.env['EVENT_BUS_BACKEND'] ?? 'memory').toLowerCase();

  if (backend === 'kafka') {
    const brokers = (process.env['KAFKA_BROKERS'] ?? '').split(',').map(s => s.trim()).filter(Boolean);
    const topic = process.env['KAFKA_TOPIC'];
    const clientId = process.env['KAFKA_CLIENT_ID'] ?? 'servalsheets';
    if (!brokers.length || !topic) {
      throw new Error('Kafka backend requires KAFKA_BROKERS and KAFKA_TOPIC env vars');
    }
    return new KafkaEventBus(brokers, topic, clientId);
  }

  if (backend === 'pubsub') {
    const projectId = process.env['PUBSUB_PROJECT_ID'];
    const topicId = process.env['PUBSUB_TOPIC_ID'];
    if (!projectId || !topicId) {
      throw new Error('Pub/Sub backend requires PUBSUB_PROJECT_ID and PUBSUB_TOPIC_ID env vars');
    }
    return new PubSubEventBus(projectId, topicId);
  }

  if (backend === 'sns') {
    const topicArn = process.env['SNS_TOPIC_ARN'];
    const region = process.env['AWS_REGION'];
    if (!topicArn || !region) {
      throw new Error('SNS backend requires SNS_TOPIC_ARN and AWS_REGION env vars');
    }
    return new SnsEventBus(topicArn, region);
  }

  // Default: in-memory
  return new InMemoryEventBus();
}

let _manager: EventBusManager | null = null;

export function initEventBus(): EventBusManager {
  if (_manager) return _manager;
  const backend = buildBackendFromEnv();
  _manager = new EventBusManager(backend);
  return _manager;
}

export function getEventBus(): EventBusManager {
  if (!_manager) {
    _manager = new EventBusManager(new InMemoryEventBus());
  }
  return _manager;
}

export function resetEventBus(): void {
  _manager = null;
}

// ============================================================================
// Convenience: emit a sheet change event from handler code
// ============================================================================

export function emitSheetEvent(
  eventType: SheetEventType,
  spreadsheetId: string,
  details?: Partial<Omit<SheetChangeEvent, 'eventType' | 'spreadsheetId' | 'timestamp'>>
): void {
  const event: SheetChangeEvent = {
    eventType,
    spreadsheetId,
    timestamp: new Date().toISOString(),
    ...details,
  };
  // Fire-and-forget; errors are logged inside publish()
  void getEventBus().publish(event);
}
