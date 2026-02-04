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

export {
  registerKnowledgeResources,
  listKnowledgeResources,
  registerKnowledgeIndexResource,
} from './knowledge.js';
export { registerKnowledgeSearchResource } from './knowledge-search.js';
export {
  registerDeferredKnowledgeResources,
  getKnowledgeCacheStats,
  clearKnowledgeCache,
} from './knowledge-deferred.js';
export { registerHistoryResources } from './history.js';
export { registerCacheResources } from './cache.js';
export { registerTransactionResources } from './transaction.js';
export { registerConflictResources } from './conflict.js';
export { registerImpactResources } from './impact.js';
export { registerValidationResources } from './validation.js';
export { registerMetricsResources } from './metrics.js';

// New MCP-native resources
export { registerConfirmResources } from './confirm.js';
export { registerAnalyzeResources } from './analyze.js';

// Data exploration resources
export { registerChartResources } from './charts.js';
export { registerPivotResources } from './pivots.js';
export { registerQualityResources } from './quality.js';

// Static reference resources
export { registerReferenceResources, readReferenceResource } from './reference.js';

// Performance guide resources
export { registerGuideResources, readGuideResource } from './guides.js';

// Decision tree resources
export { registerDecisionResources, readDecisionResource } from './decisions.js';

// Examples library resources
export { registerExamplesResources, readExamplesResource } from './examples.js';

// Temporary resource storage (Phase 3: Resource URI Fallback)
export { getTemporaryResourceStore, TemporaryResourceStore } from './temporary-storage.js';

// Workflow patterns resources (UASEV+R protocol demonstrations)
export { registerPatternResources, readPatternResource } from './patterns.js';

// Dynamic sheet discovery (MCP 2025-11-25 Resource Templates)
export { registerSheetResources, readSheetResource } from './sheets.js';

// Schema resources for deferred loading (SERVAL_DEFER_SCHEMAS=true)
export { registerSchemaResources, readSchemaResource, getToolSchema } from './schemas.js';

// Discovery resources for API health monitoring (Phase 4)
export { registerDiscoveryResources } from './discovery.js';

// Master index resource (servalsheets://index)
export { registerMasterIndexResource } from './master-index.js';

// Resource change notifications (MCP notifications/resources/list_changed)
export { resourceNotifications, initializeResourceNotifications } from './notifications.js';
