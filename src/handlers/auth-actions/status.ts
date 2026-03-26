/**
 * Status action handler - reports authentication readiness and system configuration
 */

import type { GoogleApiClient } from '../../services/google-api.js';
import type { AuthResponse } from '../../schemas/auth.js';
import { connectorManager } from '../../resources/connectors-runtime.js';
import { isLLMFallbackAvailable } from '../../services/llm-fallback.js';
import { ErrorCodes } from '../error-codes.js';
import { checkElicitationSupport } from '../../mcp/elicitation.js';

type ReadinessSummary = {
  googleAuth: {
    configured: boolean;
    authenticated: boolean;
    authType?: string;
    tokenValid?: boolean;
  };
  elicitation: ReturnType<typeof checkElicitationSupport>;
  sampling: {
    configured: boolean;
    available: boolean;
    mode: 'llm_fallback' | 'unavailable';
  };
  connectors: {
    available: number;
    configured: number;
    healthy: number;
  };
  webhooks: {
    configured: boolean;
    active: boolean;
  };
  missingConfig?: string[];
};

type StatusGuidance = {
  message: string;
  blockingIssues: Array<{ code: string; message: string; resolution?: string }>;
  recommendedNextAction: string;
  recommendedPrompt: string;
  nextSteps: string[];
};

type StatusMeta = {
  journeyStage:
    | 'onboarding'
    | 'readiness'
    | 'authentication'
    | 'connector_setup'
    | 'first_success'
    | 'recovery';
  nextBestAction: string;
  verificationSummary: string;
  nextSteps?: string[];
  warnings?: string[];
};

function getReadiness(
  googleClient: GoogleApiClient | null | undefined,
  auth: {
    configured: boolean;
    authenticated: boolean;
    authType?: string;
    tokenValid?: boolean;
  }
): ReadinessSummary {
  const connectors = connectorManager.listConnectors().connectors;
  const healthyConnectors = connectors.filter((connector) => connector.healthy).length;
  const configuredConnectors = connectors.filter((connector) => connector.configured).length;
  const llmFallbackAvailable = isLLMFallbackAvailable();
  const webhooksConfigured = Boolean(process.env['REDIS_URL']);

  const missingConfig: string[] = [];
  if (!auth.configured) {
    missingConfig.push('Google authentication is not configured');
  } else if (!auth.authenticated) {
    missingConfig.push('Google authentication has not been completed for this session');
  }
  if (!llmFallbackAvailable) {
    missingConfig.push('ANTHROPIC_API_KEY or LLM_API_KEY not configured for AI fallback');
  }
  if (!webhooksConfigured) {
    missingConfig.push('REDIS_URL not configured for webhook delivery');
  }

  return {
    googleAuth: {
      configured: auth.configured,
      authenticated: auth.authenticated,
      ...(auth.authType ? { authType: auth.authType } : {}),
      ...(auth.tokenValid !== undefined ? { tokenValid: auth.tokenValid } : {}),
    },
    elicitation: checkElicitationSupport(undefined),
    sampling: {
      configured: llmFallbackAvailable,
      available: llmFallbackAvailable,
      mode: llmFallbackAvailable ? 'llm_fallback' : 'unavailable',
    },
    connectors: {
      available: connectors.length,
      configured: configuredConnectors,
      healthy: healthyConnectors,
    },
    webhooks: {
      configured: webhooksConfigured,
      active: webhooksConfigured,
    },
    ...(missingConfig.length > 0 ? { missingConfig } : {}),
  } as const;
}

function getStatusGuidance(readiness: ReadinessSummary): StatusGuidance {
  if (!readiness.googleAuth.configured) {
    return {
      message:
        'Google authentication is not configured yet. Complete auth first, then run a connection test.',
      blockingIssues: [
        {
          code: 'NOT_CONFIGURED',
          message: 'Google authentication is not configured.',
          resolution:
            'Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET (or GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET), then restart the server.',
        },
      ],
      recommendedNextAction:
        'Run sheets_auth action "login" after OAuth credentials are configured.',
      recommendedPrompt: 'welcome',
      nextSteps: [
        'Complete Google auth setup',
        'Run /test_connection once authentication is available',
        'Use /first_operation for your first real task',
      ],
    };
  }

  if (!readiness.googleAuth.authenticated) {
    return {
      message:
        'Google authentication is configured but not ready for use yet. Authenticate first, then verify with the public test sheet.',
      blockingIssues: [
        {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Google authentication has not been completed for this session.',
          resolution: 'Run sheets_auth action "login" and complete the OAuth flow.',
        },
      ],
      recommendedNextAction:
        'Run sheets_auth action "login" to start OAuth, then run /test_connection.',
      recommendedPrompt: 'test_connection',
      nextSteps: [
        'Run sheets_auth login',
        'Re-check sheets_auth status',
        'Use /test_connection to verify read access',
      ],
    };
  }

  return {
    message:
      'Authentication is ready. Verify the connection with the public spreadsheet, then move straight into the first useful task.',
    blockingIssues: [] as Array<{ code: string; message: string; resolution?: string }>,
    recommendedNextAction:
      'Run /test_connection to verify the stack end-to-end, then use /first_operation for the first guided task.',
    recommendedPrompt: 'test_connection',
    nextSteps: [
      'Run /test_connection',
      'Use /first_operation on your spreadsheet',
      'Use sheets_auth action "setup_feature" for connectors, AI sampling, or webhooks when needed',
    ],
  };
}

