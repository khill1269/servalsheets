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

// Stub-file register functions (all in one file to survive editor auto-format)
export {
  registerKnowledgeResources,
  listKnowledgeResources,
  registerKnowledgeIndexResource,
  registerHistoryResources,
  registerCacheResources,
  registerTransactionResources,
  registerConflictResources,
  registerImpactResources,
  registerValidationResources,
  registerMetricsResources,
  registerConfirmResources,
  registerAnalyzeResources,
  registerChartResources,
  registerPivotResources,
  registerQualityResources,
  registerDiscoveryResources,
} from './register-stubs.js';

export { registerKnowledgeSearchResource } from './knowledge-search.js';
export {
  registerDeferredKnowledgeResources,
  getKnowledgeCacheStats,
  clearKnowledgeCache,
} from './knowledge-deferred.js';

// Static reference resources
export { registerReferenceResources, readReferenceResource } from './reference.js';

// Performance guide resources
export { registerGuideResources, readGuideResource } from './guides.js';

// Decision tree resources
export { registerDecisionResources, readDecisionResource } from './decisions.js';

// Examples library resources
export { registerExamplesResources, readExamplesResource } from './examples.js';

// Temporary resource storage (Phase 3: Resource URI Fallback)
export {
  getTemporaryResourceStore,
  disposeTemporaryResourceStore,
  TemporaryResourceStore,
} from './temporary-storage.js';

// Workflow patterns resources (UASEV+R protocol demonstrations)
export { registerPatternResources, readPatternResource } from './patterns.js';

// Dynamic sheet discovery (MCP 2025-11-25 Resource Templates)
export { registerSheetResources, readSheetResource } from './sheets.js';

// Time travel debugger (checkpoint-based debugging)
export { registerTimeTravelResources } from './time-travel.js';

// Schema resources for deferred loading (SERVAL_DEFER_SCHEMAS=true)
export {
  registerSchemaResources,
  readSchemaResource,
  getToolSchema,
  getActionGuidance,
  getActionGuidanceIndex,
} from './schemas.js';

// Master index resource (servalsheets://index)
export { registerMasterIndexResource } from './master-index.js';

// Resource change notifications (MCP notifications/resources/list_changed, resources/updated)
export {
  resourceNotifications,
  initializeResourceNotifications,
  teardownResourceNotifications,
} from './notifications.js';

// Connection health resource (Phase 0, Priority 1)
export {
  registerConnectionHealthResource,
  readConnectionHealthResource,
} from './connection-health-resource.js';

// Restart policy health resource (Phase 0, Priority 4)
export {
  registerRestartHealthResource,
  readRestartHealthResource,
} from './restart-health-resource.js';

// Cost dashboard and billing resources
export { registerCostDashboardResources } from './cost-dashboard.js';
