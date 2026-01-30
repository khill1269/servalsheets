/**
 * ServalSheets - Resources Index
 *
 * Exports all resource registration functions.
 *
 * Architectural Notes (MCP 2025-11-25):
 * - confirm://  - Plan confirmation via Elicitation (SEP-1036)
 * - analyze://  - AI analysis via Sampling (SEP-1577)
 * - Removed: planning://, insights:// (replaced by MCP-native patterns)
 */
export { registerKnowledgeResources, listKnowledgeResources } from './knowledge.js';
export { registerHistoryResources } from './history.js';
export { registerCacheResources } from './cache.js';
export { registerTransactionResources } from './transaction.js';
export { registerConflictResources } from './conflict.js';
export { registerImpactResources } from './impact.js';
export { registerValidationResources } from './validation.js';
export { registerMetricsResources } from './metrics.js';
export { registerConfirmResources } from './confirm.js';
export { registerAnalyzeResources } from './analyze.js';
export { registerChartResources } from './charts.js';
export { registerPivotResources } from './pivots.js';
export { registerQualityResources } from './quality.js';
export { registerReferenceResources, readReferenceResource } from './reference.js';
export { registerGuideResources, readGuideResource } from './guides.js';
export { registerDecisionResources, readDecisionResource } from './decisions.js';
export { registerExamplesResources, readExamplesResource } from './examples.js';
export { registerSheetResources, readSheetResource } from './sheets.js';
export { registerSchemaResources, readSchemaResource, getToolSchema } from './schemas.js';
//# sourceMappingURL=index.d.ts.map