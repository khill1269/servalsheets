/**
 * Live API Client Wrapper
 *
 * Provides authenticated Google Sheets API client for live testing.
 * Handles credential loading, metrics tracking, and request logging.
 */

import { google, sheets_v4, drive_v3 } from 'googleapis';
import type { GaxiosResponse } from 'gaxios';
import {
  loadTestCredentials,
  shouldRunIntegrationTests,
  type TestCredentials,
} from '../../helpers/credential-loader.js';

export interface LiveApiClientOptions {
  logRequests?: boolean;
  trackMetrics?: boolean;
}

export interface RequestMetrics {
  operation: string;
  method: string;
  startTime: number;
  duration: number;
  statusCode?: number;
  bytesTransferred?: number;
}

export interface ApiStats {
  totalRequests: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  byOperation: Record<string, { count: number; avgDuration: number }>;
}

/**
 * Live API Client with metrics tracking
 *
 * Note: For automatic metrics tracking, use trackOperation() method.
 * Direct API calls via client.sheets.* are not auto-tracked due to
 * Google API client limitations with JavaScript Proxies.
 */
export class LiveApiClient {
  private sheetsApi: sheets_v4.Sheets;
  private driveApi: drive_v3.Drive;
  private credentials: TestCredentials;
  private metrics: RequestMetrics[] = [];
  private options: LiveApiClientOptions;

  constructor(credentials: TestCredentials, options: LiveApiClientOptions = {}) {
    this.credentials = credentials;
    this.options = options;

    let auth;

    if (credentials.serviceAccount) {
      // Initialize with service account
      auth = new google.auth.GoogleAuth({
        credentials: credentials.serviceAccount,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive',
        ],
      });
    } else if (credentials.oauth) {
      // Initialize with OAuth credentials
      const oauth2Client = new google.auth.OAuth2(
        credentials.oauth.client_id,
        credentials.oauth.client_secret,
        credentials.oauth.redirect_uri
      );
      oauth2Client.setCredentials(credentials.oauth.tokens);
      auth = oauth2Client;
    } else {
      throw new Error('No valid credentials found. Provide either serviceAccount or oauth credentials.');
    }

    this.sheetsApi = google.sheets({ version: 'v4', auth });
    this.driveApi = google.drive({ version: 'v3', auth });
  }

  get sheets(): sheets_v4.Sheets {
    return this.sheetsApi;
  }

  get drive(): drive_v3.Drive {
    return this.driveApi;
  }

  get testSpreadsheetId(): string {
    return this.credentials.testSpreadsheet.id;
  }

  get testSpreadsheetName(): string | undefined {
    return this.credentials.testSpreadsheet.name;
  }

  /**
   * Track an operation and record metrics.
   * Use this method when you need explicit metrics tracking.
   */
  async trackOperation<T>(
    operation: string,
    method: string,
    fn: () => Promise<GaxiosResponse<T>>
  ): Promise<GaxiosResponse<T>> {
    const startTime = performance.now();

    try {
      const response = await fn();
      const duration = performance.now() - startTime;

      const metric: RequestMetrics = {
        operation,
        method,
        startTime,
        duration,
        statusCode: response.status,
      };

      this.metrics.push(metric);

      if (this.options.logRequests) {
        console.log(`[API] ${operation} ${method}: ${duration.toFixed(2)}ms (${response.status})`);
      }

      return response;
    } catch (error) {
      const duration = performance.now() - startTime;

      this.metrics.push({
        operation,
        method,
        startTime,
        duration,
        statusCode: (error as { code?: number }).code,
      });

      throw error;
    }
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): RequestMetrics[] {
    return [...this.metrics];
  }

  /**
   * Calculate aggregate statistics
   */
  getStats(): ApiStats {
    if (this.metrics.length === 0) {
      return {
        totalRequests: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        byOperation: {},
      };
    }

    const durations = this.metrics.map((m) => m.duration);
    const totalDuration = durations.reduce((a, b) => a + b, 0);

    const byOperation: Record<string, { count: number; avgDuration: number }> = {};
    for (const metric of this.metrics) {
      if (!byOperation[metric.operation]) {
        byOperation[metric.operation] = { count: 0, avgDuration: 0 };
      }
      byOperation[metric.operation].count++;
      byOperation[metric.operation].avgDuration += metric.duration;
    }

    for (const op of Object.keys(byOperation)) {
      byOperation[op].avgDuration /= byOperation[op].count;
    }

    return {
      totalRequests: this.metrics.length,
      totalDuration,
      avgDuration: totalDuration / this.metrics.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      byOperation,
    };
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics = [];
  }

  /**
   * Get test configuration
   */
  getTestConfig(): TestCredentials['testConfig'] {
    return this.credentials.testConfig;
  }
}

// Singleton instance
let liveClientInstance: LiveApiClient | null = null;

/**
 * Get the singleton live API client
 * Throws if credentials are not configured
 */
export async function getLiveApiClient(
  options: LiveApiClientOptions = {}
): Promise<LiveApiClient> {
  if (!shouldRunIntegrationTests()) {
    throw new Error(
      'Live API tests are not enabled. Set TEST_REAL_API=true to run live tests.'
    );
  }

  if (!liveClientInstance) {
    const credentials = await loadTestCredentials();
    if (!credentials) {
      throw new Error(
        'Live API credentials not configured. ' +
          'Set GOOGLE_APPLICATION_CREDENTIALS and TEST_SPREADSHEET_ID environment variables.'
      );
    }
    liveClientInstance = new LiveApiClient(credentials, options);
  }

  return liveClientInstance;
}

/**
 * Reset the singleton (for test isolation)
 */
export function resetLiveApiClient(): void {
  liveClientInstance = null;
}

/**
 * Check if live API tests should run
 */
export function isLiveApiEnabled(): boolean {
  return shouldRunIntegrationTests();
}
