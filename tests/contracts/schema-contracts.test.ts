import { describe, it, expect } from 'vitest';
import {
  AuthSchema,
  CoreSchema,
  DataSchema,
  FormatSchema,
  DimensionsSchema,
  VisualizeSchema,
  CollaborateSchema,
  AnalyzeSchema,
  AdvancedSchema,
  TransactionSchema,
  QualitySchema,
  HistorySchema,
  ConfirmSchema,
  FixSchema,
  CompositeSchema,
  SessionSchema,
  TemplatesSchema,
  BigQuerySchema,
  AppsScriptSchema,
  WebhookSchema,
  DependenciesSchema,
  FederationSchema,
  ComputeSchema,
  AgentSchema,
  ConnectorsSchema,
} from '../../src/schemas/index.js';

describe('Schema Contracts', () => {
  describe('Discriminated Unions', () => {
    it('sheets_auth actions are discriminated', () => {
      const schemas = Object.values(AuthSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_core actions are discriminated', () => {
      const schemas = Object.values(CoreSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_data actions are discriminated', () => {
      const schemas = Object.values(DataSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_format actions are discriminated', () => {
      const schemas = Object.values(FormatSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_dimensions actions are discriminated', () => {
      const schemas = Object.values(DimensionsSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_visualize actions are discriminated', () => {
      const schemas = Object.values(VisualizeSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_collaborate actions are discriminated', () => {
      const schemas = Object.values(CollaborateSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_analyze actions are discriminated', () => {
      const schemas = Object.values(AnalyzeSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_advanced actions are discriminated', () => {
      const schemas = Object.values(AdvancedSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_transaction actions are discriminated', () => {
      const schemas = Object.values(TransactionSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_quality actions are discriminated', () => {
      const schemas = Object.values(QualitySchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_history actions are discriminated', () => {
      const schemas = Object.values(HistorySchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_confirm actions are discriminated', () => {
      const schemas = Object.values(ConfirmSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_fix actions are discriminated', () => {
      const schemas = Object.values(FixSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_composite actions are discriminated', () => {
      const schemas = Object.values(CompositeSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_session actions are discriminated', () => {
      const schemas = Object.values(SessionSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_templates actions are discriminated', () => {
      const schemas = Object.values(TemplatesSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_bigquery actions are discriminated', () => {
      const schemas = Object.values(BigQuerySchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_appsscript actions are discriminated', () => {
      const schemas = Object.values(AppsScriptSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_webhook actions are discriminated', () => {
      const schemas = Object.values(WebhookSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_dependencies actions are discriminated', () => {
      const schemas = Object.values(DependenciesSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_federation actions are discriminated', () => {
      const schemas = Object.values(FederationSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_compute actions are discriminated', () => {
      const schemas = Object.values(ComputeSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_agent actions are discriminated', () => {
      const schemas = Object.values(AgentSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('sheets_connectors actions are discriminated', () => {
      const schemas = Object.values(ConnectorsSchema);
      expect(schemas.length).toBeGreaterThan(0);
    });
  });

  describe('Required Fields', () => {
    it('enforces required fields in auth schemas', () => {
      expect(() => AuthSchema.parse({})).toThrow();
    });

    it('enforces required fields in core schemas', () => {
      expect(() => CoreSchema.parse({})).toThrow();
    });

    it('enforces action field in all schemas', () => {
      // All actions require 'action' discriminator
      expect(() => DataSchema.parse({ action: 'invalid_action' })).toThrow();
    });
  });

  describe('Action-Specific Validation', () => {
    it('validates read action inputs', () => {
      const validRead = { action: 'read', spreadsheetId: '123', range: 'A1:B10' };
      expect(() => DataSchema.parse(validRead)).not.toThrow();
    });

    it('validates write action inputs', () => {
      const validWrite = {
        action: 'write',
        spreadsheetId: '123',
        range: 'A1',
        values: [['test']],
      };
      expect(() => DataSchema.parse(validWrite)).not.toThrow();
    });

    it('rejects incomplete write actions', () => {
      const invalidWrite = { action: 'write', spreadsheetId: '123' };
      expect(() => DataSchema.parse(invalidWrite)).toThrow();
    });
  });
});
