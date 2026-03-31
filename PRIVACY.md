# Privacy Policy

**ServalSheets** — Google Sheets MCP Server

_Last updated: 2026-03-31_

## What data ServalSheets accesses

ServalSheets accesses Google Sheets data on your behalf using OAuth 2.0 authorization
you explicitly grant. It reads and writes spreadsheet content only as directed by
your explicit instructions to Claude.

## What data ServalSheets stores

ServalSheets stores only the OAuth credentials (access token and refresh token) required
to maintain your session with Google. These tokens are encrypted at rest using AES-256-GCM
before being written to disk.

ServalSheets does **not** store:

- Spreadsheet content or cell values
- Conversation history or Claude prompts
- Personally identifiable information beyond what Google provides in the OAuth token

## How data is used

All data accessed through ServalSheets is used solely to fulfill the Google Sheets
operations you request. No data is shared with third parties, used for training, or
retained after your session ends.

## Data deletion

You can revoke ServalSheets' access to your Google account at any time via
[Google Account permissions](https://myaccount.google.com/permissions). Revoking
access deletes the stored OAuth token on the next server restart.

## Contact

For privacy questions, open an issue at
<https://github.com/khill1269/servalsheets/issues> or email support@servalsheets.com.
