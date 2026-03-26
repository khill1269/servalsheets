import type { CliTransportOptions, ParsedCliCommand } from './command-parsing.js';

export function getCliHelpText(): string {
  return `
ServalSheets - Google Sheets MCP Server

Usage:
  servalsheets [command] [options]

Commands:
  init                      Interactive setup wizard (OAuth + .env configuration)

Transport Options:
  --stdio                   Use STDIO transport (default)
  --http                    Use HTTP transport
  --port <port>             Port for HTTP server (default: 3000)

Authentication Options:
  --service-account <path>  Path to service account key JSON file
  --access-token <token>    OAuth2 access token

Other Options:
  --version, -v             Show version
  --help, -h                Show this help message

Environment Variables:
  GOOGLE_APPLICATION_CREDENTIALS  Path to service account key
  GOOGLE_ACCESS_TOKEN             OAuth2 access token
  GOOGLE_CLIENT_ID                OAuth2 client ID
  GOOGLE_CLIENT_SECRET            OAuth2 client secret
  GOOGLE_TOKEN_STORE_PATH         Encrypted token store file path
  ENCRYPTION_KEY                  Token store encryption key (64-char hex)
  PORT                            HTTP server port (default: 3000)

Examples:
  # STDIO transport (for Claude Desktop)
  servalsheets --stdio

  # HTTP transport
  servalsheets --http --port 8080

  # Using service account
  servalsheets --service-account ./credentials.json

  # Using access token
  servalsheets --access-token ya29.xxx

  # Using environment variables
  export GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
  servalsheets
`;
}

export interface DispatchCliCommandDependencies {
  readonly runAuthSetup: () => Promise<void>;
  readonly loadPackageVersion: () => Promise<string>;
  readonly versionFallback: string;
  readonly output: {
    log: (message: string) => void;
  };
  readonly exit: (code: number) => void;
}

export async function dispatchCliCommand(
  command: ParsedCliCommand,
  dependencies: DispatchCliCommandDependencies
): Promise<
  | { kind: 'handled' }
  | {
      kind: 'run';
      cliOptions: CliTransportOptions;
    }
> {
  if (command.kind === 'init') {
    await dependencies.runAuthSetup();
    dependencies.exit(0);
    return { kind: 'handled' };
  }

  if (command.kind === 'version') {
    const version = await dependencies
      .loadPackageVersion()
      .catch(() => dependencies.versionFallback);
    dependencies.output.log(`servalsheets v${version}`);
    dependencies.exit(0);
    return { kind: 'handled' };
  }

  if (command.kind === 'help') {
    dependencies.output.log(getCliHelpText());
    dependencies.exit(0);
    return { kind: 'handled' };
  }

  return {
    kind: 'run',
    cliOptions: command.options,
  };
}
