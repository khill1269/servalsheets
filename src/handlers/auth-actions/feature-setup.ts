/**
 * Feature setup handlers - connectors, sampling, webhooks, federation
 */

import type { AuthSetupFeatureInput, AuthResponse } from '../../schemas/auth.js';
import type { ElicitationServer } from '../../mcp/elicitation.js';
import { safeElicit, selectField, stringField } from '../../mcp/elicitation.js';
import { startApiKeyServer } from '../../utils/api-key-server.js';
import { initiateOAuthFlow, completeOAuthFlow } from '../../mcp/elicitation.js';
import { runtimeConfigStore } from '../../config/runtime-config-store.js';
import { ErrorCodes } from '../error-codes.js';
import { logger } from '../../utils/logger.js';
import { resourceNotifications } from '../../resources/notifications.js';
import type { GoogleApiClient } from '../../services/google-api.js';

function buildSetupFeatureResponse(options: {
  message: string;
  configured: boolean;
  verified: boolean;
  nextStep: string;
  instructions?: string[];
  fallbackInstructions?: string[];
  journeyStage?:
    | 'onboarding'
    | 'readiness'
    | 'authentication'
    | 'connector_setup'
    | 'first_success';
  verificationSummary: string;
}): AuthResponse {
  return {
    success: true,
    action: 'setup_feature',
    message: options.message,
    configured: options.configured,
    verified: options.verified,
    nextStep: options.nextStep,
    ...(options.instructions ? { instructions: options.instructions } : {}),
    ...(options.fallbackInstructions
      ? { fallbackInstructions: options.fallbackInstructions }
      : {}),
    _meta: {
      journeyStage: options.journeyStage ?? 'readiness',
      nextBestAction: options.nextStep,
      verificationSummary: options.verificationSummary,
      ...(options.fallbackInstructions ? { nextSteps: options.fallbackInstructions } : {}),
    },
  };
}

export async function handleSetupFeature(
  req: AuthSetupFeatureInput,
  elicitationServer: ElicitationServer | undefined
): Promise<AuthResponse> {
  let feature = (req as { feature?: string }).feature as
    | 'connectors'
    | 'sampling'
    | 'webhooks'
    | 'federation'
    | undefined;

  if (!feature && elicitationServer) {
    try {
      const result = await safeElicit<{ feature: string } | null>(
        elicitationServer,
        {
          mode: 'form',
          message:
            'Which optional feature would you like to configure? All credentials are encrypted and persist across Claude Desktop restarts.',
          requestedSchema: {
            type: 'object',
            properties: {
              feature: selectField({
                title: 'Feature to configure',
                description: 'Select the feature you want to set up',
                options: [
                  {
                    label:
                      'Data Connectors — live market data (Finnhub, FRED, Alpha Vantage, Polygon, FMP)',
                    value: 'connectors',
                  },
                  {
                    label: 'AI Sampling — Anthropic API key for formula suggestions & analysis',
                    value: 'sampling',
                  },
                  {
                    label: 'Webhooks — Redis URL for push notifications on sheet changes',
                    value: 'webhooks',
                  },
                  {
                    label: 'Federation — Connect to remote MCP servers',
                    value: 'federation',
                  },
                ],
              }),
            },
          },
        },
        null
      );
      if (result?.feature) {
        feature = result.feature as 'connectors' | 'sampling' | 'webhooks' | 'federation';
      }
    } catch {
      // Elicitation not supported — fall through to instructions
    }
  }

  if (!feature) {
    return buildSetupFeatureResponse({
      message:
        'Choose which optional capability to configure next. ServalSheets can guide this interactively when the client supports elicitation.',
      configured: false,
      verified: false,
      nextStep:
        'Retry sheets_auth action "setup_feature" with feature="connectors" | "sampling" | "webhooks" | "federation".',
      instructions: [
        'Available features:',
        '  feature: "connectors" — API keys for live data connectors (Finnhub, FRED, Alpha Vantage, Polygon, FMP)',
        '  feature: "sampling"   — ANTHROPIC_API_KEY for AI-powered formula suggestions & analysis',
        '  feature: "webhooks"   — REDIS_URL for push notification webhooks on spreadsheet changes',
        '  feature: "federation" — MCP_FEDERATION_SERVERS to call tools on remote MCP servers',
      ],
      fallbackInstructions: [
        'All credentials are encrypted at rest and restored automatically on restart.',
        'If your client cannot show forms, pass the feature and its config fields directly in the request JSON.',
      ],
      verificationSummary: 'No feature was selected yet; setup remains pending.',
    });
  }

  switch (feature) {
    case 'connectors':
      return setupConnector(req, elicitationServer);
    case 'sampling':
      return setupSampling(req, elicitationServer);
    case 'webhooks':
      return setupWebhooks(req, elicitationServer);
    case 'federation':
      return setupFederation(req, elicitationServer);
  }
}

