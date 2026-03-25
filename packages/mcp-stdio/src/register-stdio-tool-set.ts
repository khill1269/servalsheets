import type { ToolTaskHandler, TaskToolExecution } from '@modelcontextprotocol/sdk/experimental/tasks/interfaces.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type {
  CallToolResult,
  Icon,
  ServerNotification,
  ToolAnnotations,
  ToolExecution,
} from '@modelcontextprotocol/sdk/types.js';

export interface StdioToolDefinitionLike {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: unknown;
  readonly outputSchema: unknown;
  readonly annotations: ToolAnnotations;
}

export interface RegisterStdioToolSetDependencies<
  TTool extends StdioToolDefinitionLike = StdioToolDefinitionLike,
> {
  readonly createTaskHandler: (toolName: string) => ToolTaskHandler<AnySchema>;
  readonly handleToolCall: (
    toolName: string,
    args: Record<string, unknown>,
    extra?: {
      sendNotification?: (notification: ServerNotification) => Promise<void>;
      sendRequest?: unknown;
      taskId?: string;
      taskStore?: unknown;
      progressToken?: string | number;
      elicit?: unknown;
      sample?: unknown;
      abortSignal?: AbortSignal;
      headers?: Record<string, string | string[] | undefined>;
      traceId?: string;
      spanId?: string;
      parentSpanId?: string;
    }
  ) => Promise<CallToolResult>;
  readonly getToolIcons: (toolName: string) => Icon[] | undefined;
  readonly getToolExecution: (toolName: string) => ToolExecution | undefined;
  readonly registerTaskTool: (
    name: string,
    config: {
      title?: string;
      description?: string;
      inputSchema: AnySchema;
      outputSchema?: AnySchema;
      annotations?: ToolAnnotations;
      execution?: TaskToolExecution;
    },
    handler: ToolTaskHandler<AnySchema>
  ) => void;
  readonly registerTool: (
    name: string,
    config: {
      title?: string;
      description?: string;
      inputSchema?: unknown;
      outputSchema?: unknown;
      annotations?: ToolAnnotations;
      icons?: Icon[];
      execution?: ToolExecution;
    },
    handler: (args: Record<string, unknown>, extra: unknown) => Promise<CallToolResult>
  ) => void;
}

export function registerStdioToolSet<TTool extends StdioToolDefinitionLike>(
  tools: readonly TTool[],
  dependencies: RegisterStdioToolSetDependencies<TTool>
): void {
  for (const tool of tools) {
    const inputSchemaForRegistration = tool.inputSchema as AnySchema;
    const outputSchemaForRegistration = tool.outputSchema as AnySchema;
    const toolIcons = dependencies.getToolIcons(tool.name);
    const toolExecution = dependencies.getToolExecution(tool.name);
    const supportsTasks = toolExecution?.taskSupport && toolExecution.taskSupport !== 'forbidden';

    if (supportsTasks) {
      const taskHandler = dependencies.createTaskHandler(tool.name);
      const taskSupport = toolExecution?.taskSupport === 'required' ? 'required' : 'optional';
      const taskExecution = {
        ...(toolExecution ?? {}),
        taskSupport,
      } as TaskToolExecution;

      dependencies.registerTaskTool(
        tool.name,
        {
          title: tool.annotations.title,
          description: tool.description,
          inputSchema: inputSchemaForRegistration,
          outputSchema: outputSchemaForRegistration,
          annotations: tool.annotations,
          execution: taskExecution,
        },
        taskHandler
      );
      continue;
    }

    dependencies.registerTool(
      tool.name,
      {
        title: tool.annotations.title,
        description: tool.description,
        inputSchema: inputSchemaForRegistration,
        outputSchema: outputSchemaForRegistration,
        annotations: tool.annotations,
        icons: toolIcons,
        execution: toolExecution,
      },
      async (args, extra) => {
        const requestExtra = extra as {
          _meta?: { progressToken?: string | number };
          sendNotification?: (notification: ServerNotification) => Promise<void>;
          sendRequest?: unknown;
          taskId?: string;
          taskStore?: unknown;
          elicit?: unknown;
          sample?: unknown;
          signal?: AbortSignal;
          headers?: Record<string, string | string[] | undefined>;
          traceId?: string;
          spanId?: string;
          parentSpanId?: string;
        };

        return dependencies.handleToolCall(tool.name, args, {
          ...requestExtra,
          sendNotification: requestExtra.sendNotification,
          progressToken: requestExtra._meta?.progressToken,
          abortSignal: requestExtra.signal,
        });
      }
    );
  }
}
