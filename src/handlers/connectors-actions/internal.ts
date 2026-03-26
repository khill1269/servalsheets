/**
 * Internal types shared across connectors-actions submodules.
 */

import { ErrorCodes } from '../error-codes.js';
import { connectorManager } from '../../resources/connectors-runtime.js';
import type { SheetsConnectorsInput, SheetsConnectorsOutput } from '../../schemas/connectors.js';
import type { SamplingServer } from '../../mcp/sampling.js';
import type { ElicitationServer } from '../../mcp/elicitation.js';

export type ConnectorCatalogEntry = ReturnType<
  typeof connectorManager.listConnectors
>['connectors'][number];

export interface ConnectorUxMetadata {
  signupUrl?: string;
  hint?: string;
  recommendedUseCases: string[];
  exampleQuery?: {
    endpoint: string;
    params?: Record<string, string | number | boolean>;
  };
}

export type ConnectorMeta = {
  journeyStage: 'connector_setup';
  nextBestAction: string;
  verificationSummary: string;
  nextSteps?: string[];
};

export type EnrichedConnector = ConnectorCatalogEntry & {
  signupUrl?: string;
  recommendedUseCases: string[];
  nextStep: string;
};

/** Shared context passed from ConnectorsHandler to each action submodule. */
export interface ConnectorsHandlerAccess {
  samplingServer: SamplingServer | undefined;
  elicitationServer: ElicitationServer | undefined;
  sessionContext: import('../../services/session-context.js').SessionContextManager | undefined;
  createMeta(options: {
    nextBestAction: string;
    verificationSummary: string;
    nextSteps?: string[];
  }): ConnectorMeta;
  getConnectorUx(connectorId: string): ConnectorUxMetadata;
  enrichConnector(connector: ConnectorCatalogEntry): EnrichedConnector;
  makeErrorResponse(
    action: SheetsConnectorsInput['request']['action'],
    code: (typeof ErrorCodes)[keyof typeof ErrorCodes],
    message: string,
    suggestedFix?: string,
    nextBestAction?: string
  ): SheetsConnectorsOutput;
  getConnectorCatalog(): ConnectorCatalogEntry[];
  getConnectorEntry(connectorId: string | undefined): ConnectorCatalogEntry | undefined;
  elicitConnectorSelection(): Promise<string | null>;
  elicitApiKey(connector: ConnectorCatalogEntry): Promise<string | null>;
  elicitOAuthCredentials(
    connector: ConnectorCatalogEntry
  ): Promise<import('../../connectors/types.js').ConnectorCredentials['oauth'] | null>;
}
