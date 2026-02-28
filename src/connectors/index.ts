/**
 * ServalSheets - Connector Framework
 *
 * Barrel export for all connector types, manager, and built-in connectors.
 */

// Core types and interfaces
export * from './types.js';

// Connector manager (singleton)
export { ConnectorManager, connectorManager, applyTransform } from './connector-manager.js';

// Built-in connectors
export { FinnhubConnector } from './finnhub.js';
export { FredConnector } from './fred.js';
export { FmpConnector } from './fmp.js';
export { AlphaVantageConnector } from './alpha-vantage.js';
export { PolygonConnector } from './polygon.js';

// Bridge connectors
export { McpBridgeConnector } from './mcp-bridge.js';
export { GenericRestConnector } from './rest-generic.js';
