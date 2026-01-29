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
  PLAN_PROPERTY: 'SERVALSHEETS_PLAN'
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

/**
 * Core function to call ServalSheets API
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

  try {
    const url = `${CONFIG.API_URL}/api/v1/mcp/call-tool`;
    const payload = {
      name: tool,
      arguments: { request }
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-MCP-Client': 'workspace-addon/1.0.0'
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

    // Extract response from MCP envelope
    if (result.content && result.content[0]) {
      // Parse structured content if available
      if (result.content[0].text) {
        try {
          const parsed = JSON.parse(result.content[0].text);
          return parsed;
        } catch (e) {
          // Not JSON, return as-is
          return {
            success: true,
            response: { text: result.content[0].text }
          };
        }
      }
    }

    return result;

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
