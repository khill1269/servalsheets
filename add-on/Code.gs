/**
 * ServalSheets Google Workspace Add-on
 *
 * This add-on provides AI-powered Google Sheets capabilities through
 * the ServalSheets MCP server API.
 *
 * Architecture:
 * - This file (Code.gs) runs in Apps Script (server-side)
 * - Calls ServalSheets HTTP API (your MCP server)
 * - Sidebar.html provides the UI (client-side)
 */

// Configuration
const CONFIG = {
  // For local testing, use: http://localhost:3000
  // For production, use: https://api.servalsheets.com (or your deployed URL)
  API_URL: 'http://localhost:3000',

  // API key stored in user properties (set via Settings dialog)
  API_KEY_PROPERTY: 'SERVALSHEETS_API_KEY',

  // Plan tier (detected from API responses)
  PLAN_PROPERTY: 'SERVALSHEETS_PLAN',

  // Session ID for MCP protocol (stored per user)
  SESSION_ID_PROPERTY: 'SERVALSHEETS_SESSION_ID'
};

/**
 * Called when spreadsheet is opened
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ServalSheets')
    .addItem('Show AI Assistant', 'showSidebar')
    .addSeparator()
    .addItem('Settings', 'showSettings')
    .addItem('Usage Stats', 'showUsageStats')
    .addToUi();
}

/**
 * Called when add-on homepage is triggered
 */
function onHomepage(e) {
  return showSidebar();
}

/**
 * Show the main AI assistant sidebar
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('ServalSheets AI')
    .setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Show settings dialog for API key configuration
 */
function showSettings() {
  const html = HtmlService.createHtmlOutputFromFile('Settings')
    .setWidth(400)
    .setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, 'ServalSheets Settings');
}

/**
 * Show usage statistics dialog
 */
function showUsageStats() {
  const html = HtmlService.createHtmlOutputFromFile('UsageStats')
    .setWidth(500)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, 'Usage Statistics');
}

/**
 * Get API key from user properties
 */
function getApiKey() {
  const props = PropertiesService.getUserProperties();
  return props.getProperty(CONFIG.API_KEY_PROPERTY);
}

/**
 * Save API key to user properties
 */
function saveApiKey(apiKey) {
  const props = PropertiesService.getUserProperties();
  props.setProperty(CONFIG.API_KEY_PROPERTY, apiKey);
  return { success: true };
}

/**
 * Get current plan tier
 */
function getPlan() {
  const props = PropertiesService.getUserProperties();
  return props.getProperty(CONFIG.PLAN_PROPERTY) || 'free';
}

// ============================================================================
// Session Management (MCP Protocol Requirement)
// ============================================================================

/**
 * Initialize MCP session and get session ID
 * Must be called before any tool calls
 */
function initializeSession() {
  try {
    const url = `${CONFIG.API_URL}/mcp`;
    const payload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: {
          name: 'workspace-addon',
          version: '1.0.0'
        }
      }
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Accept': 'application/json, text/event-stream',
        'X-MCP-Client': 'workspace-addon/1.0.0'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode === 200) {
      // Parse SSE response to extract session ID
      const text = response.getContentText();
      const lines = text.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('id: ')) {
          const sessionId = lines[i].substring(4).trim();
          // Save session ID
          const props = PropertiesService.getUserProperties();
          props.setProperty(CONFIG.SESSION_ID_PROPERTY, sessionId);
          Logger.log('MCP session initialized: ' + sessionId);
          return sessionId;
        }
      }
    }

    Logger.log('Failed to initialize MCP session: ' + statusCode);
    return null;
  } catch (error) {
    Logger.log('Error initializing MCP session: ' + error.message);
    return null;
  }
}

/**
 * Get current session ID (or create new session if needed)
 */
function getSessionId() {
  const props = PropertiesService.getUserProperties();
  let sessionId = props.getProperty(CONFIG.SESSION_ID_PROPERTY);

  if (!sessionId) {
    sessionId = initializeSession();
  }

  return sessionId;
}

/**
 * Clear session (force re-initialization on next call)
 */
function clearSession() {
  const props = PropertiesService.getUserProperties();
  props.deleteProperty(CONFIG.SESSION_ID_PROPERTY);
  return { success: true };
}

// ============================================================================
// MCP Tool Calls
// ============================================================================

/**
 * Core function to call ServalSheets API via MCP protocol
 * Uses JSON-RPC 2.0 format as required by /mcp endpoint
 */
