/**
 * ServalSheets - Federation Handler
 *
 * Handles federation operations for calling external MCP servers.
 * Enables composite workflows by integrating with other MCP servers.
 *
 * @category Handlers
 * @module handlers/federation
 */

import type {
  SheetsFederationInput,
  SheetsFederationOutput,
  FederationAction,
} from '../schemas/federation.js';
import { unwrapRequest } from './base.js';
import { getFederationClient } from '../services/federated-mcp-client.js';
import { ValidationError } from '../core/errors.js';
import { getFederationConfig } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { parseFederationServers } from '../config/federation-config.js';
import { sendProgress } from '../utils/request-context.js';

/**
 * Federation Handler
 *
 * Manages calls to external MCP servers for composite workflows.
 * Supports HTTP and STDIO transports with circuit breaker protection.
 */
export class FederationHandler {
  private taskStore?: import('../core/task-store-adapter.js').TaskStoreAdapter;

  constructor(taskStore?: import('../core/task-store-adapter.js').TaskStoreAdapter) {
    this.taskStore = taskStore;
  }

  /**
   * Handle federation requests
   */
  async handle(input: SheetsFederationInput): Promise<SheetsFederationOutput> {
    const req = unwrapRequest<SheetsFederationInput['request']>(input);
    const { action, serverName, toolName, toolInput } = req;

    logger.info('Federation request', {
      component: 'federation-handler',
      action,
      serverName,
      toolName,
    });

    // Check if federation is enabled
    const config = getFederationConfig();
    if (!config.enabled) {
      return {
        response: {
          success: false,
          action,
          error:
            'Federation is not enabled. Set MCP_FEDERATION_ENABLED=true in your environment configuration.',
        },
      };
    }

    // Parse server configurations
    const servers = parseFederationServers(config.serversJson);
    if (servers.length === 0 && action !== 'list_servers') {
      return {
        response: {
          success: false,
          action,
          error:
            'No federation servers configured. Set MCP_FEDERATION_SERVERS with JSON server array.',
        },
      };
    }

    try {
      // Get or create federation client
      const client = await getFederationClient(servers);

      // Route to appropriate action handler
      switch (action) {
        case 'call_remote':
          return await this.handleCallRemote(client, serverName, toolName, toolInput, action);

        case 'list_servers':
          return await this.handleListServers(client, servers, action);

        case 'get_server_tools':
          return await this.handleGetServerTools(client, serverName, action);

        case 'validate_connection':
          return await this.handleValidateConnection(client, serverName, action);

        default: {
          const _exhaustiveCheck: never = action;
          throw new ValidationError(
            `Unknown federation action: ${String(_exhaustiveCheck)}`,
            'federation'
          );
        }
      }
    } catch (error) {
      const err = error as Error;
      logger.error('Federation handler error', {
        component: 'federation-handler',
        action,
        error: err.message,
        stack: err.stack,
      });

      return {
        response: {
          success: false,
          action,
          error:
            'Remote MCP server returned an error. Check server connectivity and configuration.',
        },
      };
    }
  }

  /**
   * MCP SEP-1686: Create a task entry for a federation operation.
   * Returns the taskId string, or undefined if taskStore is not available.
   */
  private async createFederationTask(
    actionName: string,
    req: Record<string, unknown>
  ): Promise<string | undefined> {
    if (!this.taskStore) {
      return undefined; // graceful degradation — no task store configured
    }
    const task = await this.taskStore.createTask(
      { ttl: 3600000 }, // 1 hour TTL
      `federation-${actionName}`,
      {
        method: 'tools/call',
        params: { name: 'sheets_federation', arguments: req },
      }
    );
    logger.info('Task created for federation action', {
      component: 'federation-handler',
      action: actionName,
      taskId: task.taskId,
    });
    return task.taskId;
  }

