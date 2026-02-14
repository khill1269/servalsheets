# Google Sheets API Multi-Language Implementation Examples

## Python Implementation

### Complete Service Initialization with Error Handling

```python
import os
import logging
from google.oauth2 import service_account
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GoogleSheetsClient:
    SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

    @staticmethod
    def build_service_account_service(key_file_path):
        """Build service from service account key file"""
        try:
            if not os.path.exists(key_file_path):
                raise FileNotFoundError(f"Key file not found: {key_file_path}")

            credentials = service_account.Credentials.from_service_account_file(
                key_file_path,
                scopes=GoogleSheetsClient.SCOPES
            )
            service = build('sheets', 'v4', credentials=credentials)
            logger.info("Service account credentials loaded successfully")
            return service
        except Exception as e:
            logger.error(f"Failed to initialize service account: {e}")
            raise

    @staticmethod
    def build_oauth_service(credentials_file):
        """Build service from OAuth credentials"""
        try:
            creds = None

            # Load token if exists
            if os.path.exists('token.pickle'):
                import pickle
                with open('token.pickle', 'rb') as token:
                    creds = pickle.load(token)

            # Refresh or create new credentials
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                else:
                    flow = InstalledAppFlow.from_client_secrets_file(
                        credentials_file,
                        GoogleSheetsClient.SCOPES
                    )
                    creds = flow.run_local_server(port=0)

                # Save token for future use
                import pickle
                with open('token.pickle', 'wb') as token:
                    pickle.dump(creds, token)

            service = build('sheets', 'v4', credentials=creds)
            logger.info("OAuth credentials loaded successfully")
            return service
        except Exception as e:
            logger.error(f"Failed to initialize OAuth: {e}")
            raise

class RobustSheetsAPI:
    def __init__(self, service):
        self.service = service

    def read_values(self, spreadsheet_id, range_name, retries=3):
        """Read values with retry logic"""
        for attempt in range(retries):
            try:
                result = self.service.spreadsheets().values().get(
                    spreadsheetId=spreadsheet_id,
                    range=range_name
                ).execute()
                return result.get('values', [])
            except HttpError as error:
                if error.resp.status == 429 and attempt < retries - 1:
                    import time, random
                    wait_time = (2 ** attempt) + random.uniform(0, 1)
                    logger.warning(f"Rate limited, waiting {wait_time:.1f}s")
                    time.sleep(wait_time)
                else:
                    logger.error(f"Failed to read values: {error}")
                    raise

    def write_values(self, spreadsheet_id, range_name, values):
        """Write values with validation"""
        if not values or not isinstance(values, list):
            raise ValueError("Values must be non-empty list of rows")

        try:
            result = self.service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=range_name,
                valueInputOption='USER_ENTERED',
                body={'values': values}
            ).execute()
            logger.info(f"Updated {result.get('updatedCells', 0)} cells")
            return result
        except HttpError as error:
            logger.error(f"Failed to write values: {error}")
            raise

    def batch_read(self, spreadsheet_id, ranges):
        """Read multiple ranges efficiently"""
        try:
            result = self.service.spreadsheets().values().batchGet(
                spreadsheetId=spreadsheet_id,
                ranges=ranges
            ).execute()
            return result.get('valueRanges', [])
        except HttpError as error:
            logger.error(f"Batch read failed: {error}")
            raise

    def batch_write(self, spreadsheet_id, data):
        """Write to multiple ranges efficiently"""
        try:
            result = self.service.spreadsheets().values().batchUpdate(
                spreadsheetId=spreadsheet_id,
                body={
                    'data': data,
                    'valueInputOption': 'USER_ENTERED'
                }
            ).execute()
            logger.info(f"Updated {len(data)} ranges")
            return result
        except HttpError as error:
            logger.error(f"Batch write failed: {error}")
            raise

# Usage example
if __name__ == '__main__':
    # Initialize
    service = GoogleSheetsClient.build_service_account_service(
        os.getenv('GOOGLE_SERVICE_ACCOUNT_FILE')
    )
    api = RobustSheetsAPI(service)

    # Read data
    values = api.read_values('SPREADSHEET_ID', 'Sheet1!A1:D10')

    # Write data
    api.write_values('SPREADSHEET_ID', 'Sheet1!A1:B2',
                     [['Header1', 'Header2'], ['Value1', 'Value2']])

    # Batch read
    ranges = ['Sheet1!A1:D10', 'Sheet2!A1:C5']
    results = api.batch_read('SPREADSHEET_ID', ranges)
```

