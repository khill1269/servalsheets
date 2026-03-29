/**
 * Quality conflict detection and resolution actions.
 */

import { ErrorCodes } from '../error-codes.js';
import { getConflictDetector } from '../../services/conflict-detector.js';
import { generateAIInsight } from '../../mcp/sampling.js';
import type { SamplingServer } from '../../mcp/sampling.js';
import type {
  QualityDetectConflictsInput,
  QualityResolveConflictInput,
  QualityResponse,
} from '../../schemas/quality.js';
import type { Conflict as ConflictRecord } from '../../types/conflict.js';

// Map ResolutionStrategy → schema suggestedStrategy enum
function mapStrategy(s: string): 'keep_local' | 'keep_remote' | 'merge' | 'manual' {
  if (s === 'overwrite' || s === 'first_write_wins') return 'keep_local';
  if (s === 'cancel' || s === 'last_write_wins') return 'keep_remote';
  if (s === 'merge') return 'merge';
  return 'manual';
}

// Map ConflictSeverity → schema severity enum
function mapSeverity(s: string): 'low' | 'medium' | 'high' | 'critical' {
  if (s === 'info') return 'low';
  if (s === 'warning') return 'medium';
  if (s === 'error') return 'high';
  if (s === 'critical') return 'critical';
  return 'low';
}

// Map ConflictType → schema conflictType enum
function mapConflictType(t: string): 'concurrent_write' | 'version_mismatch' | 'data_race' {
  if (t === 'concurrent_modification' || t === 'overlapping_range') return 'concurrent_write';
  if (t === 'stale_data') return 'version_mismatch';
  return 'data_race';
}

export async function handleDetectConflicts(
  input: QualityDetectConflictsInput,
  samplingServer?: SamplingServer
): Promise<QualityResponse> {
  let activeConflicts: ConflictRecord[] = [];
  try {
    const detector = getConflictDetector();
    activeConflicts = detector.getActiveConflicts();
  } catch {
    // Detector not initialized — return empty list gracefully
  }

  // Filter by spreadsheetId if provided
  if (input.spreadsheetId) {
    activeConflicts = activeConflicts.filter((c) => c.spreadsheetId === input.spreadsheetId);
  }

  const mappedConflicts = activeConflicts.map((c) => ({
    id: c.id,
    spreadsheetId: c.spreadsheetId,
    range: c.range,
    localVersion: c.yourVersion.version,
    remoteVersion: c.currentVersion.version,
    localValue: c.yourVersion.checksum as string,
    remoteValue: c.currentVersion.checksum as string,
    conflictType: mapConflictType(c.type),
    severity: mapSeverity(c.severity),
    detectedAt: c.timestamp,
    suggestedStrategy: mapStrategy(c.suggestedResolution),
  }));

  // Generate AI insight when conflicts are present
  let aiInsight: string | undefined;
  if (samplingServer && mappedConflicts.length > 0) {
    aiInsight = await generateAIInsight(
      samplingServer,
      'dataAnalysis',
      'Analyze these conflicts and recommend the best resolution strategy for each',
      JSON.stringify(mappedConflicts),
      { maxTokens: 300 }
    );
  }

  const message =
    mappedConflicts.length === 0
      ? 'No active conflicts detected.'
      : `${mappedConflicts.length} active conflict(s) detected.`;

  return {
    success: true,
    action: 'detect_conflicts',
    conflicts: mappedConflicts,
    message,
    ...(aiInsight !== undefined ? { aiInsight } : {}),
  };
}

export async function handleResolveConflict(
  input: QualityResolveConflictInput
): Promise<QualityResponse> {
  const conflictDetector = getConflictDetector();

  // Map schema strategy to actual ResolutionStrategy type
  const strategyMap: Record<
    string,
    'overwrite' | 'merge' | 'cancel' | 'manual' | 'last_write_wins' | 'first_write_wins'
  > = {
    keep_local: 'overwrite',
    keep_remote: 'cancel',
    merge: 'merge',
    manual: 'manual',
  };

  const result = await conflictDetector.resolveConflict({
    conflictId: input.conflictId,
    strategy: strategyMap[input.strategy] || 'manual',
    mergeData: input.mergedValue,
  });

  if (result.success) {
    return {
      success: true,
      action: 'resolve_conflict',
      conflictId: input.conflictId,
      resolved: true,
      resolution: {
        strategy: input.strategy,
        // ChangeSet is a typed object; schema accepts Record<string, unknown> here.
        finalValue: result.changesApplied as unknown as Record<string, unknown>,
        version: result.finalVersion?.version || 0,
      },
      message: `Conflict resolved using strategy: ${input.strategy}`,
    };
  } else {
    return {
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: result.error?.message || 'Failed to resolve conflict',
        retryable: false,
      },
    };
  }
}