function createMeta(options: {
  journeyStage:
    | 'onboarding'
    | 'readiness'
    | 'authentication'
    | 'connector_setup'
    | 'first_success'
    | 'recovery';
  nextBestAction: string;
  verificationSummary: string;
  nextSteps?: string[];
  warnings?: string[];
}): StatusMeta {
  return {
    journeyStage: options.journeyStage,
    nextBestAction: options.nextBestAction,
    verificationSummary: options.verificationSummary,
    ...(options.nextSteps ? { nextSteps: options.nextSteps } : {}),
    ...(options.warnings ? { warnings: options.warnings } : {}),
  };
}

export async function handleStatus(
  googleClient: GoogleApiClient | null | undefined,
  pendingReauthState?: {
    authUrl: string;
    failureCount: number;
    lastError: string;
  },
  credentials?: {
    oauthClientId?: string;
    oauthClientSecret?: string;
  }
): Promise<AuthResponse> {
  if (pendingReauthState) {
    return {
      success: false,
      error: {
        code: ErrorCodes.INVALID_CREDENTIALS,
        message:
          'OAuth refresh failed repeatedly. Re-authentication is required before using sheets_* tools.',
        retryable: false,
        resolution: 'Open the re-authentication URL and complete a fresh OAuth login.',
        resolutionSteps: [
          '1. Open the re-authentication URL from error.details.re_auth_url',
          '2. Complete the Google OAuth prompt and grant the requested permissions',
          '3. Retry your original request after authentication succeeds',
        ],
        details: {
          consecutiveFailures: pendingReauthState.failureCount,
          lastRefreshError: pendingReauthState.lastError,
          re_auth_url: pendingReauthState.authUrl,
        },
      },
    };
  }

  if (googleClient) {
    const authType = googleClient.authType;
    const tokenStatus = googleClient.getTokenStatus();
    const hasTokens = tokenStatus.hasAccessToken || tokenStatus.hasRefreshToken;

    if (authType === 'service_account' || authType === 'application_default') {
      const readiness = getReadiness(googleClient, {
        configured: true,
        authenticated: true,
        authType,
        tokenValid: true,
      });
      const guidance = getStatusGuidance(readiness);
      return {
        success: true,
        action: 'status',
        authenticated: true,
        authType,
        readiness,
        blockingIssues: guidance.blockingIssues,
        recommendedNextAction: guidance.recommendedNextAction,
        recommendedPrompt: guidance.recommendedPrompt,
        message: `Authenticated via ${authType.replace('_', ' ')} credentials. ${guidance.message}`,
        _meta: createMeta({
          journeyStage: 'readiness',
          nextBestAction: guidance.recommendedNextAction,
          verificationSummary: `Auth type ${authType} is ready; ${readiness.connectors.configured} connector(s) configured.`,
          nextSteps: guidance.nextSteps,
        }),
      };
    }

    // Validate token if present (check that it actually works)
    let tokenValid = false;
    let validationError: string | undefined;
    if (hasTokens) {
      const validation = await googleClient.validateToken();
      tokenValid = validation.valid;
      validationError = validation.error;
    }

    const authenticated = hasTokens && tokenValid;
    const readiness = getReadiness(googleClient, {
      configured: true,
      authenticated,
      authType,
      tokenValid,
    });
    const guidance = getStatusGuidance(readiness);

    return {
      success: true,
      action: 'status',
      authenticated,
      authType,
      readiness,
      blockingIssues: guidance.blockingIssues,
      recommendedNextAction: guidance.recommendedNextAction,
      recommendedPrompt: guidance.recommendedPrompt,
      hasAccessToken: tokenStatus.hasAccessToken,
      hasRefreshToken: tokenStatus.hasRefreshToken,
      tokenValid,
      scopes: googleClient.scopes,
      message: tokenValid
        ? `OAuth credentials present and valid. ${guidance.message}`
        : hasTokens
          ? `OAuth credentials present but invalid: ${validationError}. ${guidance.message}`
          : `Not authenticated. ${guidance.message}`,
      _meta: createMeta({
        journeyStage: 'readiness',
        nextBestAction: guidance.recommendedNextAction,
        verificationSummary: tokenValid
          ? `OAuth tokens are valid; ${readiness.connectors.configured} connector(s) already configured.`
          : 'OAuth credentials were checked but the current session is not ready.',
        nextSteps: guidance.nextSteps,
        ...(readiness.missingConfig ? { warnings: readiness.missingConfig } : {}),
      }),
    };
  }

  const configured = Boolean(
    (credentials?.oauthClientId || process.env['OAUTH_CLIENT_ID']) &&
    (credentials?.oauthClientSecret || process.env['OAUTH_CLIENT_SECRET'])
  );
  const readiness = getReadiness(googleClient, {
    configured,
    authenticated: false,
    authType: configured ? 'oauth' : 'unconfigured',
  });
  const guidance = getStatusGuidance(readiness);
  return {
    success: true,
    action: 'status',
    authenticated: false,
    authType: configured ? 'oauth' : 'unconfigured',
    readiness,
    blockingIssues: guidance.blockingIssues,
    recommendedNextAction: guidance.recommendedNextAction,
    recommendedPrompt: guidance.recommendedPrompt,
    message: configured
      ? `OAuth credentials configured but no session. ${guidance.message}`
      : `OAuth credentials not configured. ${guidance.message}`,
    _meta: createMeta({
      journeyStage: 'onboarding',
      nextBestAction: guidance.recommendedNextAction,
      verificationSummary: configured
        ? 'OAuth client credentials exist, but no active Google session was found.'
        : 'OAuth client credentials are missing from the current server configuration.',
      nextSteps: guidance.nextSteps,
      ...(readiness.missingConfig ? { warnings: readiness.missingConfig } : {}),
    }),
  };
}
