# Google Sheets API Quick Reference Guide

## API Endpoint URLs

```
Base: https://sheets.googleapis.com/v4

Read values:        GET /spreadsheets/{spreadsheetId}/values/{range}
Write values:       PUT /spreadsheets/{spreadsheetId}/values/{range}
Batch read:         GET /spreadsheets/{spreadsheetId}/values:batchGet
Batch write:        POST /spreadsheets/{spreadsheetId}/values:batchUpdate
Spreadsheet info:   GET /spreadsheets/{spreadsheetId}
Batch operations:   POST /spreadsheets/{spreadsheetId}:batchUpdate
Append values:      POST /spreadsheets/{spreadsheetId}/values/{range}:append
```

## Essential Python Code Snippets

### Initialize Service

```python
from google.oauth2 import service_account
from googleapiclient.discovery import build

# Service account
scopes = ['https://www.googleapis.com/auth/spreadsheets']
credentials = service_account.Credentials.from_service_account_file(
    'service-account-key.json',
    scopes=scopes
)
service = build('sheets', 'v4', credentials=credentials)

# OAuth
from google_auth_oauthlib.flow import InstalledAppFlow
flow = InstalledAppFlow.from_client_secrets_file('credentials.json', scopes)
credentials = flow.run_local_server()
service = build('sheets', 'v4', credentials=credentials)
```

### Read Data

```python
# Single range
result = service.spreadsheets().values().get(
    spreadsheetId=spreadsheet_id,
    range='Sheet1!A1:D10'
).execute()
values = result.get('values', [])

# Multiple ranges
result = service.spreadsheets().values().batchGet(
    spreadsheetId=spreadsheet_id,
    ranges=['Sheet1!A1:D10', 'Sheet2!A1:C5']
).execute()
```

### Write Data

```python
# Single range
service.spreadsheets().values().update(
    spreadsheetId=spreadsheet_id,
    range='Sheet1!A1:B2',
    valueInputOption='USER_ENTERED',
    body={'values': [['Header1', 'Header2'], ['Value1', 'Value2']]}
).execute()

# Multiple ranges (batch)
service.spreadsheets().values().batchUpdate(
    spreadsheetId=spreadsheet_id,
    body={
        'data': [
            {'range': 'Sheet1!A1:B2', 'values': [['H1', 'H2'], ['V1', 'V2']]},
            {'range': 'Sheet2!A1:C1', 'values': [['A', 'B', 'C']]}
        ],
        'valueInputOption': 'USER_ENTERED'
    }
).execute()

# Append data
service.spreadsheets().values().append(
    spreadsheetId=spreadsheet_id,
    range='Sheet1!A:D',
    valueInputOption='USER_ENTERED',
    body={'values': [['Value1', 'Value2', 'Value3', 'Value4']]}
).execute()
```

### Batch Operations (Structure Changes)

```python
service.spreadsheets().batchUpdate(
    spreadsheetId=spreadsheet_id,
    body={
        'requests': [
            # Add sheet
            {
                'addSheet': {
                    'properties': {'title': 'New Sheet'}
                }
            },
            # Delete sheet
            {
                'deleteSheet': {
                    'sheetId': 123
                }
            },
            # Rename sheet
            {
                'updateSheetProperties': {
                    'fields': 'title',
                    'properties': {'sheetId': 0, 'title': 'Renamed'}
                }
            },
            # Freeze rows
            {
                'updateSheetProperties': {
                    'fields': 'gridProperties.frozenRowCount',
                    'properties': {
                        'sheetId': 0,
                        'gridProperties': {'frozenRowCount': 1}
                    }
                }
            }
        ]
    }
).execute()
```

## Quota Reference

| Limit | Value |
|-------|-------|
| Read requests per minute | 300 |
| Write requests per minute | 100 |
| General per 100 seconds | 100 requests |
| Daily limit | 1,000,000 requests |
| Request timeout | 180 seconds |

## Common Range Formats

```
Single cell:        Sheet1!A1
Column range:       Sheet1!A:A
Row range:          Sheet1!1:1
Rectangular:        Sheet1!A1:D10
Multiple sheets:    Sheet1!A1:D10, Sheet2!E1:H5
Entire sheet:       Sheet1
Named range:        DataRange
```

## HTTP Status Codes

