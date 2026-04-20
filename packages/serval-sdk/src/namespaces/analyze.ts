import type { ServalTransport } from '../transport.js';

export interface AnalyzeDataOptions {
  spreadsheetId: string;
  range: string;
  analysisType?: 'statistics' | 'trends' | 'anomalies' | 'correlations';
}

export interface QuickInsightsResult {
  insights: string[];
  summary: string;
  recommendedActions?: string[];
}

export class AnalyzeNamespace {
  constructor(private readonly transport: ServalTransport) {}

  async analyzeData(options: AnalyzeDataOptions): Promise<unknown> {
    return this.transport.callTool('sheets_analyze', { request: { action: 'analyze_data', ...options } });
  }

  async quickInsights(spreadsheetId: string, range: string): Promise<QuickInsightsResult> {
    return this.transport.callTool('sheets_analyze', { request: { action: 'quick_insights', spreadsheetId, range } }) as never;
  }

  async scout(spreadsheetId: string, sheetName?: string): Promise<unknown> {
    return this.transport.callTool('sheets_analyze', { request: { action: 'scout', spreadsheetId, sheetName } });
  }

  async generateFormula(spreadsheetId: string, description: string, targetRange?: string): Promise<{ formula: string; explanation: string }> {
    return this.transport.callTool('sheets_analyze', { request: { action: 'generate_formula', spreadsheetId, description, targetRange } }) as never;
  }

  async detectPatterns(spreadsheetId: string, range: string): Promise<unknown> {
    return this.transport.callTool('sheets_analyze', { request: { action: 'detect_patterns', spreadsheetId, range } });
  }

  async queryNaturalLanguage(spreadsheetId: string, query: string, range?: string): Promise<unknown> {
    return this.transport.callTool('sheets_analyze', { request: { action: 'query_natural_language', spreadsheetId, query, range } });
  }
}
