/**
 * ServalSheets - Checkpoint System
 *
 * Enables saving and restoring session state across context window resets.
 * When Claude's context fills up after ~100 tool calls, users can resume
 * from the last checkpoint instead of starting over.
 *
 * @module utils/checkpoint
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface Checkpoint {
  sessionId: string;
  timestamp: number;
  createdAt: string;
  description?: string;
  completedSteps: number;
  completedOperations: string[];
  spreadsheetId?: string;
  spreadsheetTitle?: string;
  sheetNames?: string[];
  lastRange?: string;
  context: Record<string, unknown>;
  preferences?: Record<string, unknown>;
}

export interface CheckpointSummary {
  sessionId: string;
  timestamp: number;
  createdAt: string;
  description?: string;
  completedSteps: number;
  spreadsheetTitle?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CHECKPOINT_DIR = '/tmp/servalsheets-checkpoints';
const MAX_CHECKPOINTS_PER_SESSION = 10;
const CHECKPOINT_FILE_EXTENSION = '.checkpoint.json';

function getCheckpointDir(): string {
  return process.env['CHECKPOINT_DIR'] || DEFAULT_CHECKPOINT_DIR;
}

function ensureCheckpointDir(): void {
  const dir = getCheckpointDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    logger.info('Created checkpoint directory', { dir });
  }
}

export function isCheckpointsEnabled(): boolean {
  return process.env['ENABLE_CHECKPOINTS'] === 'true';
}

// ============================================================================
// CHECKPOINT OPERATIONS
// ============================================================================

export function saveCheckpoint(checkpoint: Checkpoint): string {
  if (!isCheckpointsEnabled()) {
    throw new Error('Checkpoints disabled. Set ENABLE_CHECKPOINTS=true');
  }

  ensureCheckpointDir();

  const filename = `${checkpoint.sessionId}-${checkpoint.timestamp}${CHECKPOINT_FILE_EXTENSION}`;
  const filepath = join(getCheckpointDir(), filename);

  const checkpointWithMeta: Checkpoint = {
    ...checkpoint,
    createdAt: new Date(checkpoint.timestamp).toISOString(),
  };

  writeFileSync(filepath, JSON.stringify(checkpointWithMeta, null, 2));

  logger.info('Checkpoint saved', {
    sessionId: checkpoint.sessionId,
    completedSteps: checkpoint.completedSteps,
  });

  cleanupOldCheckpoints(checkpoint.sessionId);
  return filepath;
}

export function loadCheckpoint(sessionId: string): Checkpoint | null {
  if (!isCheckpointsEnabled()) return null;

  const checkpoints = listCheckpointsForSession(sessionId);
  if (checkpoints.length === 0) return null;

  const sorted = checkpoints.sort((a, b) => b.timestamp - a.timestamp);
  const mostRecent = sorted[0]!; // Safe: we checked length > 0
  const filepath = join(
    getCheckpointDir(),
    `${sessionId}-${mostRecent.timestamp}${CHECKPOINT_FILE_EXTENSION}`
  );

  try {
    const data = readFileSync(filepath, 'utf-8');
    return JSON.parse(data) as Checkpoint;
  } catch (error) {
    logger.error('Failed to load checkpoint', { sessionId, error });
    return null;
  }
}

export function loadCheckpointByTimestamp(sessionId: string, timestamp: number): Checkpoint | null {
  if (!isCheckpointsEnabled()) return null;

  const filepath = join(
    getCheckpointDir(),
    `${sessionId}-${timestamp}${CHECKPOINT_FILE_EXTENSION}`
  );

  if (!existsSync(filepath)) return null;

  try {
    const data = readFileSync(filepath, 'utf-8');
    return JSON.parse(data) as Checkpoint;
  } catch (error) {
    logger.error('Failed to load checkpoint', { sessionId, timestamp, error });
    return null;
  }
}

export function listCheckpointsForSession(sessionId: string): CheckpointSummary[] {
  if (!isCheckpointsEnabled()) return [];

  ensureCheckpointDir();
  const dir = getCheckpointDir();

  try {
    const files = readdirSync(dir).filter(
      (f) => f.startsWith(sessionId) && f.endsWith(CHECKPOINT_FILE_EXTENSION)
    );

    return files
      .map((filename) => {
        const filepath = join(dir, filename);
        const data = JSON.parse(readFileSync(filepath, 'utf-8')) as Checkpoint;
        return {
          sessionId: data.sessionId,
          timestamp: data.timestamp,
          createdAt: data.createdAt,
          description: data.description,
          completedSteps: data.completedSteps,
          spreadsheetTitle: data.spreadsheetTitle,
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

export function listAllCheckpoints(): CheckpointSummary[] {
  if (!isCheckpointsEnabled()) return [];

  ensureCheckpointDir();
  const dir = getCheckpointDir();

  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(CHECKPOINT_FILE_EXTENSION));

    return files
      .map((filename) => {
        const filepath = join(dir, filename);
        const data = JSON.parse(readFileSync(filepath, 'utf-8')) as Checkpoint;
        return {
          sessionId: data.sessionId,
          timestamp: data.timestamp,
          createdAt: data.createdAt,
          description: data.description,
          completedSteps: data.completedSteps,
          spreadsheetTitle: data.spreadsheetTitle,
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

export function deleteCheckpoint(sessionId: string, timestamp?: number): boolean {
  if (!isCheckpointsEnabled()) return false;

  const dir = getCheckpointDir();

  if (timestamp) {
    const filepath = join(dir, `${sessionId}-${timestamp}${CHECKPOINT_FILE_EXTENSION}`);
    if (existsSync(filepath)) {
      unlinkSync(filepath);
      return true;
    }
    return false;
  }

  // Delete all for session
  const files = readdirSync(dir).filter(
    (f) => f.startsWith(sessionId) && f.endsWith(CHECKPOINT_FILE_EXTENSION)
  );

  files.forEach((f) => unlinkSync(join(dir, f)));
  return files.length > 0;
}

function cleanupOldCheckpoints(sessionId: string): void {
  const checkpoints = listCheckpointsForSession(sessionId);

  if (checkpoints.length > MAX_CHECKPOINTS_PER_SESSION) {
    const toDelete = checkpoints.slice(MAX_CHECKPOINTS_PER_SESSION);
    toDelete.forEach((cp) => deleteCheckpoint(sessionId, cp.timestamp));
    logger.debug('Cleaned up old checkpoints', {
      sessionId,
      deleted: toDelete.length,
    });
  }
}

// ============================================================================
// HELPER FOR AUTO-CHECKPOINT
// ============================================================================

let operationCounter = 0;
const AUTO_CHECKPOINT_INTERVAL = parseInt(process.env['AUTO_CHECKPOINT_INTERVAL'] || '25', 10);

export function shouldAutoCheckpoint(): boolean {
  if (!isCheckpointsEnabled()) return false;
  operationCounter++;
  return operationCounter % AUTO_CHECKPOINT_INTERVAL === 0;
}

export function getOperationCount(): number {
  return operationCounter;
}

export function resetOperationCounter(): void {
  operationCounter = 0;
}