function callServalSheets(tool, request) {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      success: false,
      error: {
        code: 'NO_API_KEY',
        message: 'API key not configured. Go to ServalSheets > Settings to add your API key.'
      }
    };
  }

  // Get or create MCP session
  let sessionId = getSessionId();

  if (!sessionId) {
    return {
      success: false,
      error: {
        code: 'SESSION_ERROR',
        message: 'Failed to establish MCP session'
      }
    };
  }

  try {
    // Use actual /mcp endpoint (MCP protocol over HTTP)
    const url = `${CONFIG.API_URL}/mcp`;

    // Use JSON-RPC 2.0 format required by MCP protocol
    const payload = {
      jsonrpc: '2.0',
      id: Date.now(),  // Unique request ID
      method: 'tools/call',
      params: {
        name: tool,
        arguments: { request }
      }
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-MCP-Client': 'workspace-addon/1.0.0',
        'Accept': 'application/json, text/event-stream',  // Required by MCP protocol
        'Mcp-Session-Id': sessionId  // Required for all tool calls
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const result = JSON.parse(response.getContentText());

    // Handle common errors
    if (statusCode === 401) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid API key. Please check your settings.'
        }
      };
    }

    if (statusCode === 400 && result.error?.code === 'INVALID_REQUEST') {
      // Session might be invalid - retry once with new session
      Logger.log('Session invalid, retrying with new session...');
      clearSession();
      sessionId = getSessionId();

      if (sessionId) {
        // Retry the request with new session
        options.headers['Mcp-Session-Id'] = sessionId;
        const retryResponse = UrlFetchApp.fetch(url, options);
        const retryStatusCode = retryResponse.getResponseCode();
        const retryResult = JSON.parse(retryResponse.getContentText());

        if (retryStatusCode !== 200) {
          return {
            success: false,
            error: {
              code: 'API_ERROR',
              message: retryResult.error?.message || `API returned status ${retryStatusCode}`
            }
          };
        }

        // Parse retry result
        if (retryResult.result && retryResult.result.content && retryResult.result.content[0]) {
          const content = retryResult.result.content[0];
          if (content.text) {
            try {
              return JSON.parse(content.text);
            } catch (e) {
              return { success: true, response: { text: content.text } };
            }
          }
        }
      }

      return {
        success: false,
        error: {
          code: 'SESSION_ERROR',
          message: 'Failed to establish valid session'
        }
      };
    }

    if (statusCode === 429) {
      return {
        success: false,
        error: {
          code: 'QUOTA_EXCEEDED',
          message: 'Monthly quota exceeded. Upgrade your plan at https://servalsheets.com/upgrade'
        }
      };
    }

    if (statusCode !== 200) {
      return {
        success: false,
        error: {
          code: 'API_ERROR',
          message: result.error?.message || `API returned status ${statusCode}`
        }
      };
    }

    // Handle JSON-RPC 2.0 response format
    // Response: { jsonrpc: '2.0', id: X, result: { content: [...] } }
    if (result.result && result.result.content && result.result.content[0]) {
      const content = result.result.content[0];

      if (content.text) {
        try {
          const parsed = JSON.parse(content.text);
          return parsed;
        } catch (e) {
          // Not JSON, return as-is
          return {
            success: true,
            response: { text: content.text }
          };
        }
      }
    }

    // Fallback: return result as-is
    return result.result || result;

  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: `Failed to connect to ServalSheets API: ${error.message}`
      }
    };
  }
}

/**
 * Get active spreadsheet info
 */
function getActiveSpreadsheetInfo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const range = ss.getActiveRange();

  return {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    sheetName: sheet.getName(),
    sheetId: sheet.getSheetId(),
    activeRange: range ? range.getA1Notation() : null
  };
}

// ============================================================================
// Tool Actions - Wrappers for MCP tools
// ============================================================================

/**
 * Read data from current spreadsheet
 */
function readData(range) {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_data', {
    action: 'read',
    spreadsheetId: info.spreadsheetId,
    range: range || info.activeRange || 'A1:Z100'
  });
}

/**
 * Write data to spreadsheet
 */
function writeData(range, values) {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_data', {
    action: 'write',
    spreadsheetId: info.spreadsheetId,
    range: range,
    values: values
  });
}

/**
 * AI-powered comprehensive analysis
 */
function analyzeData(prompt, range) {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_analyze', {
    action: 'comprehensive',
    spreadsheetId: info.spreadsheetId,
    range: range || info.activeRange || info.sheetName,
    prompt: prompt
  });
}

/**
 * Generate formula from natural language
 */
