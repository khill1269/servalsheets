import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  createServalSheetsTestHarness,
  type McpTestHarness,
} from '../helpers/mcp-test-harness.js';

describe('MCP capability workflow integration', () => {
  let harness: McpTestHarness;

  beforeAll(async () => {
    harness = await createServalSheetsTestHarness({
      serverOptions: {
        name: 'servalsheets-capability-workflow-test',
        version: '1.0.0-test',
      },
      clientCapabilities: {
        tasks: {
          requests: {
            tools: { call: {} },
          },
        },
      },
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  it(
    'chains completions, resources, prompts, session context, and task execution',
    async () => {
      const toolNameCompletion = await harness.client.complete({
        ref: {
          type: 'ref/resource',
          uri: 'sheets://tools/{toolName}/actions/{action}',
        },
        argument: {
          name: 'toolName',
          value: 'sheets_hi',
        },
      });

      expect(toolNameCompletion.completion.values).toContain('sheets_history');

      const actionCompletion = await harness.client.complete({
        ref: {
          type: 'ref/resource',
          uri: 'sheets://tools/{toolName}/actions/{action}',
        },
        argument: {
          name: 'action',
          value: 'st',
        },
        context: {
          arguments: {
            toolName: 'sheets_history',
          },
        },
      });

      expect(actionCompletion.completion.values).toContain('stats');

      const resources = await harness.client.listResources();
      const masterIndex = resources.resources.find((resource) => resource.uri === 'servalsheets://index');

      expect(masterIndex).toBeDefined();

      const masterIndexContent = await harness.client.readResource({
        uri: 'servalsheets://index',
      });
      const masterIndexText = masterIndexContent.contents[0] && 'text' in masterIndexContent.contents[0]
        ? masterIndexContent.contents[0].text
        : '';

      expect(masterIndexText).toContain('sheets_history');
      expect(masterIndexText).toContain('servalsheets://patterns');

      const resourceTemplates = await harness.client.listResourceTemplates();
      expect(
        resourceTemplates.resourceTemplates.some(
          (template) => template.uriTemplate === 'sheets://tools/{toolName}/actions/{action}'
        )
      ).toBe(true);

      const prompts = await harness.client.listPrompts();
      expect(prompts.prompts.some((prompt) => prompt.name === 'welcome')).toBe(true);

      const welcomePrompt = await harness.client.getPrompt({
        name: 'welcome',
        arguments: {},
      });
      const welcomeText = welcomePrompt.messages[0]?.content.type === 'text'
        ? welcomePrompt.messages[0].content.text
        : '';

      expect(welcomeText).toContain('Welcome to ServalSheets');

      const spreadsheetIdMatch = welcomeText.match(/Test spreadsheet:\s*`?([A-Za-z0-9_-]+)`?/);
      const spreadsheetId = spreadsheetIdMatch?.[1] ?? '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

      const setActive = await harness.client.callTool({
        name: 'sheets_session',
        arguments: {
          request: {
            action: 'set_active',
            spreadsheetId,
            title: 'Prompt Workflow Spreadsheet',
            sheetNames: ['Sheet1'],
          },
        },
      });

      const setActiveStructured = setActive.structuredContent as {
        response?: {
          success?: boolean;
          action?: string;
          spreadsheet?: {
            spreadsheetId?: string;
            title?: string;
          };
        };
      };

      expect(setActiveStructured.response).toMatchObject({
        success: true,
        action: 'set_active',
        spreadsheet: {
          spreadsheetId,
          title: 'Prompt Workflow Spreadsheet',
        },
      });

      const contextResult = await harness.client.callTool({
        name: 'sheets_session',
        arguments: {
          request: {
            action: 'get_context',
          },
        },
      });

      const contextStructured = contextResult.structuredContent as {
        response?: {
          success?: boolean;
          action?: string;
          activeSpreadsheet?: {
            spreadsheetId?: string;
          };
        };
      };

      expect(contextStructured.response).toMatchObject({
        success: true,
        action: 'get_context',
        activeSpreadsheet: {
          spreadsheetId,
        },
      });

      const stream = harness.client.experimental.tasks.callToolStream(
        {
          name: 'sheets_history',
          arguments: {
            request: {
              action: 'stats',
            },
          },
        },
        CallToolResultSchema,
        {
          task: { ttl: 60_000 },
        }
      );

      const messageTypes: string[] = [];
      let taskId: string | undefined;
      let finalResult:
        | {
            structuredContent?: {
              response?: {
                success?: boolean;
                action?: string;
              };
            };
          }
        | undefined;

      for await (const message of stream) {
        messageTypes.push(message.type);

        if (message.type === 'taskCreated') {
          taskId = message.task.taskId;
        }

        if (message.type === 'result') {
          finalResult = message.result as typeof finalResult;
        }
      }

      expect(taskId).toBeDefined();
      expect(messageTypes).toContain('taskCreated');
      expect(messageTypes).toContain('result');
      expect(finalResult?.structuredContent?.response).toMatchObject({
        success: true,
        action: 'stats',
      });

      const task = await harness.client.experimental.tasks.getTask(taskId!);
      expect(task.status).toBe('completed');

      const taskResult = await harness.client.experimental.tasks.getTaskResult(
        taskId!,
        CallToolResultSchema
      );
      const taskStructured = taskResult.structuredContent as
        | {
            response?: {
              success?: boolean;
              action?: string;
            };
          }
        | undefined;

      expect(taskStructured?.response).toMatchObject({
        success: true,
        action: 'stats',
      });
    },
    30_000
  );
});
