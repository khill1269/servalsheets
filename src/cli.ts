#!/usr/bin/env node
/**
 * ServalSheets - CLI Entry Point
 * MCP Protocol: 2025-11-25
 */

import { ServalSheetsServer, type ServalSheetsServerOptions } from './server.js';
import { logger } from './utils/logger.js';

const args = process.argv.slice(2);

// Parse command line arguments
const cliOptions: {
  serviceAccountKeyPath?: string;
  accessToken?: string;
} = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const nextArg = args[i + 1];
  
  if (arg === '--service-account' && nextArg) {
    cliOptions.serviceAccountKeyPath = nextArg;
    i++;
  } else if (arg === '--access-token' && nextArg) {
    cliOptions.accessToken = nextArg;
    i++;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
ServalSheets - Google Sheets MCP Server

Usage:
  servalsheets [options]

Options:
  --service-account <path>  Path to service account key JSON file
  --access-token <token>    OAuth2 access token
  --help, -h                Show this help message

Environment Variables:
  GOOGLE_APPLICATION_CREDENTIALS  Path to service account key
  GOOGLE_ACCESS_TOKEN             OAuth2 access token
  GOOGLE_CLIENT_ID                OAuth2 client ID
  GOOGLE_CLIENT_SECRET            OAuth2 client secret
  GOOGLE_TOKEN_STORE_PATH         Encrypted token store file path
  GOOGLE_TOKEN_STORE_KEY          Token store encryption key (64-char hex)

Examples:
  # Using service account
  servalsheets --service-account ./credentials.json

  # Using access token
  servalsheets --access-token ya29.xxx

  # Using environment variables
  export GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
  servalsheets
`);
    process.exit(0);
  }
}

// Check environment variables
const serviceAccountPath = cliOptions.serviceAccountKeyPath ?? process.env['GOOGLE_APPLICATION_CREDENTIALS'];
const accessToken = cliOptions.accessToken ?? process.env['GOOGLE_ACCESS_TOKEN'];
const clientId = process.env['GOOGLE_CLIENT_ID'];
const clientSecret = process.env['GOOGLE_CLIENT_SECRET'];
const tokenStorePath = process.env['GOOGLE_TOKEN_STORE_PATH'];
const tokenStoreKey = process.env['GOOGLE_TOKEN_STORE_KEY'];

// Build server options
const serverOptions: ServalSheetsServerOptions = {};

// Build Google API options only if we have credentials
const sharedGoogleOptions = {
  tokenStorePath,
  tokenStoreKey,
};

if (serviceAccountPath) {
  serverOptions.googleApiOptions = {
    serviceAccountKeyPath: serviceAccountPath,
    ...sharedGoogleOptions,
  };
} else if (accessToken) {
  serverOptions.googleApiOptions = {
    accessToken: accessToken,
    ...sharedGoogleOptions,
  };
} else if (clientId && clientSecret) {
  serverOptions.googleApiOptions = {
    credentials: { clientId, clientSecret },
    ...sharedGoogleOptions,
  };
}

// Create and start server
const server = new ServalSheetsServer(serverOptions);

server.start().catch((error: unknown) => {
  logger.error('Failed to start ServalSheets server', { error });
  process.exit(1);
});