function generateFormula(description) {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_analyze', {
    action: 'generate_formula',
    spreadsheetId: info.spreadsheetId,
    range: info.activeRange,
    prompt: description
  });
}

/**
 * Detect patterns in data
 */
function detectPatterns(range) {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_analyze', {
    action: 'detect_patterns',
    spreadsheetId: info.spreadsheetId,
    range: range || info.activeRange || info.sheetName
  });
}

/**
 * Create chart
 */
function createChart(chartType, dataRange, title) {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_visualize', {
    action: 'chart_create',
    spreadsheetId: info.spreadsheetId,
    sheetName: info.sheetName,
    type: chartType,
    dataRange: dataRange,
    title: title
  });
}

/**
 * Suggest best chart type for data
 */
function suggestChart(dataRange) {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_visualize', {
    action: 'suggest_chart',
    spreadsheetId: info.spreadsheetId,
    range: dataRange || info.activeRange
  });
}

/**
 * Apply formatting
 */
function applyFormatting(range, format) {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_format', {
    action: 'set_format',
    spreadsheetId: info.spreadsheetId,
    range: range,
    format: format
  });
}

// ============================================================================
// Core Operations - Spreadsheet Management (sheets_core)
// ============================================================================

/**
 * Get spreadsheet metadata
 */
function getSpreadsheet() {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_core', {
    action: 'get',
    spreadsheetId: info.spreadsheetId
  });
}

/**
 * List all sheets/tabs in spreadsheet
 */
function listSheets() {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_core', {
    action: 'list_sheets',
    spreadsheetId: info.spreadsheetId
  });
}

/**
 * Add a new sheet/tab
 */
function addSheet(sheetName, rowCount, columnCount) {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_core', {
    action: 'add_sheet',
    spreadsheetId: info.spreadsheetId,
    title: sheetName,
    rowCount: rowCount || 1000,
    columnCount: columnCount || 26
  });
}

/**
 * Delete a sheet/tab by ID
 */
function deleteSheet(sheetId) {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_core', {
    action: 'delete_sheet',
    spreadsheetId: info.spreadsheetId,
    sheetId: sheetId
  });
}

/**
 * Copy sheet to another spreadsheet
 */
function copySheetTo(sheetId, destinationSpreadsheetId) {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_core', {
    action: 'copy_sheet_to',
    spreadsheetId: info.spreadsheetId,
    sheetId: sheetId,
    destinationSpreadsheetId: destinationSpreadsheetId
  });
}

// ============================================================================
// Dimension Operations - Rows & Columns (sheets_dimensions)
// ============================================================================

/**
 * Insert rows
 */
function insertRows(startIndex, count) {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_dimensions', {
    action: 'insert',
    spreadsheetId: info.spreadsheetId,
    sheetId: info.sheetId,
    dimension: 'ROWS',
    startIndex: startIndex,
    count: count || 1
  });
}

/**
 * Delete rows
 */
function deleteRows(startIndex, endIndex) {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_dimensions', {
    action: 'delete',
    spreadsheetId: info.spreadsheetId,
    sheetId: info.sheetId,
    dimension: 'ROWS',
    startIndex: startIndex,
    endIndex: endIndex
  });
}

/**
 * Insert columns
 */
function insertColumns(startIndex, count) {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_dimensions', {
    action: 'insert',
    spreadsheetId: info.spreadsheetId,
    sheetId: info.sheetId,
    dimension: 'COLUMNS',
    startIndex: startIndex,
    count: count || 1
  });
}

// ============================================================================
// Collaboration Operations (sheets_collaborate)
// ============================================================================

/**
 * Share spreadsheet with user
 */
function shareWithUser(email, role, sendNotification) {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_collaborate', {
    action: 'share_add',
    spreadsheetId: info.spreadsheetId,
    type: 'user',
    emailAddress: email,
    role: role || 'reader',
    sendNotification: sendNotification !== false
  });
}

/**
 * Add comment to range
 */
function addComment(range, text) {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_collaborate', {
    action: 'comment_add',
    spreadsheetId: info.spreadsheetId,
    content: text,
    anchor: range
  });
}

/**
 * List all comments
 */
function listComments() {
  const info = getActiveSpreadsheetInfo();

  return callServalSheets('sheets_collaborate', {
    action: 'comment_list',
    spreadsheetId: info.spreadsheetId
  });
}

// ============================================================================
// Usage Statistics & Testing
// ============================================================================

/**
 * Get usage statistics
 */
