import { dispatchToolCall, resolveExecutionTarget } from './dispatch-tool-call.js';
import {
  ALL_TOOL_NAMES,
  getToolRoutePolicy,
  getToolRoutingSummary,
  getTransportVisibleToolNames,
  listToolsByRouteMode,
  validateToolRouteManifest,
} from './tool-route-manifest.js';

export function createMcpRuntime() {
  return {
    allToolNames: ALL_TOOL_NAMES,
    getToolRoutePolicy,
    listToolsByRouteMode,
    getTransportVisibleToolNames,
    getToolRoutingSummary,
    validateToolRouteManifest,
    resolveExecutionTarget,
    dispatchToolCall,
  };
}
