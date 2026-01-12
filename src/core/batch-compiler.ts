/**
 * ServalSheets - Batch Compiler
 *
 * Compiles intents into Google Sheets API requests
 * Tighten-up #8: Single batchUpdate compiler
 */

import type { sheets_v4 } from "googleapis";
import { createHash } from "crypto";
import type { Intent } from "./intent.js";
import {
  INTENT_TO_REQUEST_TYPE,
  DESTRUCTIVE_INTENTS,
  HIGH_RISK_INTENTS,
} from "./intent.js";
import type { RateLimiter } from "./rate-limiter.js";
import type { DiffEngine } from "./diff-engine.js";
import type { PolicyEnforcer } from "./policy-enforcer.js";
import type { SnapshotService } from "../services/snapshot.js";
import type {
  SafetyOptions,
  DiffResult,
  ErrorDetail,
} from "../schemas/shared.js";
import {
  monitorPayload,
  type PayloadMetrics,
} from "../utils/payload-monitor.js";
import { analyzeBatchEfficiency } from "../utils/batch-efficiency.js";
import { logger } from "../utils/logger.js";
import { sendProgress } from "../utils/request-context.js";
import { GOOGLE_SHEETS_MAX_BATCH_REQUESTS } from "../config/constants.js";

export interface CompiledBatch {
  spreadsheetId: string;
  requests: sheets_v4.Schema$Request[];
  estimatedCells: number;
  destructive: boolean;
  highRisk: boolean;
  intentCount: number;
}

export interface ExecutionResult {
  success: boolean;
  spreadsheetId: string;
  responses: sheets_v4.Schema$Response[];
  diff?: DiffResult;
  snapshotId?: string | undefined; // Allow undefined for exactOptionalPropertyTypes
  error?: ErrorDetail;
  dryRun: boolean;
  payloadMetrics?: PayloadMetrics;
}

export interface ProgressEvent {
  phase: "validating" | "compiling" | "executing" | "capturing_diff";
  current: number;
  total: number;
  message: string;
  spreadsheetId?: string;
}

export interface BatchCompilerOptions {
  rateLimiter: RateLimiter;
  diffEngine: DiffEngine;
  policyEnforcer: PolicyEnforcer;
  snapshotService: SnapshotService;
  sheetsApi: sheets_v4.Sheets;
  onProgress?: (event: ProgressEvent) => void;
}

export interface SafetyExecutionOptions {
  spreadsheetId: string;
  safety?: SafetyOptions;
  estimatedCells?: number;
  destructive?: boolean;
  highRisk?: boolean;
  range?: string;
  operation: () => Promise<void>;
  diffOptions?: {
    tier?: "METADATA" | "SAMPLE" | "FULL";
    sampleSize?: number;
    maxFullDiffCells?: number;
  };
}

/**
 * Compiles intents into Google Sheets API requests and executes them
 */
export class BatchCompiler {
  private rateLimiter: RateLimiter;
  private diffEngine: DiffEngine;
  private policyEnforcer: PolicyEnforcer;
  private snapshotService: SnapshotService;
  private sheetsApi: sheets_v4.Sheets;
  private onProgress?: (event: ProgressEvent) => void;

  constructor(options: BatchCompilerOptions) {
    this.rateLimiter = options.rateLimiter;
    this.diffEngine = options.diffEngine;
    this.policyEnforcer = options.policyEnforcer;
    this.snapshotService = options.snapshotService;
    this.sheetsApi = options.sheetsApi;
    if (options.onProgress) {
      this.onProgress = options.onProgress;
    }
  }

  /**
   * Compile intents into batched API requests
   */
  async compile(intents: Intent[]): Promise<CompiledBatch[]> {
    // Monitor batch efficiency
    analyzeBatchEfficiency(intents);

    // 1. Validate against policy
    await this.policyEnforcer.validateIntents(intents);

    // 2. Group by spreadsheet
    const grouped = this.groupBySpreadsheet(intents);

    // 3. Convert to API requests
    const batches: CompiledBatch[] = [];

    for (const [spreadsheetId, group] of Object.entries(grouped)) {
      const requests = group.map((intent) => this.intentToRequest(intent));
      const merged = this.mergeCompatibleRequests(requests);
      const chunked = this.chunkRequests(
        merged,
        GOOGLE_SHEETS_MAX_BATCH_REQUESTS,
      );

      for (const chunk of chunked) {
        batches.push({
          spreadsheetId,
          requests: chunk,
          estimatedCells: this.estimateCells(group),
          destructive: group.some((i) => DESTRUCTIVE_INTENTS.has(i.type)),
          highRisk: group.some((i) => HIGH_RISK_INTENTS.has(i.type)),
          intentCount: group.length,
        });
      }
    }

    return batches;
  }