  /**
   * Handle call_remote action
   */
  private async handleCallRemote(
    client: Awaited<ReturnType<typeof getFederationClient>>,
    serverName: string | undefined,
    toolName: string | undefined,
    toolInput: Record<string, unknown> | undefined,
    _action: FederationAction
  ): Promise<SheetsFederationOutput> {
    if (!serverName) {
      throw new ValidationError('Missing required parameter: serverName', 'federation');
    }

    if (!toolName) {
      throw new ValidationError('Missing required parameter: toolName', 'federation');
    }

    logger.info('Calling remote MCP tool', {
      component: 'federation-handler',
      serverName,
      toolName,
      hasInput: !!toolInput,
    });

    await sendProgress(0, 100, `Connecting to remote server: ${serverName}...`);
    const result = await client.callRemoteTool(serverName, toolName, toolInput || {});
    await sendProgress(100, 100, 'Remote call complete');

    logger.info('Remote tool call succeeded', {
      component: 'federation-handler',
      serverName,
      toolName,
    });

    const taskId = await this.createFederationTask('call-remote', {
      serverName,
      toolName,
      toolInput,
    });

    return {
      response: {
        success: true,
        action: 'call_remote',
        remoteServer: serverName,
        data: result,
        ...(taskId !== undefined ? { taskId } : {}),
      },
    };
  }

  /**
   * Handle list_servers action
   */
  private async handleListServers(
    client: Awaited<ReturnType<typeof getFederationClient>>,
    servers: Array<{ name: string; url: string }>,
    _action: FederationAction
  ): Promise<SheetsFederationOutput> {
    const serverList = servers.map((s) => ({
      name: s.name,
      url: s.url,
      connected: client.isConnected(s.name),
    }));

    logger.debug('Listing federation servers', {
      component: 'federation-handler',
      serverCount: serverList.length,
    });

    const taskId = await this.createFederationTask('list-servers', {});

    return {
      response: {
        success: true,
        action: 'list_servers',
        servers: serverList,
        ...(taskId !== undefined ? { taskId } : {}),
      },
    };
  }

  /**
   * Handle get_server_tools action
   */
  private async handleGetServerTools(
    client: Awaited<ReturnType<typeof getFederationClient>>,
    serverName: string | undefined,
    _action: FederationAction
  ): Promise<SheetsFederationOutput> {
    if (!serverName) {
      throw new ValidationError('Missing required parameter: serverName', 'federation');
    }

    logger.info('Getting remote server tools', {
      component: 'federation-handler',
      serverName,
    });

    const tools = await client.listRemoteTools(serverName);

    logger.info('Retrieved remote server tools', {
      component: 'federation-handler',
      serverName,
      toolCount: tools.length,
    });

    const taskId = await this.createFederationTask('get-server-tools', { serverName });

    return {
      response: {
        success: true,
        action: 'get_server_tools',
        remoteServer: serverName,
        tools: tools as Array<{
          name: string;
          description?: string;
          inputSchema?: Record<string, unknown>;
        }>,
        ...(taskId !== undefined ? { taskId } : {}),
      },
    };
  }

  /**
   * Handle validate_connection action
   */
  private async handleValidateConnection(
    client: Awaited<ReturnType<typeof getFederationClient>>,
    serverName: string | undefined,
    _action: FederationAction
  ): Promise<SheetsFederationOutput> {
    if (!serverName) {
      throw new ValidationError('Missing required parameter: serverName', 'federation');
    }

    logger.info('Validating connection to remote server', {
      component: 'federation-handler',
      serverName,
    });

    try {
      // Try to list tools as a connection test
      await client.listRemoteTools(serverName);

      logger.info('Connection validation succeeded', {
        component: 'federation-handler',
        serverName,
      });

      const taskId = await this.createFederationTask('validate-connection', { serverName });

      return {
        response: {
          success: true,
          action: 'validate_connection',
          remoteServer: serverName,
          data: { connected: true },
          ...(taskId !== undefined ? { taskId } : {}),
        },
      };
    } catch (error) {
      const err = error as Error;
      logger.warn('Connection validation failed', {
        component: 'federation-handler',
        serverName,
        error: err.message,
      });

      return {
        response: {
          success: false,
          action: 'validate_connection',
          remoteServer: serverName,
          error:
            'Connection validation failed. The remote server may be unavailable or unreachable.',
        },
      };
    }
  }
}
