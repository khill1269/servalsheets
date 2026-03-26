/**
 * Action Recommender Service — thin re-export facade.
 * Implementation split into src/services/action-recommender/ submodules.
 */

export type { SuggestedAction } from './action-recommender/index.js';
export {
  getRecommendedActions,
  getDataAwareSuggestions,
  getErrorRecoveryActions,
  getWorkflowChainSuggestion,
} from './action-recommender/index.js';
