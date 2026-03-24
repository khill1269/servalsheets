export interface HandlerAuthSource {
  readonly hasElevatedAccess?: boolean;
  readonly scopes?: string[];
}

export interface HandlerAuthContext {
  readonly hasElevatedAccess: boolean;
  readonly scopes: string[];
}

export function createHandlerAuthContext(
  getSource: () => HandlerAuthSource | null | undefined
): HandlerAuthContext {
  return {
    get hasElevatedAccess() {
      return getSource()?.hasElevatedAccess ?? false;
    },
    get scopes() {
      return getSource()?.scopes ?? [];
    },
  };
}