| Code | Meaning | Retry? |
|------|---------|--------|
| 200 | Success | No |
| 400 | Bad request (invalid format) | No |
| 401 | Unauthorized (bad credentials) | No |
| 403 | Forbidden (no permission) | No |
| 404 | Not found (spreadsheet/sheet missing) | No |
| 429 | Rate limited | Yes (exponential backoff) |
| 500 | Server error | Yes (exponential backoff) |
| 503 | Service unavailable | Yes (exponential backoff) |

## OAuth Scopes

```
Read only:          https://www.googleapis.com/auth/spreadsheets.readonly
Read/Write:         https://www.googleapis.com/auth/spreadsheets
Drive access:       https://www.googleapis.com/auth/drive
```

## Error Handling Boilerplate

```python
import time
from googleapiclient.errors import HttpError

def call_with_retry(func, max_retries=5):
    for attempt in range(max_retries):
        try:
            return func()
        except HttpError as e:
            if e.resp.status == 429:
                wait = (2 ** attempt) + random.uniform(0, 1)
                time.sleep(wait)
            else:
                raise
    raise Exception(f"Failed after {max_retries} retries")
```

## Authentication Checklist

- [ ] API enabled in Google Cloud Console
- [ ] Credentials created and downloaded
- [ ] Service account JSON in secure location (not in repo)
- [ ] Spreadsheet shared with service account email
- [ ] OAuth redirect URIs configured (if using OAuth)
- [ ] Required scopes specified
- [ ] Credentials loaded from environment variables

## Performance Tips

| Technique | Benefit | Cost |
|-----------|---------|------|
| Batch operations | 10x faster | Requires bundling |
| Caching | 80%+ reduction in API calls | Memory usage |
| Specific ranges | Reduces data transfer | More precise management |
| Gzip compression | Smaller payloads | CPU overhead |
| Connection pooling | Reduced connection time | Memory overhead |

## Debugging Checklist

If something isn't working:

1. **Check authentication**
   - Is API enabled? → Enable in GCP Console
   - Is spreadsheet shared? → Share with service account email
   - Are credentials valid? → Verify JSON file or OAuth flow

2. **Check range format**
   - Is A1 notation correct? → e.g., "Sheet1!A1:D10"
   - Does sheet exist? → Check sheet names
   - Valid column letters? → A-Z, AA-ZZ, etc.

3. **Check rate limiting**
   - 429 error? → Implement exponential backoff
   - Too many requests? → Batch operations
   - Monitor quota → Check GCP metrics

4. **Check data**
   - Empty response? → Check range contains data
   - Type mismatch? → Validate input format
   - Timeout error? → Reduce batch size

## Command-Line Debugging

```bash
# Enable debug logging
export GOOGLE_APPLICATION_CREDENTIALS=service-account-key.json

# Test credentials
gcloud auth activate-service-account --key-file=service-account-key.json
gcloud sheets spreadsheets describe SPREADSHEET_ID

# Monitor quota usage
gcloud monitoring metrics-descriptors list --filter="resource.type=api"
```

## Testing Template

```python
import unittest
from unittest.mock import Mock, patch

class TestSheetsIntegration(unittest.TestCase):
    def setUp(self):
        self.service_mock = Mock()

    def test_read_range(self):
        # Mock API response
        self.service_mock.spreadsheets().values().get.return_value.execute.return_value = {
            'values': [['A', 'B'], ['1', '2']]
        }

        # Test function
        result = read_range(self.service_mock, 'spreadsheet_id', 'Sheet1!A1:B2')
        self.assertEqual(result, [['A', 'B'], ['1', '2']])

    def test_rate_limiting(self):
        # Test that rate limiter waits appropriately
        limiter = RateLimiter(max_requests=10)
        start = time.time()
        for _ in range(15):
            limiter.wait_if_needed()
        duration = time.time() - start
        self.assertGreater(duration, 5)  # Should have waited

if __name__ == '__main__':
    unittest.main()
```

## Security Checklist

- [ ] Never commit credentials files
- [ ] Use environment variables for sensitive data
- [ ] Rotate service account keys quarterly
- [ ] Enable audit logging in GCP
- [ ] Review access permissions regularly
- [ ] Use least privilege for OAuth scopes
- [ ] Use HTTPS for all connections
- [ ] Implement input validation
- [ ] Log sensitive operations
- [ ] Monitor for unusual activity

## Production Deployment Checklist

- [ ] Error handling implemented
- [ ] Rate limiting configured
- [ ] Caching strategy defined
- [ ] Logging configured
- [ ] Monitoring/alerting set up
- [ ] Credentials in secure location
- [ ] Automatic retry logic working
- [ ] Tests passing
- [ ] Load testing completed
- [ ] Disaster recovery plan documented

