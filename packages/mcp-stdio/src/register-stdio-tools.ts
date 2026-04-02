export interface RegisterStdioToolsDependencies<
  TTool extends { name: string } = { name: string },
> {
  readonly initializeStageManager: (registerNewTools: (tools: readonly TTool[]) => void) => void;
  readonly getInitialTools: () => readonly TTool[];
  readonly registerToolSet: (tools: readonly TTool[]) => void;
  readonly markRegistered: (toolNames: string[]) => void;
  readonly stagedRegistrationEnabled: boolean;
  readonly registerToolsListCompatibilityHandler: () => void;
  readonly registerFlatToolCallInterceptor: () => void;
  readonly enableToolsListChangedNotifications: boolean;
  readonly syncToolList: (
    toolNames: readonly string[],
    options: {
      emitOnFirstSet: boolean;
      reason: string;
    }
  ) => void;
  readonly log: {
    info(message: string, meta?: unknown): void;
  };
}

export function registerStdioTools<TTool extends { name: string }>(
  allTools: readonly TTool[],
  dependencies: RegisterStdioToolsDependencies<TTool>
): void {
  dependencies.initializeStageManager((newTools) => dependencies.registerToolSet(newTools));

  const initialTools = dependencies.getInitialTools();
  dependencies.registerToolSet(initialTools);
  dependencies.markRegistered(initialTools.map((tool) => tool.name));

  if (dependencies.stagedRegistrationEnabled) {
    dependencies.log.info('Staged tool registration enabled', {
      stage: 1,
      initialTools: initialTools.length,
      totalAvailable: allTools.length,
    });
  }

  dependencies.registerToolsListCompatibilityHandler();

  // In flat mode, intercept tools/call to rewrite flat tool names → compound names.
  // Must come after registerToolsListCompatibilityHandler (tools/list) and after
  // all compound tools are registered with the MCP server.
  dependencies.registerFlatToolCallInterceptor();

  if (dependencies.enableToolsListChangedNotifications) {
    dependencies.syncToolList(
      initialTools.map((tool) => tool.name),
      {
        emitOnFirstSet: false,
        reason: 'tool registration updated',
      }
    );
  }
}
