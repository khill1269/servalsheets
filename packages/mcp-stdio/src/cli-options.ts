export interface CliTransportOptions {
  serviceAccountKeyPath?: string;
  accessToken?: string;
  transport: 'stdio' | 'http';
  port?: number;
}

export type ParsedCliCommand =
  | { kind: 'init' }
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'run'; options: CliTransportOptions };

export function parseCliCommand(args: readonly string[]): ParsedCliCommand {
  if (args[0] === 'init') {
    return { kind: 'init' };
  }

  const options: CliTransportOptions = {
    transport: 'stdio',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const nextArg = args[index + 1];

    if (arg === '--service-account' && nextArg) {
      options.serviceAccountKeyPath = nextArg;
      index += 1;
      continue;
    }

    if (arg === '--access-token' && nextArg) {
      options.accessToken = nextArg;
      index += 1;
      continue;
    }

    if (arg === '--stdio') {
      options.transport = 'stdio';
      continue;
    }

    if (arg === '--http') {
      options.transport = 'http';
      continue;
    }

    if (arg === '--port' && nextArg) {
      options.port = parseInt(nextArg, 10);
      index += 1;
      continue;
    }

    if (arg === '--version' || arg === '-v') {
      return { kind: 'version' };
    }

    if (arg === '--help' || arg === '-h') {
      return { kind: 'help' };
    }
  }

  return { kind: 'run', options };
}
