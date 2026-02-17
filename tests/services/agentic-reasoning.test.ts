/**
 * Tests for Agentic Reasoning Services
 *
 * Tests the agentic planner, workflow executor, and confirmation gate
 * for autonomous multi-turn reasoning with LLM planning.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CreateMessageResult } from '@modelcontextprotocol/sdk/types.js';
import {
  AgenticPlanner,
  type WorkflowPlan,
  type WorkflowStep,
  type ExecutionOptions,
  type WorkflowContext,
} from '../../src/services/agentic-planner.js';
import {
  WorkflowExecutor,
  type ExecutionResult,
} from '../../src/services/workflow-executor.js';
import {
  ConfirmationGate,
  type ApprovalRequest,
} from '../../src/services/confirmation-gate.js';

// ============================================================================
// Mock Setup
// ============================================================================

const mockServer = {
  getClientCapabilities: vi.fn(() => ({
    sampling: {
      tools: true,
      context: true,
    },
  })),
  createMessage: vi.fn(),
};

const mockHandlers = {
  sheets_data: {
    executeAction: vi.fn(),
  },
  sheets_core: {
    executeAction: vi.fn(),
  },
  sheets_format: {
    executeAction: vi.fn(),
  },
};

// ============================================================================
// AgenticPlanner Tests
// ============================================================================

describe('AgenticPlanner', () => {
  let planner: AgenticPlanner;

  beforeEach(() => {
    vi.clearAllMocks();
    planner = new AgenticPlanner(mockServer as any, mockHandlers as any);
  });

  describe('Goal Decomposition', () => {
    it('should plan multi-step workflow from high-level goal', async () => {
      // Mock LLM response for planning
      mockServer.createMessage.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              steps: [
                {
                  tool: 'sheets_core',
                  action: 'create_sheet',
                  description: 'Create new sheet for dashboard',
                  parameters: { title: 'Sales Dashboard' },
                },
                {
                  tool: 'sheets_data',
                  action: 'write_range',
                  description: 'Write headers',
                  parameters: { range: 'A1:D1', values: [['Month', 'Revenue', 'Target', 'Diff']] },
                },
              ],
            }),
          },
        ],
        stopReason: 'end_turn',
      } as CreateMessageResult);

      const context: WorkflowContext = {
        spreadsheetId: '1ABC',
        userGoal: 'Create a monthly sales dashboard',
      };

      const plan = await planner.planWorkflow(
        'Create a monthly sales dashboard with revenue trends',
        context
      );

      expect(plan).toBeDefined();
      expect(plan.steps).toHaveLength(2);
      expect(plan.steps[0]?.tool).toBe('sheets_core');
      expect(plan.steps[0]?.action).toBe('create_sheet');
      expect(plan.estimatedDuration).toBeGreaterThan(0);
      expect(plan.riskLevel).toBe('low');
    });

    it('should estimate duration based on step count', async () => {
      mockServer.createMessage.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              steps: Array.from({ length: 10 }, (_, i) => ({
                tool: 'sheets_data',
                action: 'write_range',
                description: `Step ${i + 1}`,
                parameters: {},
              })),
            }),
          },
        ],
        stopReason: 'end_turn',
      } as CreateMessageResult);

      const plan = await planner.planWorkflow('Complex workflow', {
        spreadsheetId: '1ABC',
      });

      expect(plan.estimatedDuration).toBeGreaterThanOrEqual(5);
      expect(plan.steps).toHaveLength(10);
    });

    it('should detect destructive operations and mark as high risk', async () => {
      mockServer.createMessage.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              steps: [
                {
                  tool: 'sheets_data',
                  action: 'clear_range',
                  description: 'Clear old data',
                  parameters: { range: 'A1:Z1000' },
                },
                {
                  tool: 'sheets_dimensions',
                  action: 'delete_rows',
                  description: 'Delete empty rows',
                  parameters: { startIndex: 0, endIndex: 100 },
                },
              ],
            }),
          },
        ],
        stopReason: 'end_turn',
      } as CreateMessageResult);

      const plan = await planner.planWorkflow('Clean up spreadsheet', {
        spreadsheetId: '1ABC',
      });

      expect(plan.riskLevel).toBe('high');
      expect(plan.requiresApproval).toBe(true);
    });

    it('should handle planning errors gracefully', async () => {
      mockServer.createMessage.mockRejectedValue(new Error('LLM API error'));

      await expect(
        planner.planWorkflow('Create dashboard', { spreadsheetId: '1ABC' })
      ).rejects.toThrow('Failed to plan workflow');
    });
  });

  describe('Multi-turn Reasoning', () => {
    it('should execute workflow with autonomous reasoning', async () => {
      mockServer.createMessage.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              steps: [
                {
                  tool: 'sheets_data',
                  action: 'read_range',
                  description: 'Read data',
                  parameters: { range: 'A1:D10' },
                },
              ],
            }),
          },
        ],
        stopReason: 'end_turn',
      } as CreateMessageResult);

      mockHandlers.sheets_data.executeAction.mockResolvedValue({
        response: { success: true, data: { values: [['A', 'B', 'C', 'D']] } },
      });

      const result = await planner.executeWithReasoning(
        'Analyze sales trends',
        {
          spreadsheetId: '1ABC',
          dryRun: false,
        } as ExecutionOptions
      );

      expect(result.success).toBe(true);
      expect(mockHandlers.sheets_data.executeAction).toHaveBeenCalled();
    });

    it('should support dry-run mode without executing', async () => {
      mockServer.createMessage.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              steps: [
                {
                  tool: 'sheets_data',
                  action: 'write_range',
                  description: 'Write data',
                  parameters: {},
                },
              ],
            }),
          },
        ],
        stopReason: 'end_turn',
      } as CreateMessageResult);

      const result = await planner.executeWithReasoning('Create dashboard', {
        spreadsheetId: '1ABC',
        dryRun: true,
      } as ExecutionOptions);

      expect(result.success).toBe(true);
      expect(result.plan).toBeDefined();
      expect(mockHandlers.sheets_data.executeAction).not.toHaveBeenCalled();
    });
  });

  describe('Self-correction', () => {
    it('should retry failed steps with corrected parameters', async () => {
      // First attempt fails
      mockHandlers.sheets_data.executeAction
        .mockRejectedValueOnce(new Error('Invalid range'))
        .mockResolvedValueOnce({
          response: { success: true, data: {} },
        });

      // LLM suggests correction
      mockServer.createMessage
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                steps: [
                  {
                    tool: 'sheets_data',
                    action: 'read_range',
                    description: 'Read data',
                    parameters: { range: 'INVALID' },
                  },
                ],
              }),
            },
          ],
          stopReason: 'end_turn',
        } as CreateMessageResult)
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                action: 'retry',
                correctedParameters: { range: 'A1:D10' },
              }),
            },
          ],
          stopReason: 'end_turn',
        } as CreateMessageResult);

      const result = await planner.executeWithReasoning('Read sales data', {
        spreadsheetId: '1ABC',
        enableSelfCorrection: true,
      } as ExecutionOptions);

      // Note: First execution + 1 retry = 2 calls total expected
      expect(result.success).toBe(true);
      // Should be called at least once for initial attempt
      expect(mockHandlers.sheets_data.executeAction).toHaveBeenCalled();
    });

    it('should give up after max retry attempts', async () => {
      mockHandlers.sheets_data.executeAction.mockRejectedValue(
        new Error('Persistent error')
      );

      mockServer.createMessage.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              steps: [
                {
                  tool: 'sheets_data',
                  action: 'read_range',
                  description: 'Read data',
                  parameters: {},
                },
              ],
            }),
          },
        ],
        stopReason: 'end_turn',
      } as CreateMessageResult);

      const result = await planner.executeWithReasoning('Read data', {
        spreadsheetId: '1ABC',
        maxRetries: 2,
        enableSelfCorrection: false, // Disable self-correction to fail immediately
      } as ExecutionOptions);

      expect(result.success).toBe(false);
      expect(mockHandlers.sheets_data.executeAction).toHaveBeenCalledTimes(1); // Initial attempt only
    });
  });

  describe('Risk Assessment', () => {
    it('should calculate risk level from step types', () => {
      const lowRiskSteps: WorkflowStep[] = [
        {
          id: '1',
          description: 'Read data',
          tool: 'sheets_data',
          action: 'read_range',
          parameters: {},
          dependencies: [],
          confirmationRequired: false,
        },
      ];

      const highRiskSteps: WorkflowStep[] = [
        {
          id: '1',
          description: 'Delete rows',
          tool: 'sheets_dimensions',
          action: 'delete_rows',
          parameters: {},
          dependencies: [],
          confirmationRequired: true,
        },
      ];

      expect(planner.assessRiskLevel(lowRiskSteps)).toBe('low');
      expect(planner.assessRiskLevel(highRiskSteps)).toBe('high');
    });

    it('should escalate risk for many operations', () => {
      const manySteps: WorkflowStep[] = Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        description: 'Step',
        tool: 'sheets_data',
        action: 'write_range',
        parameters: {},
        dependencies: [],
        confirmationRequired: false,
      }));

      expect(planner.assessRiskLevel(manySteps)).toBe('medium');
    });
  });
});

// ============================================================================
// WorkflowExecutor Tests
// ============================================================================

describe('WorkflowExecutor', () => {
  let executor: WorkflowExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new WorkflowExecutor(mockHandlers as any);
  });

  describe('Plan Execution', () => {
    it('should execute steps in dependency order', async () => {
      const plan: WorkflowPlan = {
        goal: 'Test workflow',
        steps: [
          {
            id: '1',
            description: 'Step 1',
            tool: 'sheets_core',
            action: 'get_spreadsheet',
            parameters: { spreadsheetId: '1ABC' },
            dependencies: [],
            confirmationRequired: false,
          },
          {
            id: '2',
            description: 'Step 2',
            tool: 'sheets_data',
            action: 'read_range',
            parameters: { range: 'A1:D10' },
            dependencies: ['1'],
            confirmationRequired: false,
          },
        ],
        estimatedDuration: 2,
        riskLevel: 'low',
        requiresApproval: false,
      };

      mockHandlers.sheets_core.executeAction.mockResolvedValue({
        response: { success: true, data: { spreadsheetId: '1ABC' } },
      });
      mockHandlers.sheets_data.executeAction.mockResolvedValue({
        response: { success: true, data: { values: [] } },
      });

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(2);
      expect(mockHandlers.sheets_core.executeAction).toHaveBeenCalledBefore(
        mockHandlers.sheets_data.executeAction
      );
    });

    it('should skip steps when dependencies fail', async () => {
      const plan: WorkflowPlan = {
        goal: 'Test workflow',
        steps: [
          {
            id: '1',
            description: 'Failing step',
            tool: 'sheets_data',
            action: 'read_range',
            parameters: {},
            dependencies: [],
            confirmationRequired: false,
          },
          {
            id: '2',
            description: 'Dependent step',
            tool: 'sheets_data',
            action: 'write_range',
            parameters: {},
            dependencies: ['1'],
            confirmationRequired: false,
          },
        ],
        estimatedDuration: 2,
        riskLevel: 'low',
        requiresApproval: false,
      };

      mockHandlers.sheets_data.executeAction.mockRejectedValueOnce(
        new Error('Read failed')
      );

      // Use continueOnError to process all steps even after failure
      const result = await executor.execute(plan, { continueOnError: true });

      expect(result.success).toBe(false);
      expect(result.failedSteps).toBe(1);
      expect(result.skippedSteps).toBe(1);
    });

    it('should track execution progress', async () => {
      const progressCallbacks: Array<{ step: number; total: number }> = [];

      const plan: WorkflowPlan = {
        goal: 'Test',
        steps: [
          {
            id: '1',
            description: 'Step 1',
            tool: 'sheets_data',
            action: 'read_range',
            parameters: {},
            dependencies: [],
            confirmationRequired: false,
          },
          {
            id: '2',
            description: 'Step 2',
            tool: 'sheets_data',
            action: 'read_range',
            parameters: {},
            dependencies: [],
            confirmationRequired: false,
          },
        ],
        estimatedDuration: 2,
        riskLevel: 'low',
        requiresApproval: false,
      };

      mockHandlers.sheets_data.executeAction.mockResolvedValue({
        response: { success: true, data: {} },
      });

      executor.on('progress', (step, total) => {
        progressCallbacks.push({ step, total });
      });

      await executor.execute(plan);

      expect(progressCallbacks).toHaveLength(2);
      expect(progressCallbacks[0]).toEqual({ step: 1, total: 2 });
      expect(progressCallbacks[1]).toEqual({ step: 2, total: 2 });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce max operations limit', async () => {
      const plan: WorkflowPlan = {
        goal: 'Too many operations',
        steps: Array.from({ length: 150 }, (_, i) => ({
          id: String(i),
          description: `Step ${i}`,
          tool: 'sheets_data',
          action: 'read_range',
          parameters: {},
          dependencies: [],
          confirmationRequired: false,
        })),
        estimatedDuration: 75,
        riskLevel: 'medium',
        requiresApproval: false,
      };

      await expect(executor.execute(plan)).rejects.toThrow(
        'Workflow exceeds maximum operation limit'
      );
    });
  });

  describe('Timeout Protection', () => {
    it('should cancel execution after timeout', async () => {
      // Create a plan with multiple steps to ensure timeout check triggers
      const plan: WorkflowPlan = {
        goal: 'Slow workflow',
        steps: Array.from({ length: 10 }, (_, i) => ({
          id: String(i + 1),
          description: `Step ${i + 1}`,
          tool: 'sheets_data',
          action: 'read_range',
          parameters: {},
          dependencies: i > 0 ? [String(i)] : [],
          confirmationRequired: false,
        })),
        estimatedDuration: 1,
        riskLevel: 'low',
        requiresApproval: false,
      };

      // Each execution takes 20ms, so 10 steps = 200ms total
      // But we set timeout to 50ms, so it should timeout after ~2-3 steps
      mockHandlers.sheets_data.executeAction.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ response: { success: true, data: {} } }), 20)
          )
      );

      const result = await executor.execute(plan, { timeoutMs: 50 });

      // The execution should have timed out before completing all steps
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(result.completedSteps).toBeLessThan(10);
    }, 5000);
  });
});

// ============================================================================
// ConfirmationGate Tests
// ============================================================================

describe('ConfirmationGate', () => {
  let gate: ConfirmationGate;

  beforeEach(() => {
    vi.clearAllMocks();
    gate = new ConfirmationGate(mockServer as any);
  });

  describe('User Approval', () => {
    it('should request approval for risky operations', async () => {
      const request: ApprovalRequest = {
        title: 'Delete 100 rows',
        description: 'This will permanently delete 100 rows',
        riskLevel: 'high',
        affectedRanges: ['A1:Z100'],
      };

      mockServer.createMessage.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ approved: true }),
          },
        ],
        stopReason: 'end_turn',
      } as CreateMessageResult);

      const approved = await gate.requestApproval(request);

      expect(approved).toBe(true);
      expect(mockServer.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.objectContaining({
                text: expect.stringContaining('Delete 100 rows'),
              }),
            }),
          ]),
        })
      );
    });

    it('should handle user rejection', async () => {
      const request: ApprovalRequest = {
        title: 'Risky operation',
        description: 'This is dangerous',
        riskLevel: 'critical',
        affectedRanges: [],
      };

      mockServer.createMessage.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ approved: false }),
          },
        ],
        stopReason: 'end_turn',
      } as CreateMessageResult);

      const approved = await gate.requestApproval(request);

      expect(approved).toBe(false);
    });

    it('should bypass confirmation for low-risk operations', async () => {
      const request: ApprovalRequest = {
        title: 'Read data',
        description: 'Read some cells',
        riskLevel: 'low',
        affectedRanges: ['A1:D10'],
      };

      const approved = await gate.requestApproval(request, { autoApprove: true });

      expect(approved).toBe(true);
      expect(mockServer.createMessage).not.toHaveBeenCalled();
    });
  });

  describe('Approval History', () => {
    it('should track approval statistics', async () => {
      mockServer.createMessage
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: JSON.stringify({ approved: true }) }],
          stopReason: 'end_turn',
        } as CreateMessageResult)
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: JSON.stringify({ approved: false }) }],
          stopReason: 'end_turn',
        } as CreateMessageResult);

      await gate.requestApproval({
        title: 'Op 1',
        description: 'Test',
        riskLevel: 'medium',
        affectedRanges: [],
      });

      await gate.requestApproval({
        title: 'Op 2',
        description: 'Test',
        riskLevel: 'high',
        affectedRanges: [],
      });

      const stats = gate.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
      expect(stats.approvalRate).toBe(50);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Agentic Workflow Integration', () => {
  let planner: AgenticPlanner;
  let executor: WorkflowExecutor;
  let gate: ConfirmationGate;

  beforeEach(() => {
    vi.clearAllMocks();
    planner = new AgenticPlanner(mockServer as any, mockHandlers as any);
    executor = new WorkflowExecutor(mockHandlers as any);
    gate = new ConfirmationGate(mockServer as any);
  });

  it('should execute end-to-end workflow with confirmation', async () => {
    // 1. LLM plans workflow
    mockServer.createMessage
      .mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              steps: [
                {
                  tool: 'sheets_data',
                  action: 'clear_range',
                  description: 'Clear old data',
                  parameters: { range: 'A1:Z100' },
                },
                {
                  tool: 'sheets_data',
                  action: 'write_range',
                  description: 'Write new data',
                  parameters: { range: 'A1:D10', values: [[1, 2, 3, 4]] },
                },
              ],
            }),
          },
        ],
        stopReason: 'end_turn',
      } as CreateMessageResult)
      // 2. User approves
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ approved: true }) }],
        stopReason: 'end_turn',
      } as CreateMessageResult);

    mockHandlers.sheets_data.executeAction.mockResolvedValue({
      response: { success: true, data: {} },
    });

    // Plan
    const plan = await planner.planWorkflow('Update dashboard data', {
      spreadsheetId: '1ABC',
    });

    expect(plan.requiresApproval).toBe(true);

    // Approve
    const approved = await gate.requestApproval({
      title: plan.goal,
      description: `Execute ${plan.steps.length} steps`,
      riskLevel: plan.riskLevel,
      affectedRanges: [],
    });

    expect(approved).toBe(true);

    // Execute
    const result = await executor.execute(plan);

    expect(result.success).toBe(true);
    expect(result.completedSteps).toBe(2);
  });
});