  /**
   * Execute a compiled batch with safety rails
   */
  async execute(
    batch: CompiledBatch,
    safety?: SafetyOptions,
  ): Promise<ExecutionResult> {
    const baseResult = {
      spreadsheetId: batch.spreadsheetId,
      dryRun: safety?.dryRun ?? false,
    };

    // Progress: validating
    this.onProgress?.({
      phase: "validating",
      current: 0,
      total: 4,
      message: "Validating safety constraints",
      spreadsheetId: batch.spreadsheetId,
    });
    await sendProgress(0, 4, "Validating safety constraints");

    // 1. Effect scope check (Tighten-up #2)
    if (safety?.effectScope) {
      const maxCells = safety.effectScope.maxCellsAffected ?? 50000;
      if (batch.estimatedCells > maxCells) {
        return {
          ...baseResult,
          success: false,
          responses: [],
          error: {
            code: "EFFECT_SCOPE_EXCEEDED",
            message: `Operation would affect ~${batch.estimatedCells} cells, limit is ${maxCells}`,
            retryable: false,
            suggestedFix: "Narrow the range or increase maxCellsAffected limit",
          },
        };
      }
    }

    // 2. Rate limit check
    await this.rateLimiter.acquire("write", batch.requests.length);

    // 3. Expected state check (Tighten-up #1)
    if (safety?.expectedState) {
      const mismatch = await this.checkExpectedState(
        batch.spreadsheetId,
        safety.expectedState,
      );
      if (mismatch) {
        return {
          ...baseResult,
          success: false,
          responses: [],
          error: mismatch,
        };
      }
    }

    // 4. Dry run - return estimate
    if (safety?.dryRun) {
      return {
        ...baseResult,
        success: true,
        responses: [],
        diff: {
          tier: "METADATA",
          before: {
            timestamp: new Date().toISOString(),
            rowCount: 0,
            columnCount: 0,
            checksum: "",
          },
          after: {
            timestamp: new Date().toISOString(),
            rowCount: 0,
            columnCount: 0,
            checksum: "",
          },
          summary: {
            rowsChanged: 0,
            estimatedCellsChanged: batch.estimatedCells,
          },
        },
      };
    }

    // Progress: compiling/preparing
    this.onProgress?.({
      phase: "compiling",
      current: 1,
      total: 4,
      message: "Capturing current state",
      spreadsheetId: batch.spreadsheetId,
    });
    await sendProgress(1, 4, "Capturing current state");

    // 5. Capture before state (for diff)
    const diffTier = this.diffEngine.getDefaultTier();
    const beforeState = await this.diffEngine.captureState(
      batch.spreadsheetId,
      { tier: diffTier },
    );

    // 6. Auto-snapshot for high-risk operations
    let snapshotId: string | undefined;
    if (batch.highRisk && safety?.autoSnapshot !== false) {
      snapshotId = await this.snapshotService.create(batch.spreadsheetId);
    }

    // Progress: executing
    this.onProgress?.({
      phase: "executing",
      current: 2,
      total: 4,
      message: `Executing ${batch.requests.length} request(s)`,
      spreadsheetId: batch.spreadsheetId,
    });
    await sendProgress(2, 4, `Executing ${batch.requests.length} request(s)`);

    // 7. Validate payload size BEFORE execution
    const requestPayload = { requests: batch.requests };
    const payloadSize = JSON.stringify(requestPayload).length;
    const MAX_PAYLOAD_SIZE = 9_000_000; // 9MB (leave 1MB buffer for Google's 10MB limit)
    const WARNING_THRESHOLD = 7_000_000; // 7MB warning threshold

    if (payloadSize > MAX_PAYLOAD_SIZE) {
      return {
        ...baseResult,
        success: false,
        responses: [],
        snapshotId, // Return snapshot ID if already created
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: `Request payload (${(payloadSize / 1_000_000).toFixed(2)}MB) exceeds Google's 9MB limit`,
          retryable: false,
          suggestedFix:
            "Split operation into smaller batches or reduce data size",
          details: {
            payloadSizeMB: (payloadSize / 1_000_000).toFixed(2),
            limitMB: 9,
            requestCount: batch.requests.length,
          },
        },
      };
    }

    // Log warning if approaching limit
    if (payloadSize > WARNING_THRESHOLD) {
      logger.warn("Payload size approaching limit", {
        spreadsheetId: batch.spreadsheetId,
        payloadSizeMB: (payloadSize / 1_000_000).toFixed(2),
        limitMB: 9,
        requestCount: batch.requests.length,
      });
    }