## JavaScript/Node.js Implementation

### Complete Client Setup and Operations

```javascript
const {google} = require('googleapis');
const fs = require('fs');
const path = require('path');

class GoogleSheetsClient {
    constructor(credentials) {
        this.credentials = credentials;
        this.sheets = null;
        this.requestCount = 0;
        this.requestTimes = [];
    }

    async initialize() {
        try {
            // Create JWT client from service account
            const auth = new google.auth.GoogleAuth({
                keyFile: this.credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });

            this.authClient = await auth.getClient();
            this.sheets = google.sheets({version: 'v4', auth: this.authClient});
            console.log('Google Sheets client initialized');
        } catch (error) {
            console.error('Failed to initialize client:', error);
            throw error;
        }
    }

    async readRange(spreadsheetId, range) {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range
            });
            return response.data.values || [];
        } catch (error) {
            console.error(`Failed to read range ${range}:`, error);
            throw error;
        }
    }

    async writeRange(spreadsheetId, range, values) {
        if (!values || !Array.isArray(values)) {
            throw new Error('Values must be an array of rows');
        }

        try {
            const response = await this.sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: values
                }
            });
            console.log(`Updated ${response.data.updatedCells} cells`);
            return response.data;
        } catch (error) {
            console.error(`Failed to write range ${range}:`, error);
            throw error;
        }
    }

    async batchRead(spreadsheetId, ranges) {
        try {
            const response = await this.sheets.spreadsheets.values.batchGet({
                spreadsheetId,
                ranges: ranges
            });
            return response.data.valueRanges;
        } catch (error) {
            console.error('Batch read failed:', error);
            throw error;
        }
    }

    async appendRow(spreadsheetId, range, values) {
        try {
            const response = await this.sheets.spreadsheets.values.append({
                spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [values]
                }
            });
            return response.data;
        } catch (error) {
            console.error(`Failed to append to ${range}:`, error);
            throw error;
        }
    }

    async batchUpdate(spreadsheetId, data) {
        try {
            const response = await this.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                requestBody: {
                    data: data,
                    valueInputOption: 'USER_ENTERED'
                }
            });
            console.log(`Updated ${data.length} ranges`);
            return response.data;
        } catch (error) {
            console.error('Batch update failed:', error);
            throw error;
        }
    }

    // Rate limiting
    async waitIfNeeded() {
        const now = Date.now();
        this.requestTimes = this.requestTimes.filter(t => now - t < 60000);

        if (this.requestTimes.length >= 80) { // 80 requests in 60 seconds
            const oldestTime = this.requestTimes[0];
            const waitTime = 60000 - (now - oldestTime);
            if (waitTime > 0) {
                console.log(`Rate limiting: waiting ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        this.requestTimes.push(Date.now());
    }

    async callWithRetry(fn, maxRetries = 5) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                await this.waitIfNeeded();
                return await fn();
            } catch (error) {
                if (error.code === 429 && attempt < maxRetries - 1) {
                    const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                    console.log(`Rate limited, retrying in ${waitTime}ms`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    throw error;
                }
            }
        }
    }
}

// Usage example
async function main() {
    const client = new GoogleSheetsClient(
        process.env.GOOGLE_SERVICE_ACCOUNT_FILE
    );

    await client.initialize();

    // Read values
    const values = await client.callWithRetry(() =>
        client.readRange('SPREADSHEET_ID', 'Sheet1!A1:D10')
    );
    console.log('Values:', values);

    // Write values
    await client.callWithRetry(() =>
        client.writeRange('SPREADSHEET_ID', 'Sheet1!A1:B2',
            [['Header1', 'Header2'], ['Value1', 'Value2']])
    );

    // Batch operations
    const ranges = ['Sheet1!A1:D10', 'Sheet2!A1:C5'];
    const batchData = await client.callWithRetry(() =>
        client.batchRead('SPREADSHEET_ID', ranges)
    );
    console.log('Batch data:', batchData);
}

main().catch(console.error);
```

## Go Implementation

### Complete Service Client with Error Handling

```go
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
	"google.golang.org/api/googleapi"
)

type SheetsClient struct {
	service *sheets.Service
	ctx     context.Context
}

