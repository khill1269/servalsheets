import { beforeEach, describe, expect, it, vi } from 'vitest';

const resourceRegistrationMocks = vi.hoisted(() => ({
  registerServalSheetsResources: vi.fn(),
  registerKnowledgeResources: vi.fn(),
  registerDeferredKnowledgeResources: vi.fn(),
  registerHistoryResources: vi.fn(),
  registerTimeTravelResources: vi.fn(),
  registerCacheResources: vi.fn(),
  registerTransactionResources: vi.fn(),
  registerConflictResources: vi.fn(),
  registerImpactResources: vi.fn(),
  registerValidationResources: vi.fn(),
  registerMetricsResources: vi.fn(),
  registerConfirmResources: vi.fn(),
  registerAnalyzeResources: vi.fn(),
  registerReferenceResources: vi.fn(),
  registerGuideResources: vi.fn(),
  registerDecisionResources: vi.fn(),
  registerExamplesResources: vi.fn(),
  registerPatternResources: vi.fn(),
  registerSheetResources: vi.fn(),
  registerSchemaResources: vi.fn(),
  registerDiscoveryResources: vi.fn(),
  registerMasterIndexResource: vi.fn(),
  registerKnowledgeIndexResource: vi.fn(),
  registerKnowledgeSearchResource: vi.fn(),
  initializeResourceNotifications: vi.fn(),
  registerConnectionHealthResource: vi.fn(),
  registerRestartHealthResource: vi.fn(),
  registerCostDashboardResources: vi.fn(),
  getEnv: vi.fn(),
  syncToolList: vi.fn(),
}));

vi.mock('../../src/mcp/registration/resource-registration.js', () => ({
  registerServalSheetsResources: resourceRegistrationMocks.registerServalSheetsResources,
}));

vi.mock('../../src/resources/index.js', () => ({
  registerKnowledgeResources: resourceRegistrationMocks.registerKnowledgeResources,
  registerDeferredKnowledgeResources: resourceRegistrationMocks.registerDeferredKnowledgeResources,
  registerHistoryResources: resourceRegistrationMocks.registerHistoryResources,
  registerTimeTravelResources: resourceRegistrationMocks.registerTimeTravelResources,
  registerCacheResources: resourceRegistrationMocks.registerCacheResources,
  registerTransactionResources: resourceRegistrationMocks.registerTransactionResources,
  registerConflictResources: resourceRegistrationMocks.registerConflictResources,
  registerImpactResources: resourceRegistrationMocks.registerImpactResources,
  registerValidationResources: resourceRegistrationMocks.registerValidationResources,
  registerMetricsResources: resourceRegistrationMocks.registerMetricsResources,
  registerConfirmResources: resourceRegistrationMocks.registerConfirmResources,
  registerAnalyzeResources: resourceRegistrationMocks.registerAnalyzeResources,
  registerReferenceResources: resourceRegistrationMocks.registerReferenceResources,
  registerGuideResources: resourceRegistrationMocks.registerGuideResources,
  registerDecisionResources: resourceRegistrationMocks.registerDecisionResources,
  registerExamplesResources: resourceRegistrationMocks.registerExamplesResources,
  registerPatternResources: resourceRegistrationMocks.registerPatternResources,
  registerSheetResources: resourceRegistrationMocks.registerSheetResources,
  registerSchemaResources: resourceRegistrationMocks.registerSchemaResources,
  registerDiscoveryResources: resourceRegistrationMocks.registerDiscoveryResources,
  registerMasterIndexResource: resourceRegistrationMocks.registerMasterIndexResource,
  registerKnowledgeIndexResource: resourceRegistrationMocks.registerKnowledgeIndexResource,
  registerKnowledgeSearchResource: resourceRegistrationMocks.registerKnowledgeSearchResource,
  initializeResourceNotifications: resourceRegistrationMocks.initializeResourceNotifications,
  registerConnectionHealthResource: resourceRegistrationMocks.registerConnectionHealthResource,
  registerRestartHealthResource: resourceRegistrationMocks.registerRestartHealthResource,
  registerCostDashboardResources: resourceRegistrationMocks.registerCostDashboardResources,
}));

vi.mock('../../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/config/env.js')>();
  return {
    ...actual,
    getEnv: resourceRegistrationMocks.getEnv,
  };
});

vi.mock('../../src/resources/notifications.js', () => ({
  resourceNotifications: {
    syncToolList: resourceRegistrationMocks.syncToolList,
  },
}));

import { registerServerResources } from '../../src/server/resource-registration.js';

describe('server resource registration helper', () => {
  beforeEach(() => {
    for (const mock of Object.values(resourceRegistrationMocks)) {
      mock.mockReset();
    }
    resourceRegistrationMocks.getEnv.mockReturnValue({
      ENABLE_TOOLS_LIST_CHANGED_NOTIFICATIONS: true,
    });
  });

  it('supports the eager HTTP registration mode through options', async () => {
    const server = { kind: 'server' };
    const googleClient = { kind: 'google-client' };
    const context = { kind: 'context' };

    await registerServerResources({
      server: server as never,
      googleClient: googleClient as never,
      context: context as never,
      options: {
        deferKnowledgeResources: false,
        includeTimeTravelResources: false,
        toolsListSyncReason: 'http transport resources initialized',
      },
    });

    expect(resourceRegistrationMocks.registerServalSheetsResources).toHaveBeenCalledWith(
      server,
      googleClient
    );
    expect(resourceRegistrationMocks.registerKnowledgeResources).toHaveBeenCalledWith(server);
    expect(resourceRegistrationMocks.registerDeferredKnowledgeResources).not.toHaveBeenCalled();
    expect(resourceRegistrationMocks.registerTimeTravelResources).not.toHaveBeenCalled();
    expect(resourceRegistrationMocks.registerDiscoveryResources).toHaveBeenCalledWith(server);
    expect(resourceRegistrationMocks.registerSheetResources).toHaveBeenCalledWith(server, context);
    expect(resourceRegistrationMocks.initializeResourceNotifications).toHaveBeenCalledWith(server);
    expect(resourceRegistrationMocks.syncToolList).toHaveBeenCalledWith(expect.any(Array), {
      emitOnFirstSet: false,
      reason: 'http transport resources initialized',
    });
  });
});
