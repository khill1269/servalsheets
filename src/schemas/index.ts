/**
 * Main schema export barrel
 * Re-exports all schemas and action counts
 */

// Re-export action counts (source of truth)
export { ACTION_COUNT, TOOL_COUNT, TOOL_ACTIONS } from '../generated/action-counts.js';
export { SHEETS_ANNOTATIONS } from '../generated/annotations.js';

// Re-export all tool schemas
export * from './auth.js';
export * from './core.js';
export * from './data.js';
export * from './format.js';
export * from './dimensions.js';
export * from './advanced.js';
export * from './visualize.js';
export * from './collaborate.js';
export * from './composite.js';
export * from './analyze.js';
export * from './fix.js';
export * from './templates.js';
export * from './bigquery.js';
export * from './appsscript.js';
export * from './confirm.js';
export * from './dependencies.js';
export * from './quality.js';
export * from './history.js';
export * from './session.js';
export * from './transaction.js';
export * from './federation.js';
export * from './webhook.js';
export * from './agent.js';
export * from './compute.js';
export * from './connectors.js';
export * from './shared.js';
export * from './descriptions.js';
export * from './descriptions-minimal.js';
export * from './action-metadata.js';
export * from './handler-deviations.js';
export * from './prompts.js';
export * from './rbac.js';
export * from './logging.js';
