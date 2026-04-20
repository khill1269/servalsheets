import type { ServalTransport } from '../transport.js';

export class SessionNamespace {
  constructor(private readonly transport: ServalTransport) {}

  async setActive(spreadsheetId: string, sheetName?: string): Promise<{ success: boolean }> {
    return this.transport.callTool('sheets_session', { request: { action: 'set_active', spreadsheetId, sheetName } }) as never;
  }

  async getActive(): Promise<{ spreadsheetId?: string; sheetName?: string }> {
    return this.transport.callTool('sheets_session', { request: { action: 'get_active' } }) as never;
  }

  async recordOperation(description: string, toolName?: string, actionName?: string): Promise<{ success: boolean }> {
    return this.transport.callTool('sheets_session', { request: { action: 'record_operation', description, toolName, actionName } }) as never;
  }

  async getHistory(limit?: number): Promise<{ operations: Array<{ description: string; timestamp: string; toolName?: string }> }> {
    return this.transport.callTool('sheets_session', { request: { action: 'get_history', limit } }) as never;
  }

  async getContext(): Promise<unknown> {
    return this.transport.callTool('sheets_session', { request: { action: 'get_context' } });
  }

  async reset(): Promise<{ success: boolean }> {
    return this.transport.callTool('sheets_session', { request: { action: 'reset' } }) as never;
  }

  async getPreferences(): Promise<unknown> {
    return this.transport.callTool('sheets_session', { request: { action: 'get_preferences' } });
  }

  async updatePreferences(preferences: Record<string, unknown>): Promise<{ success: boolean }> {
    return this.transport.callTool('sheets_session', { request: { action: 'update_preferences', ...preferences } }) as never;
  }
}