    // 8. Execute the batch
    try {
      const response = await this.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: batch.spreadsheetId,
        requestBody: requestPayload,
      });

      // Monitor payload sizes
      const payloadMetrics = monitorPayload(
        `batchUpdate:${batch.spreadsheetId}`,
        requestPayload,
        response.data,
      );

      // Progress: diffing
      this.onProgress?.({
        phase: "capturing_diff",
        current: 3,
        total: 4,
        message: "Capturing changes",
        spreadsheetId: batch.spreadsheetId,
      });
      await sendProgress(3, 4, "Capturing changes");

      // 8. Capture after state and generate diff
      const afterState = await this.diffEngine.captureState(
        batch.spreadsheetId,
        { tier: diffTier },
      );
      const diff = await this.diffEngine.diff(beforeState, afterState);

      return {
        ...baseResult,
        success: true,
        responses: response.data.replies ?? [],
        diff,
        snapshotId,
        payloadMetrics,
      };
    } catch (error) {
      return {
        ...baseResult,
        success: false,
        responses: [],
        snapshotId, // Still return snapshot ID for recovery
        error: this.mapGoogleError(error),
      };
    }
  }

  /**
   * Execute a custom operation with safety rails and diff capture
   */
  async executeWithSafety(
    options: SafetyExecutionOptions,
  ): Promise<ExecutionResult> {
    const safety = options.safety;
    const baseResult = {
      spreadsheetId: options.spreadsheetId,
      dryRun: safety?.dryRun ?? false,
    };
    const estimatedCells = options.estimatedCells ?? 0;
    const highRisk = options.highRisk ?? options.destructive ?? false;

    this.onProgress?.({
      phase: "validating",
      current: 0,
      total: 4,
      message: "Validating safety constraints",
      spreadsheetId: options.spreadsheetId,
    });
    await sendProgress(0, 4, "Validating safety constraints");

    if (safety?.effectScope) {
      const maxCells = safety.effectScope.maxCellsAffected ?? 50000;
      if (estimatedCells > maxCells) {
        return {
          ...baseResult,
          success: false,
          responses: [],
          error: {
            code: "EFFECT_SCOPE_EXCEEDED",
            message: `Operation would affect ~${estimatedCells} cells, limit is ${maxCells}`,
            retryable: false,
            suggestedFix: "Narrow the range or increase maxCellsAffected limit",
          },
        };
      }

      if (safety.effectScope.requireExplicitRange && !options.range) {
        return {
          ...baseResult,
          success: false,
          responses: [],
          error: {
            code: "EXPLICIT_RANGE_REQUIRED",
            message: "Explicit range required for this operation",
            retryable: false,
            suggestedFix: "Provide an explicit A1 range",
          },
        };
      }
    }

    await this.rateLimiter.acquire("write", 1);

    if (safety?.expectedState) {
      const mismatch = await this.checkExpectedState(
        options.spreadsheetId,
        safety.expectedState,
      );
      if (mismatch) {
        return {
          ...baseResult,
          success: false,
          responses: [],
          error: mismatch,
        };
      }
    }

    if (safety?.dryRun) {
      return {
        ...baseResult,
        success: true,
        responses: [],
        diff: {
          tier: "METADATA",
          before: {
            timestamp: new Date().toISOString(),
            rowCount: 0,
            columnCount: 0,
            checksum: "",
          },
          after: {
            timestamp: new Date().toISOString(),
            rowCount: 0,
            columnCount: 0,
            checksum: "",
          },
          summary: {
            rowsChanged: 0,
            estimatedCellsChanged: estimatedCells,
          },
        },
      };
    }

    this.onProgress?.({
      phase: "compiling",
      current: 1,
      total: 4,
      message: "Capturing current state",
      spreadsheetId: options.spreadsheetId,
    });
    await sendProgress(1, 4, "Capturing current state");

    // Use provided diffOptions or fall back to default tier
    const diffTier =
      options.diffOptions?.tier ?? this.diffEngine.getDefaultTier();
    const beforeState = await this.diffEngine.captureState(
      options.spreadsheetId,
      {
        tier: diffTier,
        sampleSize: options.diffOptions?.sampleSize,
        maxFullDiffCells: options.diffOptions?.maxFullDiffCells,
      },
    );

    let snapshotId: string | undefined;
    if (highRisk && safety?.autoSnapshot !== false) {
      snapshotId = await this.snapshotService.create(options.spreadsheetId);
    }

    this.onProgress?.({
      phase: "executing",
      current: 2,
      total: 4,
      message: "Executing operation",
      spreadsheetId: options.spreadsheetId,
    });
    await sendProgress(2, 4, "Executing operation");

    try {
      await options.operation();
    } catch (error) {
      return {
        ...baseResult,
        success: false,
        responses: [],
        snapshotId,
        error: this.mapGoogleError(error),
      };
    }

    this.onProgress?.({
      phase: "capturing_diff",
      current: 3,
      total: 4,
      message: "Capturing changes",
      spreadsheetId: options.spreadsheetId,
    });
    await sendProgress(3, 4, "Capturing changes");

    const afterState = await this.diffEngine.captureState(
      options.spreadsheetId,
      {
        tier: diffTier,
        sampleSize: options.diffOptions?.sampleSize,
        maxFullDiffCells: options.diffOptions?.maxFullDiffCells,
      },
    );
    const diff = await this.diffEngine.diff(beforeState, afterState);

    return {
      ...baseResult,
      success: true,
      responses: [],
      diff,
      snapshotId,
    };
  }

  /**
   * Execute multiple batches with parallelization by spreadsheet
   * Batches for different spreadsheets run in parallel
   * Batches for the same spreadsheet run sequentially (maintains safety)
   */
  async executeAll(
    batches: CompiledBatch[],
    safety?: SafetyOptions,
  ): Promise<ExecutionResult[]> {
    // Group batches by spreadsheetId for parallel execution
    const batchesBySpreadsheet = new Map<
      string,
      Array<{ batch: CompiledBatch; index: number }>
    >();

    batches.forEach((batch, index) => {
      const spreadsheetId = batch.spreadsheetId;
      if (!batchesBySpreadsheet.has(spreadsheetId)) {
        batchesBySpreadsheet.set(spreadsheetId, []);
      }
      batchesBySpreadsheet.get(spreadsheetId)!.push({ batch, index });
    });

    // Execute each spreadsheet's batches sequentially, but different spreadsheets in parallel
    const spreadsheetResults = await Promise.all(
      Array.from(batchesBySpreadsheet.values()).map(
        async (spreadsheetBatches) => {
          const groupResults: Array<{
            result: ExecutionResult;
            index: number;
          }> = [];

          for (const { batch, index } of spreadsheetBatches) {
            const result = await this.execute(batch, safety);
            groupResults.push({ result, index });

            // Stop on first failure within this spreadsheet's batches
            if (!result.success) {
              break;
            }
          }

          return groupResults;
        },
      ),
    );

    // Flatten and sort results by original index to maintain order
    const allResults = spreadsheetResults
      .flat()
      .sort((a, b) => a.index - b.index)
      .map((item) => item.result);

    return allResults;
  }

  // ============================================================
  // Private Methods
  // ============================================================

  private groupBySpreadsheet(intents: Intent[]): Record<string, Intent[]> {
    return intents.reduce(
      (acc, intent) => {
        const id = intent.target.spreadsheetId;
        if (!acc[id]) acc[id] = [];
        acc[id].push(intent);
        return acc;
      },
      {} as Record<string, Intent[]>,
    );
  }

  private intentToRequest(intent: Intent): sheets_v4.Schema$Request {
    const requestType = INTENT_TO_REQUEST_TYPE[intent.type];
    return { [requestType]: intent.payload } as sheets_v4.Schema$Request;
  }

  private mergeCompatibleRequests(
    requests: sheets_v4.Schema$Request[],
  ): sheets_v4.Schema$Request[] {
    // For now, return as-is
    // Future: merge multiple updateCells for same range, etc.
    return requests;
  }

  private chunkRequests<T>(array: T[], size: number): T[][] {
    // Validate against Google Sheets API limit (100 requests per batchUpdate)
    const maxSize = GOOGLE_SHEETS_MAX_BATCH_REQUESTS;
    if (size > maxSize) {
      logger.warn(
        `Requested batch size ${size} exceeds Google Sheets API limit ${maxSize}, using ${maxSize}`,
      );
      size = maxSize;
    }

    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks.length > 0 ? chunks : [[]];
  }

  private estimateCells(intents: Intent[]): number {
    return intents.reduce((sum, intent) => {
      return sum + (intent.metadata.estimatedCells ?? 100);
    }, 0);
  }

  private async checkExpectedState(
    spreadsheetId: string,
    expected: NonNullable<SafetyOptions["expectedState"]>,
  ): Promise<ErrorDetail | null> {
    try {
      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: "sheets.properties",
      });

      const sheets = response.data.sheets ?? [];

      // Check row count
      if (expected.rowCount !== undefined) {
        const totalRows = sheets.reduce(
          (sum, s) => sum + (s.properties?.gridProperties?.rowCount ?? 0),
          0,
        );
        if (totalRows !== expected.rowCount) {
          return {
            code: "PRECONDITION_FAILED",
            message: `Expected ${expected.rowCount} rows, found ${totalRows}`,
            retryable: true,
            suggestedFix: "Re-read the spreadsheet and try again",
          };
        }
      }

      // Check sheet title
      if (expected.sheetTitle !== undefined) {
        const found = sheets.some(
          (s) => s.properties?.title === expected.sheetTitle,
        );
        if (!found) {
          return {
            code: "PRECONDITION_FAILED",
            message: `Sheet "${expected.sheetTitle}" not found`,
            retryable: true,
            suggestedFix: "Verify the sheet exists and try again",
          };
        }
      }

      // Check checksum of range values
      if (expected.checksum !== undefined) {
        const checksumRange = expected.checksumRange ?? "A1:J10";
        try {
          const valuesResponse = await this.sheetsApi.spreadsheets.values.get({
            spreadsheetId,
            range: checksumRange,
            valueRenderOption: "UNFORMATTED_VALUE",
          });
          const values = valuesResponse.data.values ?? [];
          const actualChecksum = createHash("md5")
            .update(JSON.stringify(values))
            .digest("hex");

          if (actualChecksum !== expected.checksum) {
            return {
              code: "PRECONDITION_FAILED",
              message: `Checksum mismatch: expected ${expected.checksum.slice(0, 8)}..., got ${actualChecksum.slice(0, 8)}...`,
              retryable: true,
              suggestedFix: "Data changed since last read. Re-read and retry.",
            };
          }
        } catch {
          return {
            code: "INTERNAL_ERROR",
            message: "Failed to validate checksum",
            retryable: true,
          };
        }
      }

      // Check first row values (headers)
      if (expected.firstRowValues !== undefined) {
        try {
          const sheetPrefix = expected.sheetTitle
            ? `'${expected.sheetTitle.replace(/'/g, "''")}'!`
            : "";
          const headerResponse = await this.sheetsApi.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetPrefix}1:1`,
            valueRenderOption: "FORMATTED_VALUE",
          });

          const actualValues = (headerResponse.data.values?.[0] ??
            []) as string[];
          for (let i = 0; i < expected.firstRowValues.length; i++) {
            if (actualValues[i] !== expected.firstRowValues[i]) {
              return {
                code: "PRECONDITION_FAILED",
                message: `Header mismatch at column ${i + 1}: expected "${expected.firstRowValues[i]}", got "${actualValues[i] ?? "(empty)"}"`,
                retryable: true,
                suggestedFix: "Column structure changed. Verify headers.",
              };
            }
          }
        } catch {
          return {
            code: "INTERNAL_ERROR",
            message: "Failed to validate headers",
            retryable: true,
          };
        }
      }

      return null;
    } catch {
      return {
        code: "INTERNAL_ERROR",
        message: "Failed to check expected state",
        retryable: true,
      };
    }
  }

  private mapGoogleError(error: unknown): ErrorDetail {
    if (error instanceof Error) {
      const message = error.message;

      // Rate limit
      if (message.includes("429") || message.includes("rate limit")) {
        // Dynamically throttle rate limiter for 60 seconds
        this.rateLimiter.throttle(60000);

        return {
          code: "RATE_LIMITED",
          message:
            "API rate limit exceeded. Rate limiter automatically throttled for 60 seconds.",
          retryable: true,
          retryAfterMs: 60000,
          suggestedFix:
            "Wait a minute and try again. Rate limits have been temporarily reduced.",
        };
      }

      // Permission
      if (message.includes("403") || message.includes("permission")) {
        return {
          code: "PERMISSION_DENIED",
          message: "Permission denied",
          retryable: false,
          suggestedFix: "Check that you have edit access to the spreadsheet",
        };
      }

      // Not found
      if (message.includes("404") || message.includes("not found")) {
        return {
          code: "SPREADSHEET_NOT_FOUND",
          message: "Spreadsheet not found",
          retryable: false,
          suggestedFix: "Check the spreadsheet ID",
        };
      }

      // Quota
      if (message.includes("quota")) {
        return {
          code: "QUOTA_EXCEEDED",
          message: "API quota exceeded",
          retryable: true,
          retryAfterMs: 3600000,
          suggestedFix: "Wait an hour or request quota increase",
        };
      }

      return {
        code: "UNKNOWN_ERROR",
        message: error.message,
        retryable: false,
      };
    }

    return {
      code: "UNKNOWN_ERROR",
      message: String(error),
      retryable: false,
    };
  }
}