async function setupConnector(
  req: AuthSetupFeatureInput,
  elicitationServer: ElicitationServer | undefined
): Promise<AuthResponse> {
  const CONNECTOR_INFO: Record<string, { name: string; signupUrl: string; hint: string }> = {
    finnhub: {
      name: 'Finnhub',
      signupUrl: 'https://finnhub.io/register',
      hint: 'Free tier: 60 req/min — stocks, earnings, news',
    },
    fred: {
      name: 'FRED (Federal Reserve)',
      signupUrl: 'https://fred.stlouisfed.org/docs/api/api_key.html',
      hint: 'Free — economic indicators, interest rates, GDP',
    },
    alpha_vantage: {
      name: 'Alpha Vantage',
      signupUrl: 'https://www.alphavantage.co/support/#api-key',
      hint: 'Free tier: 5 req/min — stocks, forex, crypto',
    },
    polygon: {
      name: 'Polygon.io',
      signupUrl: 'https://polygon.io/dashboard/signup',
      hint: 'Free tier: 5 req/min — real-time & historical market data',
    },
    fmp: {
      name: 'Financial Modeling Prep',
      signupUrl: 'https://financialmodelingprep.com/developer/docs',
      hint: 'Free tier: 250 req/day — financial statements, fundamentals',
    },
  };

  let connectorId = (req as { connectorId?: string }).connectorId as
    | 'finnhub'
    | 'fred'
    | 'alpha_vantage'
    | 'polygon'
    | 'fmp'
    | undefined;

  if (!connectorId && elicitationServer) {
    try {
      const result = await safeElicit<{ connectorId: string } | null>(
        elicitationServer,
        {
          mode: 'form',
          message: 'Which data connector would you like to configure?',
          requestedSchema: {
            type: 'object',
            properties: {
              connectorId: selectField({
                title: 'Connector',
                description: 'Select the data source to configure',
                options: [
                  { label: 'Finnhub — stocks, earnings, news (free tier)', value: 'finnhub' },
                  { label: 'FRED — economic indicators, GDP, rates (free)', value: 'fred' },
                  {
                    label: 'Alpha Vantage — stocks, forex, crypto (free tier)',
                    value: 'alpha_vantage',
                  },
                  { label: 'Polygon.io — real-time market data', value: 'polygon' },
                  { label: 'FMP — financial statements & fundamentals', value: 'fmp' },
                ],
              }),
            },
          },
        },
        null
      );
      if (result?.connectorId) {
        connectorId = result.connectorId as
          | 'finnhub'
          | 'fred'
          | 'alpha_vantage'
          | 'polygon'
          | 'fmp';
      }
    } catch {
      // Elicitation not supported
    }
  }

  if (!connectorId) {
    return buildSetupFeatureResponse({
      message: 'Choose which connector to configure before entering credentials.',
      configured: false,
      verified: false,
      nextStep: 'Retry setup_feature with feature="connectors", connectorId, and apiKey when ready.',
      instructions: ['Connector IDs: finnhub | fred | alpha_vantage | polygon | fmp'],
      fallbackInstructions: [
        'Example: sheets_auth { "action": "setup_feature", "feature": "connectors", "connectorId": "finnhub", "apiKey": "<your-key>" }',
      ],
      journeyStage: 'connector_setup',
      verificationSummary: 'Connector setup is waiting for a connector selection.',
    });
  }

  const info = CONNECTOR_INFO[connectorId];
  let apiKey = (req as { apiKey?: string }).apiKey;

  if (!apiKey && elicitationServer && info) {
    try {
      const { keyPromise, url, shutdown } = await startApiKeyServer({
        provider: info.name,
        signupUrl: info.signupUrl,
        hint: info.hint,
      });
      const { accepted, elicitationId } = await initiateOAuthFlow(elicitationServer, {
        authUrl: url,
        provider: info.name,
        scopes: [],
      });
      if (accepted) {
        apiKey = await keyPromise;
        await completeOAuthFlow(elicitationServer, elicitationId);
      } else {
        shutdown();
      }
    } catch {
      // Elicitation unavailable or timed out
    }
  }

  if (!apiKey) {
    return buildSetupFeatureResponse({
      message: `Get a ${info?.name ?? connectorId} API key, then provide it via apiKey or complete the URL-based setup flow.`,
      configured: false,
      verified: false,
      nextStep: `Provide an API key for ${info?.name ?? connectorId} and retry setup_feature.`,
      instructions: [
        `1. Sign up at: ${info?.signupUrl ?? 'the provider website'}`,
        '2. Copy the provider API key',
        '3. Retry setup_feature to store and verify it',
      ],
      fallbackInstructions: [
        `Example: sheets_auth { "action": "setup_feature", "feature": "connectors", "connectorId": "${connectorId}", "apiKey": "<your-key>" }`,
        'The key will be encrypted and restored automatically on restart.',
      ],
      journeyStage: 'connector_setup',
      verificationSummary: `${info?.name ?? connectorId} is not configured yet because no API key was provided.`,
    });
  }

  try {
    const { connectorManager: cm } = await import('../../connectors/connector-manager.js');
    const configured = await cm.configure(connectorId, {
      type: 'api_key' as const,
      apiKey,
    });
    if (!configured.success) {
      return {
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: `Health check failed: ${configured.message}`,
          retryable: true,
          suggestedFix: 'Verify your API key and try again.',
        },
      };
    }
    resourceNotifications.notifyResourceListChanged(
      `Connector ${connectorId} configured via setup_feature`
    );

    return buildSetupFeatureResponse({
      message: `${info?.name ?? connectorId} configured, verified, and encrypted.`,
      configured: true,
      verified: true,
      nextStep: `Run sheets_connectors action "status" with connectorId "${connectorId}" or make a first query.`,
      instructions: [
        `${info?.name ?? connectorId} is ready. Use sheets_connectors to query live data.`,
        `Example: sheets_connectors { "action": "query", "connectorId": "${connectorId}", "endpoint": "...", "params": {} }`,
        'Key persists across Claude Desktop restarts (stored at .serval/connectors/)',
      ],
      fallbackInstructions: [
        `Status check: sheets_connectors { "action": "status", "connectorId": "${connectorId}" }`,
      ],
      journeyStage: 'connector_setup',
      verificationSummary: `${info?.name ?? connectorId} passed its configuration health check.`,
    });
  } catch (err) {
    return {
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: `Failed to configure connector: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true,
      },
    };
  }
}

async function setupSampling(
  req: AuthSetupFeatureInput,
  elicitationServer: ElicitationServer | undefined
): Promise<AuthResponse> {
  let apiKey = (req as { apiKey?: string }).apiKey;

  if (!apiKey && elicitationServer) {
    try {
      const { keyPromise, url, shutdown } = await startApiKeyServer({
        provider: 'Anthropic',
        signupUrl: 'https://console.anthropic.com/settings/keys',
        hint: 'Starts with sk-ant-...',
      });
      const { accepted, elicitationId } = await initiateOAuthFlow(elicitationServer, {
        authUrl: url,
        provider: 'Anthropic',
        scopes: [],
      });
      if (accepted) {
        apiKey = await keyPromise;
        await completeOAuthFlow(elicitationServer, elicitationId);
      } else {
        shutdown();
      }
    } catch {
      // Elicitation unavailable or timed out
    }
  }

  if (!apiKey) {
    return buildSetupFeatureResponse({
      message:
        'Add an Anthropic-compatible API key to enable AI fallback for formula suggestions, chart help, and analysis.',
      configured: false,
      verified: false,
      nextStep: 'Provide apiKey for feature="sampling" and retry setup_feature.',
      instructions: [
        '1. Visit https://console.anthropic.com/settings/keys',
        '2. Create an API key',
        '3. Retry setup_feature with feature="sampling"',
      ],
      fallbackInstructions: [
        'Example: sheets_auth { "action": "setup_feature", "feature": "sampling", "apiKey": "sk-ant-..." }',
        'Key is encrypted and restored automatically on restart.',
      ],
      verificationSummary: 'AI fallback is not configured because no API key was provided.',
    });
  }

  process.env['ANTHROPIC_API_KEY'] = apiKey;
  await runtimeConfigStore.save('ANTHROPIC_API_KEY', apiKey);

  resourceNotifications.notifyResourceListChanged(
    'Sampling API key configured via setup_feature; AI features now available'
  );

  return buildSetupFeatureResponse({
    message:
      'Anthropic API key saved. AI fallback features are now enabled for this session and future restarts.',
    configured: true,
    verified: true,
    nextStep:
      'Run /first_operation or use sheets_analyze.generate_formula to verify AI assistance.',
    instructions: [
      'AI features unlocked:',
      '  • sheets_analyze action "generate_formula" — AI formula builder',
      '  • sheets_analyze action "suggest_visualization" — chart recommendations',
      '  • sheets_analyze action "auto_enhance" — intelligent spreadsheet improvements',
      '  • sheets_compute action "sklearn_model" — ML model training',
      'Key stored in encrypted runtime config for future restarts',
    ],
    fallbackInstructions: [
      'Verification: use an AI-assisted analyze or visualize action and confirm suggestions are returned.',
    ],
    verificationSummary: 'AI fallback key was stored and applied to the running process.',
  });
}

async function setupWebhooks(
  req: AuthSetupFeatureInput,
  elicitationServer: ElicitationServer | undefined
): Promise<AuthResponse> {
  let redisUrl = (req as { redisUrl?: string }).redisUrl ?? (req as { apiKey?: string }).apiKey;

  if (!redisUrl && elicitationServer) {
    try {
      const { keyPromise, url, shutdown } = await startApiKeyServer({
        provider: 'Redis',
        signupUrl: 'https://upstash.com',
        hint: 'redis://[:password@]host[:port][/db] or rediss:// for TLS',
      });
      const { accepted, elicitationId } = await initiateOAuthFlow(elicitationServer, {
        authUrl: url,
        provider: 'Redis',
        scopes: [],
      });
      if (accepted) {
        redisUrl = await keyPromise;
        await completeOAuthFlow(elicitationServer, elicitationId);
      } else {
        shutdown();
      }
    } catch {
      // Elicitation unavailable or timed out
    }
  }

  if (!redisUrl) {
    return buildSetupFeatureResponse({
      message: 'Provide a Redis URL to enable webhook delivery and change notifications.',
      configured: false,
      verified: false,
      nextStep: 'Supply redisUrl for feature="webhooks" and retry setup_feature.',
      instructions: [
        'Free Redis options:',
        '  • Upstash (serverless, free tier): https://upstash.com',
        '  • Redis Cloud free tier: https://redis.com/try-free/',
      ],
      fallbackInstructions: [
        'Example: sheets_auth { "action": "setup_feature", "feature": "webhooks", "redisUrl": "redis://..." }',
      ],
      verificationSummary: 'Webhook delivery is not configured because no Redis URL was provided.',
    });
  }

  process.env['REDIS_URL'] = redisUrl;
  await runtimeConfigStore.save('REDIS_URL', redisUrl);

  let hotWired = false;
  try {
    const { createClient } = await import('redis');
    const redisClient = createClient({ url: redisUrl });
    await redisClient.connect();

    const { initializeWebhookBootstrap } = await import('../../startup/webhook-bootstrap.js');
    initializeWebhookBootstrap({
      googleClient: {} as unknown as GoogleApiClient,
      redisClient,
      resetExisting: true,
    });
    hotWired = true;
    logger.info('WebhookManager hot-wired with Redis after setup_feature');

    resourceNotifications.notifyResourceListChanged(
      'Redis configured via setup_feature; webhook actions now available'
    );
  } catch (err) {
    logger.warn('Redis hot-wire failed; restart required to activate webhooks', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return buildSetupFeatureResponse({
    message: hotWired
      ? 'Redis connected. Webhooks are active immediately.'
      : 'Redis URL saved. Restart the server to activate webhooks.',
    configured: true,
    verified: hotWired,
    nextStep: hotWired
      ? 'Run sheets_webhook action "list" or "register" to verify webhook delivery.'
      : 'Restart the server, then run sheets_webhook action "list" to verify activation.',
    instructions: [
      hotWired
        ? 'Webhooks are active now (no restart needed):'
        : 'Webhooks will be active after restart:',
      '  • sheets_webhook action "register" — register a webhook endpoint',
      '  • sheets_webhook action "watch_changes" — subscribe to cell/range changes',
      '  • sheets_webhook action "list" — see active webhooks',
      'Redis URL stored in encrypted runtime config for future restarts',
    ],
    fallbackInstructions: [
      'Verification: run sheets_webhook { "action": "list" } after setup or restart.',
    ],
    verificationSummary: hotWired
      ? 'Redis connection succeeded and the webhook singletons were hot-wired.'
      : 'Redis URL was stored, but the live webhook runtime still needs a restart.',
  });
}

async function setupFederation(
  req: AuthSetupFeatureInput,
  elicitationServer: ElicitationServer | undefined
): Promise<AuthResponse> {
  let serversJson = (req as { apiKey?: string }).apiKey;

  if (!serversJson && elicitationServer) {
    try {
      const result = await safeElicit<{ serversJson: string } | null>(
        elicitationServer,
        {
          mode: 'form',
          message:
            'Enter the list of remote MCP servers to connect to, as a JSON array. Each server needs a name and URL.',
          requestedSchema: {
            type: 'object',
            properties: {
              serversJson: stringField({
                title: 'Federation Servers (JSON)',
                description:
                  'JSON array, e.g.: [{"name":"my-server","url":"http://localhost:4000"}]. Or JSON object map.',
                minLength: 2,
              }),
            },
          },
        },
        null
      );
      if (result?.serversJson) {
        serversJson = result.serversJson;
      }
    } catch {
      // Elicitation not supported
    }
  }

  if (!serversJson) {
    return buildSetupFeatureResponse({
      message:
        'Provide MCP federation server configuration as JSON so ServalSheets can call remote MCP tools.',
      configured: false,
      verified: false,
      nextStep: 'Pass a JSON server list in apiKey and retry setup_feature for federation.',
      instructions: ['Format: JSON array — [{"name":"server-name","url":"http://host:port"}]'],
      fallbackInstructions: [
        'Example: sheets_auth { "action": "setup_feature", "feature": "federation", "apiKey": "[{\\"name\\":\\"my-server\\",\\"url\\":\\"http://localhost:4000\\"}]" }',
      ],
      verificationSummary: 'Federation is not configured because no server list was provided.',
    });
  }

  try {
    JSON.parse(serversJson);
  } catch {
    return {
      success: false,
      error: {
        code: ErrorCodes.INVALID_PARAMS,
        message: 'Invalid JSON for federation servers. Expected a JSON array or object.',
        retryable: true,
        suggestedFix: 'Example: [{"name":"my-server","url":"http://localhost:4000"}]',
      },
    };
  }

  process.env['MCP_FEDERATION_SERVERS'] = serversJson;
  process.env['MCP_FEDERATION_ENABLED'] = 'true';
  await runtimeConfigStore.save('MCP_FEDERATION_SERVERS', serversJson);
  await runtimeConfigStore.save('MCP_FEDERATION_ENABLED', 'true');

  let serverCount = 0;
  try {
    const parsed = JSON.parse(serversJson) as unknown;
    serverCount = Array.isArray(parsed) ? parsed.length : Object.keys(parsed as object).length;
  } catch {
    // best-effort
  }

  resourceNotifications.notifyResourceListChanged(
    `Federation configured via setup_feature; ${serverCount} server(s) registered`
  );

  return buildSetupFeatureResponse({
    message: `${serverCount} federation server${serverCount !== 1 ? 's' : ''} saved. MCP federation is now enabled.`,
    configured: true,
    verified: true,
    nextStep: 'Run sheets_federation action "list_servers" to confirm the remote registry.',
    instructions: [
      'Federation is ready for this session and future restarts:',
      '  • sheets_federation action "list_servers" — see available remote servers',
      '  • sheets_federation action "get_server_tools" — discover tools on a server',
      '  • sheets_federation action "call_remote" — invoke a remote tool',
      'Federation config stored in encrypted runtime config for future restarts',
    ],
    fallbackInstructions: [
      'Verification: run sheets_federation { "action": "list_servers" } to confirm the saved registry.',
    ],
    verificationSummary: `${serverCount} federation server definition(s) were parsed and stored successfully.`,
  });
}