// NewSheetsClient creates a new Sheets API client
func NewSheetsClient(ctx context.Context, credentialsFile string) (*SheetsClient, error) {
	service, err := sheets.NewService(ctx, option.WithCredentialsFile(credentialsFile))
	if err != nil {
		return nil, fmt.Errorf("failed to create sheets service: %w", err)
	}

	return &SheetsClient{
		service: service,
		ctx:     ctx,
	}, nil
}

// ReadRange reads a single range from a spreadsheet
func (c *SheetsClient) ReadRange(spreadsheetID, rangeLabel string) ([][]interface{}, error) {
	response, err := c.service.Spreadsheets.Values.Get(spreadsheetID, rangeLabel).Do()
	if err != nil {
		return nil, fmt.Errorf("failed to read range: %w", err)
	}

	if response.Values == nil {
		return [][]interface{}{}, nil
	}

	return response.Values, nil
}

// WriteRange writes values to a single range
func (c *SheetsClient) WriteRange(spreadsheetID, rangeLabel string, values [][]interface{}) error {
	valueRange := &sheets.ValueRange{
		Values: values,
	}

	_, err := c.service.Spreadsheets.Values.Update(
		spreadsheetID,
		rangeLabel,
		valueRange,
	).ValueInputOption("USER_ENTERED").Do()

	if err != nil {
		return fmt.Errorf("failed to write range: %w", err)
	}

	log.Printf("Successfully updated %s", rangeLabel)
	return nil
}

// BatchRead reads multiple ranges efficiently
func (c *SheetsClient) BatchRead(spreadsheetID string, ranges []string) ([]*sheets.ValueRange, error) {
	response, err := c.service.Spreadsheets.Values.BatchGet(spreadsheetID).
		Ranges(ranges...).
		Do()

	if err != nil {
		return nil, fmt.Errorf("batch read failed: %w", err)
	}

	return response.ValueRanges, nil
}

// BatchWrite writes to multiple ranges efficiently
func (c *SheetsClient) BatchWrite(spreadsheetID string, data []*sheets.ValueRange) error {
	batchRequest := &sheets.BatchUpdateValuesRequest{
		Data:             data,
		ValueInputOption: "USER_ENTERED",
	}

	_, err := c.service.Spreadsheets.Values.BatchUpdate(
		spreadsheetID,
		batchRequest,
	).Do()

	if err != nil {
		return fmt.Errorf("batch write failed: %w", err)
	}

	return nil
}

// CallWithRetry executes a function with exponential backoff retry logic
func (c *SheetsClient) CallWithRetry(fn func() error, maxRetries int) error {
	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		err := fn()

		if err == nil {
			return nil
		}

		// Check if error is rate limit
		if apiErr, ok := err.(*googleapi.Error); ok && apiErr.Code == 429 {
			if attempt < maxRetries-1 {
				waitTime := time.Duration(1<<uint(attempt)) * time.Second
				log.Printf("Rate limited, waiting %v", waitTime)
				time.Sleep(waitTime)
				continue
			}
		}

		lastErr = err
		break
	}

	return fmt.Errorf("operation failed after %d retries: %w", maxRetries, lastErr)
}

func main() {
	ctx := context.Background()

	// Initialize client
	client, err := NewSheetsClient(ctx, os.Getenv("GOOGLE_SERVICE_ACCOUNT_FILE"))
	if err != nil {
		log.Fatalf("Failed to initialize client: %v", err)
	}

	spreadsheetID := "YOUR_SPREADSHEET_ID"

	// Read values with retry
	var values [][]interface{}
	err = client.CallWithRetry(func() error {
		var err error
		values, err = client.ReadRange(spreadsheetID, "Sheet1!A1:D10")
		return err
	}, 5)

	if err != nil {
		log.Fatalf("Failed to read values: %v", err)
	}

	fmt.Printf("Read %d rows\n", len(values))

	// Write values
	newValues := [][]interface{}{
		{"Header1", "Header2"},
		{"Value1", "Value2"},
	}

	err = client.WriteRange(spreadsheetID, "Sheet1!A1:B2", newValues)
	if err != nil {
		log.Fatalf("Failed to write values: %v", err)
	}

	// Batch read
	ranges := []string{"Sheet1!A1:D10", "Sheet2!A1:C5"}
	valueRanges, err := client.BatchRead(spreadsheetID, ranges)
	if err != nil {
		log.Fatalf("Batch read failed: %v", err)
	}

	fmt.Printf("Read %d ranges\n", len(valueRanges))
}
```

## Java Implementation

### Complete Client Setup with Proper Error Handling

```java
import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.extensions.java6.auth.oauth2.AuthorizationCodeInstalledApp;
import com.google.api.client.extensions.jetty.auth.oauth2.LocalServerReceiver;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleClientSecrets;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.client.util.store.FileDataStoreFactory;
import com.google.api.services.sheets.v4.Sheets;
import com.google.api.services.sheets.v4.SheetsScopes;
import com.google.api.services.sheets.v4.model.*;