function getUsageStats() {
  // This would call a billing endpoint
  // For now, return placeholder
  return {
    success: true,
    stats: {
      plan: getPlan(),
      operationsThisMonth: 0,
      limit: 1000,
      percentUsed: 0
    }
  };
}

/**
 * Test API connection
 */
function testConnection() {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      success: false,
      message: 'No API key configured'
    };
  }

  try {
    const url = `${CONFIG.API_URL}/health`;
    const options = {
      method: 'get',
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode === 200) {
      return {
        success: true,
        message: 'Connected to ServalSheets API successfully!'
      };
    } else {
      return {
        success: false,
        message: `API returned status ${statusCode}`
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Connection failed: ${error.message}. Make sure your local server is running on ${CONFIG.API_URL}`
    };
  }
}

// ==================== PHASE 3.1: Contextual Tool Suggestions ====================

/**
 * Detects context from user's current selection and suggests relevant tools
 * @returns {Object} Context object with suggestions
 */
function detectContext() {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const range = SpreadsheetApp.getActiveRange();

    if (!range) {
      return {
        hasSelection: false,
        suggestions: [
          { action: 'analyze', label: '📊 Analyze Sheet', description: 'Get insights from your data' },
          { action: 'listSheets', label: '📋 List All Sheets', description: 'View all sheets in this spreadsheet' }
        ]
      };
    }

    const values = range.getValues();
    const rowCount = values.length;
    const colCount = values[0] ? values[0].length : 0;

    // Sample first 10 rows to detect types
    const sampleSize = Math.min(10, rowCount);
    let hasNumbers = false;
    let hasDates = false;
    let hasText = false;
    let hasFormulas = false;
    let emptyCount = 0;
    let totalCells = 0;

    for (let i = 0; i < sampleSize; i++) {
      for (let j = 0; j < colCount; j++) {
        totalCells++;
        const cell = values[i][j];

        if (cell === '' || cell === null || cell === undefined) {
          emptyCount++;
        } else if (typeof cell === 'number') {
          hasNumbers = true;
        } else if (cell instanceof Date) {
          hasDates = true;
        } else if (typeof cell === 'string') {
          hasText = true;
          if (cell.startsWith('=')) {
            hasFormulas = true;
          }
        }
      }
    }

    const emptyCellPercent = (emptyCount / totalCells) * 100;
    const isLargeRange = rowCount > 100 || colCount > 10;
    const isSmallRange = rowCount <= 5 && colCount <= 5;

    // Build context-aware suggestions
    const suggestions = [];

    // Large dataset suggestions
    if (isLargeRange) {
      suggestions.push({
        action: 'analyze',
        label: '📊 Analyze Large Dataset',
        description: `Analyze ${rowCount} rows × ${colCount} columns`
      });

      if (hasNumbers) {
        suggestions.push({
          action: 'patterns',
          label: '🔍 Find Patterns',
          description: 'Detect trends and anomalies'
        });
      }
    }

    // Numeric data suggestions
    if (hasNumbers && rowCount > 2) {
      suggestions.push({
        action: 'chart',
        label: '📈 Create Chart',
        description: 'Visualize numeric data'
      });

      if (!hasFormulas && rowCount > 1) {
        suggestions.push({
          action: 'formula',
          label: '🔢 Add Formulas',
          description: 'Generate calculations'
        });
      }
    }

    // Date column suggestions
    if (hasDates) {
      suggestions.push({
        action: 'timeline',
        label: '📅 Timeline Chart',
        description: 'Visualize data over time'
      });
    }

    // Data quality suggestions
    if (emptyCellPercent > 10) {
      suggestions.push({
        action: 'quality',
        label: '✅ Check Data Quality',
        description: `${emptyCellPercent.toFixed(0)}% empty cells detected`
      });
    }

    // Formatting suggestions for small ranges
    if (isSmallRange && hasNumbers) {
      suggestions.push({
        action: 'format',
        label: '🎨 Format Cells',
        description: 'Apply number formatting'
      });
    }

    // Text data suggestions
    if (hasText && !hasNumbers && rowCount > 5) {
      suggestions.push({
        action: 'analyze',
        label: '📝 Analyze Text',
        description: 'Extract insights from text'
      });
    }

    // Default suggestions if none matched
    if (suggestions.length === 0) {
      suggestions.push({
        action: 'analyze',
        label: '📊 Analyze Selection',
        description: 'Get AI insights'
      });
      suggestions.push({
        action: 'formula',
        label: '🔢 Generate Formula',
        description: 'Create custom formulas'
      });
    }

    return {
      hasSelection: true,
      range: range.getA1Notation(),
      size: {
        rows: rowCount,
        cols: colCount
      },
      types: {
        hasNumbers,
        hasDates,
        hasText,
        hasFormulas
      },
      metrics: {
        emptyCellPercent: emptyCellPercent.toFixed(1),
        isLargeRange,
        isSmallRange
      },
      suggestions: suggestions.slice(0, 4) // Limit to 4 suggestions
    };

  } catch (error) {
    Logger.log('Error detecting context: ' + error.message);
    return {
      hasSelection: false,
      error: error.message,
      suggestions: []
    };
  }
}

// ==================== PHASE 3.2: Batch Operations ====================

/**
 * Executes multiple operations atomically using transactions
 * @param {Array<Object>} operations - Array of { tool, action, params, label }
 * @returns {Object} Batch execution result
 */
function executeBatch(operations) {
  const info = getActiveSpreadsheetInfo();
  const results = [];
  let transactionId = null;

  try {
    // Start transaction
    const txStart = callServalSheets('sheets_transaction', {
      action: 'begin',
      spreadsheetId: info.spreadsheetId
    });

    if (!txStart.success) {
      return {
        success: false,
        error: {
          code: 'TRANSACTION_START_FAILED',
          message: 'Failed to start transaction: ' + (txStart.error?.message || 'Unknown error')
        }
      };
    }

    transactionId = txStart.response?.transactionId;
    Logger.log('Transaction started: ' + transactionId);

    // Execute each operation in sequence
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      Logger.log(`Executing operation ${i + 1}/${operations.length}: ${op.label}`);

      try {
        // Build request with operation parameters
        const request = {
          action: op.action,
          spreadsheetId: info.spreadsheetId,
          ...op.params
        };

        // Add transaction ID to request
        if (transactionId) {
          request.transactionId = transactionId;
        }

        // Execute operation
        const result = callServalSheets(op.tool, request);

        if (result.success) {
          results.push({
            operation: op.label,
            status: 'success',
            result: result.response
          });
        } else {
          // Operation failed - trigger rollback
          throw new Error(`Operation failed: ${result.error?.message || 'Unknown error'}`);
        }

      } catch (opError) {
        Logger.log(`Operation ${i + 1} failed: ${opError.message}`);
        throw opError; // Propagate to outer catch for rollback
      }
    }

    // All operations succeeded - commit transaction
    const txCommit = callServalSheets('sheets_transaction', {
      action: 'commit',
      spreadsheetId: info.spreadsheetId,
      transactionId: transactionId
    });

    if (!txCommit.success) {
      throw new Error('Failed to commit transaction: ' + (txCommit.error?.message || 'Unknown error'));
    }

    Logger.log('Transaction committed successfully');

    return {
      success: true,
      response: {
        message: `Successfully executed ${operations.length} operation(s)`,
        results: results,
        transactionId: transactionId
      }
    };

  } catch (error) {
    Logger.log('Batch execution failed: ' + error.message);

    // Attempt rollback if transaction was started
    if (transactionId) {
      Logger.log('Rolling back transaction: ' + transactionId);
      try {
        const txRollback = callServalSheets('sheets_transaction', {
          action: 'rollback',
          spreadsheetId: info.spreadsheetId,
          transactionId: transactionId
        });

        if (txRollback.success) {
          Logger.log('Transaction rolled back successfully');
        } else {
          Logger.log('Rollback failed: ' + (txRollback.error?.message || 'Unknown error'));
        }
      } catch (rollbackError) {
        Logger.log('Rollback error: ' + rollbackError.message);
      }
    }

    return {
      success: false,
      error: {
        code: 'BATCH_EXECUTION_FAILED',
        message: error.message,
        completedOperations: results.length,
        totalOperations: operations.length
      }
    };
  }
}

/**
 * Validates a batch operation before adding to queue
 * @param {Object} operation - Operation to validate
 * @returns {Object} Validation result
 */
function validateBatchOperation(operation) {
  // Check required fields
  if (!operation.tool || !operation.action) {
    return {
      valid: false,
      error: 'Operation must have tool and action'
    };
  }

  // Check tool exists (basic validation)
  const validTools = [
    'sheets_data', 'sheets_format', 'sheets_dimensions', 'sheets_core',
    'sheets_collaborate', 'sheets_visualize', 'sheets_analyze'
  ];

  if (!validTools.includes(operation.tool)) {
    return {
      valid: false,
      error: `Unknown tool: ${operation.tool}`
    };
  }

  return {
    valid: true
  };
}