import java.io.*;
import java.security.GeneralSecurityException;
import java.util.*;
import java.util.logging.Logger;

public class GoogleSheetsAPI {
    private static final Logger logger = Logger.getLogger(GoogleSheetsAPI.class.getName());
    private static final String APPLICATION_NAME = "Google Sheets API";
    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();
    private static final List<String> SCOPES = Collections.singletonList(SheetsScopes.SPREADSHEETS);

    private Sheets service;

    /**
     * Initialize Sheets service with OAuth credentials
     */
    public GoogleSheetsAPI(String credentialsPath) throws IOException, GeneralSecurityException {
        final NetHttpTransport HTTP_TRANSPORT = GoogleNetHttpTransport.newTrustedTransport();
        service = new Sheets.Builder(
                HTTP_TRANSPORT,
                JSON_FACTORY,
                getCredentials(HTTP_TRANSPORT, credentialsPath))
                .setApplicationName(APPLICATION_NAME)
                .build();
    }

    /**
     * Get or create OAuth credentials
     */
    private static Credential getCredentials(NetHttpTransport HTTP_TRANSPORT, String credentialsPath)
            throws IOException {
        GoogleClientSecrets clientSecrets = GoogleClientSecrets.load(
                JSON_FACTORY,
                new FileReader(credentialsPath));

        GoogleAuthorizationCodeFlow flow = new GoogleAuthorizationCodeFlow.Builder(
                HTTP_TRANSPORT,
                JSON_FACTORY,
                clientSecrets,
                SCOPES)
                .setDataStoreFactory(new FileDataStoreFactory(new java.io.File("tokens")))
                .setAccessType("offline")
                .build();

        LocalServerReceiver receiver = new LocalServerReceiver.Builder().setPort(8888).build();
        return new AuthorizationCodeInstalledApp(flow, receiver).authorize("user");
    }

    /**
     * Read values from a range
     */
    public List<List<Object>> readRange(String spreadsheetId, String range) throws IOException {
        try {
            ValueRange response = service.spreadsheets().values()
                    .get(spreadsheetId, range)
                    .execute();

            return response.getValues() == null ? new ArrayList<>() : response.getValues();
        } catch (IOException e) {
            logger.severe("Failed to read range: " + e.getMessage());
            throw e;
        }
    }

    /**
     * Write values to a range
     */
    public void writeRange(String spreadsheetId, String range, List<List<Object>> values)
            throws IOException {
        if (values == null || values.isEmpty()) {
            throw new IllegalArgumentException("Values cannot be null or empty");
        }

        try {
            ValueRange body = new ValueRange()
                    .setValues(values);

            service.spreadsheets().values()
                    .update(spreadsheetId, range, body)
                    .setValueInputOption("USER_ENTERED")
                    .execute();

            logger.info("Successfully updated range: " + range);
        } catch (IOException e) {
            logger.severe("Failed to write range: " + e.getMessage());
            throw e;
        }
    }

    /**
     * Batch read multiple ranges
     */
    public List<ValueRange> batchRead(String spreadsheetId, List<String> ranges) throws IOException {
        try {
            BatchGetValuesResponse response = service.spreadsheets().values()
                    .batchGet(spreadsheetId)
                    .setRanges(ranges)
                    .execute();

            return response.getValueRanges();
        } catch (IOException e) {
            logger.severe("Batch read failed: " + e.getMessage());
            throw e;
        }
    }

    /**
     * Batch write to multiple ranges
     */
    public void batchWrite(String spreadsheetId, List<ValueRange> data) throws IOException {
        try {
            BatchUpdateValuesRequest batchRequest = new BatchUpdateValuesRequest()
                    .setData(data)
                    .setValueInputOption("USER_ENTERED");

            service.spreadsheets().values()
                    .batchUpdate(spreadsheetId, batchRequest)
                    .execute();

            logger.info("Successfully batch updated " + data.size() + " ranges");
        } catch (IOException e) {
            logger.severe("Batch update failed: " + e.getMessage());
            throw e;
        }
    }

    /**
     * Call API with exponential backoff retry
     */
    public <T> T callWithRetry(RetryableCall<T> call, int maxRetries) throws IOException {
        IOException lastException = null;

        for (int attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return call.execute();
            } catch (IOException e) {
                // Check if error is rate limit (429)
                if (e.getMessage().contains("429") && attempt < maxRetries - 1) {
                    long waitTime = (long) (Math.pow(2, attempt) * 1000);
                    logger.warning("Rate limited, waiting " + waitTime + "ms");
                    try {
                        Thread.sleep(waitTime);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                    }
                } else {
                    lastException = e;
                    break;
                }
            }
        }

        throw lastException != null ? lastException :
                new IOException("Operation failed after " + maxRetries + " retries");
    }

    /**
     * Functional interface for retryable calls
     */
    @FunctionalInterface
    public interface RetryableCall<T> {
        T execute() throws IOException;
    }

    // Usage example
    public static void main(String[] args) throws IOException, GeneralSecurityException {
        GoogleSheetsAPI api = new GoogleSheetsAPI("credentials.json");
        String spreadsheetId = "YOUR_SPREADSHEET_ID";

        // Read values
        try {
            List<List<Object>> values = api.readRange(spreadsheetId, "Sheet1!A1:D10");
            System.out.println("Read " + values.size() + " rows");
        } catch (IOException e) {
            e.printStackTrace();
        }

        // Write values
        List<List<Object>> newValues = Arrays.asList(
                Arrays.asList("Header1", "Header2"),
                Arrays.asList("Value1", "Value2")
        );

        try {
            api.writeRange(spreadsheetId, "Sheet1!A1:B2", newValues);
        } catch (IOException e) {
            e.printStackTrace();
        }

        // Batch read
        List<String> ranges = Arrays.asList("Sheet1!A1:D10", "Sheet2!A1:C5");
        try {
            List<ValueRange> batchData = api.batchRead(spreadsheetId, ranges);
            System.out.println("Read " + batchData.size() + " ranges");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

## C# Implementation

### Complete Client with Dependency Injection

```csharp
using Google.Apis.Auth.OAuth2;
using Google.Apis.Sheets.v4;
using Google.Apis.Sheets.v4.Data;
using Google.Apis.Services;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

public class GoogleSheetsClient
{
    private static readonly string[] Scopes = { SheetsService.Scope.Spreadsheets };
    private readonly SheetsService _service;
    private readonly ILogger _logger;

    public GoogleSheetsClient(string credentialsPath, ILogger logger = null)
    {
        _logger = logger ?? new ConsoleLogger();
        _service = BuildService(credentialsPath);
    }

    private SheetsService BuildService(string credentialsPath)
    {
        try
        {
            GoogleCredential credential;
            using (var stream = new FileStream(credentialsPath, FileMode.Open, FileAccess.Read))
            {
                credential = GoogleCredential.FromStream(stream)
                    .CreateScoped(Scopes);
            }

            var service = new SheetsService(new BaseClientService.Initializer()
            {
                HttpClientInitializer = credential,
                ApplicationName = "Google Sheets API Client"
            });

            _logger.LogInfo("Google Sheets service initialized");
            return service;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Failed to initialize service: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Read values from a spreadsheet range
    /// </summary>
    public async Task<IList<IList<object>>> ReadRangeAsync(string spreadsheetId, string range)
    {
        try
        {
            var request = _service.Spreadsheets.Values.Get(spreadsheetId, range);
            var response = await request.ExecuteAsync();
            return response.Values ?? new List<IList<object>>();
        }
        catch (Exception ex)
        {
            _logger.LogError($"Failed to read range {range}: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Write values to a spreadsheet range
    /// </summary>
    public async Task WriteRangeAsync(string spreadsheetId, string range, IList<IList<object>> values)
    {
        if (values == null || !values.Any())
        {
            throw new ArgumentException("Values cannot be null or empty");
        }

        try
        {
            var body = new ValueRange { Values = values };
            var request = _service.Spreadsheets.Values.Update(body, spreadsheetId, range);
            request.ValueInputOption = SpreadsheetsResource.ValuesResource.UpdateRequest.ValueInputOptionEnum.USERENTERED;

            var response = await request.ExecuteAsync();
            _logger.LogInfo($"Updated {response.UpdatedCells} cells in range {range}");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Failed to write range {range}: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Batch read multiple ranges
    /// </summary>
    public async Task<IList<ValueRange>> BatchReadAsync(string spreadsheetId, IList<string> ranges)
    {
        try
        {
            var request = _service.Spreadsheets.Values.BatchGet(spreadsheetId);
            request.Ranges = ranges;

            var response = await request.ExecuteAsync();
            return response.ValueRanges ?? new List<ValueRange>();
        }
        catch (Exception ex)
        {
            _logger.LogError($"Batch read failed: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Batch write to multiple ranges
    /// </summary>
    public async Task BatchWriteAsync(string spreadsheetId, IList<ValueRange> data)
    {
        try
        {
            var batchRequest = new BatchUpdateValuesRequest
            {
                Data = data,
                ValueInputOption = "USER_ENTERED"
            };

            var request = _service.Spreadsheets.Values.BatchUpdate(batchRequest, spreadsheetId);
            var response = await request.ExecuteAsync();
            _logger.LogInfo($"Batch updated {data.Count} ranges");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Batch write failed: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Execute operation with exponential backoff retry
    /// </summary>
    public async Task<T> ExecuteWithRetryAsync<T>(Func<Task<T>> operation, int maxRetries = 5)
    {
        Exception lastException = null;

        for (int attempt = 0; attempt < maxRetries; attempt++)
        {
            try
            {
                return await operation();
            }
            catch (Exception ex)
            {
                if (ex.Message.Contains("429") && attempt < maxRetries - 1)
                {
                    var waitTime = TimeSpan.FromSeconds(Math.Pow(2, attempt));
                    _logger.LogWarning($"Rate limited, waiting {waitTime.TotalSeconds}s");
                    await Task.Delay(waitTime);
                }
                else
                {
                    lastException = ex;
                    break;
                }
            }
        }

        throw lastException ?? new Exception($"Operation failed after {maxRetries} retries");
    }
}

// Logger interface
public interface ILogger
{
    void LogInfo(string message);
    void LogWarning(string message);
    void LogError(string message);
}

public class ConsoleLogger : ILogger
{
    public void LogInfo(string message) => Console.WriteLine($"[INFO] {message}");
    public void LogWarning(string message) => Console.WriteLine($"[WARNING] {message}");
    public void LogError(string message) => Console.WriteLine($"[ERROR] {message}");
}

// Usage example
class Program
{
    static async Task Main(string[] args)
    {
        var client = new GoogleSheetsClient("credentials.json", new ConsoleLogger());
        string spreadsheetId = "YOUR_SPREADSHEET_ID";

        try
        {
            // Read values
            var values = await client.ExecuteWithRetryAsync(() =>
                client.ReadRangeAsync(spreadsheetId, "Sheet1!A1:D10")
            );
            Console.WriteLine($"Read {values.Count} rows");

            // Write values
            var newValues = new List<IList<object>>
            {
                new List<object> { "Header1", "Header2" },
                new List<object> { "Value1", "Value2" }
            };

            await client.ExecuteWithRetryAsync(() =>
                client.WriteRangeAsync(spreadsheetId, "Sheet1!A1:B2", newValues)
            );

            // Batch read
            var ranges = new List<string> { "Sheet1!A1:D10", "Sheet2!A1:C5" };
            var batchData = await client.ExecuteWithRetryAsync(() =>
                client.BatchReadAsync(spreadsheetId, ranges)
            );
            Console.WriteLine($"Read {batchData.Count} ranges");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
        }
    }
}
```

---

## Comparison Table: Language Features

| Language | Strengths | Best For |
|----------|-----------|----------|
| Python | Simple syntax, easy to learn, excellent libraries | Data analysis, automation scripts |
| JavaScript/Node.js | Non-blocking I/O, excellent async support | Web servers, real-time applications |
| Go | Performance, concurrency, fast execution | High-throughput services, microservices |
| Java | Enterprise-grade, mature ecosystem | Large-scale applications, enterprise systems |
| C# | .NET ecosystem, strong typing, LINQ | Windows applications, enterprise solutions |

## Common Patterns Across All Languages

1. **Credential Management**: Always use environment variables
2. **Error Handling**: Implement try-catch with specific error codes
3. **Rate Limiting**: Exponential backoff for 429 errors
4. **Retry Logic**: 3-5 retries with increasing delays
5. **Logging**: Comprehensive logging for debugging
6. **Connection Pooling**: Reuse service instances
7. **Validation**: Validate input before API calls
8. **Testing**: Mock API responses for unit tests

