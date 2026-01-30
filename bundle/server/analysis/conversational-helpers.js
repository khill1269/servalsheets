/**
 * Conversational Analysis Helpers - Natural Language Query
 *
 * Enables natural language queries over spreadsheet data using MCP Sampling.
 * Supports multi-turn conversations, context awareness, and intelligent query parsing.
 *
 * Examples:
 * - "What was Q4 revenue by region?"
 * - "Show me the top 5 customers by sales"
 * - "Are there any anomalies in the expense data?"
 * - "Compare this month's metrics to last month"
 *
 * Part of Ultimate Analysis Tool - Natural Language Query capability
 */
// ============================================================================
// Query Intent Detection
// ============================================================================
/**
 * Detect the intent of a natural language query
 */
export function detectQueryIntent(query, schema) {
    const columnNames = schema.map((col) => col.columnName.toLowerCase());
    // Pattern matching for different intents
    const patterns = {
        AGGREGATE: /\b(sum|total|average|mean|count|max|min|median)\b/i,
        FILTER: /\b(where|with|having|only|exclude|include|filter)\b/i,
        COMPARE: /\b(compare|versus|vs|difference|between|against)\b/i,
        TREND: /\b(trend|over time|by month|by quarter|by year|growth|change)\b/i,
        ANOMALY: /\b(anomaly|outlier|unusual|strange|weird|odd|spike|drop)\b/i,
        TOP_N: /\b(top|bottom|best|worst|highest|lowest|first|last)\s+\d+/i,
        PIVOT: /\b(by|per|for each|group by|breakdown)\b/i,
        SEARCH: /\b(find|search|look for|show me|get|fetch)\b/i,
        EXPLAIN: /\b(why|how|what|explain|tell me about|describe)\b/i,
    };
    // Score each intent
    const scores = {};
    for (const [intent, pattern] of Object.entries(patterns)) {
        scores[intent] = pattern.test(query) ? 1 : 0;
    }
    // Find highest scoring intent
    const maxScore = Math.max(...Object.values(scores));
    const detectedIntent = Object.keys(scores).find((key) => scores[key] === maxScore) ||
        'EXPLAIN';
    // Extract entities
    const entities = {
        columns: extractColumns(query, columnNames),
        values: extractValues(query),
        operations: extractOperations(query),
        timeframes: extractTimeframes(query),
    };
    // Calculate confidence based on entity extraction
    let confidence = maxScore > 0 ? 60 : 40;
    if (entities.columns.length > 0)
        confidence += 20;
    if (entities.operations.length > 0)
        confidence += 10;
    if (entities.timeframes && entities.timeframes.length > 0)
        confidence += 10;
    return {
        type: detectedIntent,
        confidence: Math.min(confidence, 100),
        entities,
    };
}
/**
 * Extract column references from query
 */
function extractColumns(query, columnNames) {
    const lowerQuery = query.toLowerCase();
    const found = [];
    for (const colName of columnNames) {
        if (lowerQuery.includes(colName)) {
            found.push(colName);
        }
    }
    return found;
}
/**
 * Extract values/literals from query
 */
function extractValues(query) {
    const values = [];
    // Extract quoted strings
    const quotedPattern = /"([^"]+)"|'([^']+)'/g;
    const quotedMatches = Array.from(query.matchAll(quotedPattern));
    values.push(...quotedMatches.map((m) => m[1] ?? m[2]).filter((v) => v !== undefined));
    // Extract numbers
    const numberPattern = /\b\d+(?:\.\d+)?\b/g;
    const numberMatches = Array.from(query.matchAll(numberPattern));
    values.push(...numberMatches.map((m) => m[0]));
    return values;
}
/**
 * Extract operations (sum, average, etc.)
 */
function extractOperations(query) {
    const operations = ['sum', 'average', 'count', 'max', 'min', 'median', 'filter', 'sort', 'group'];
    const lowerQuery = query.toLowerCase();
    return operations.filter((op) => lowerQuery.includes(op));
}
/**
 * Extract timeframe references
 */
function extractTimeframes(query) {
    const timeframePatterns = [
        /\b(q1|q2|q3|q4|quarter\s+\d)\b/gi,
        /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
        /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/gi,
        /\b(20\d{2})\b/g,
        /\b(this|last|next)\s+(week|month|quarter|year)\b/gi,
    ];
    const timeframes = [];
    for (const pattern of timeframePatterns) {
        const matches = Array.from(query.matchAll(pattern));
        timeframes.push(...matches.map((m) => m[0]));
    }
    return timeframes.length > 0 ? timeframes : undefined;
}
// ============================================================================
// Sampling Request Builder for NL Queries
// ============================================================================
/**
 * Build an MCP Sampling request for natural language query
 */
export function buildNLQuerySamplingRequest(query, context) {
    const intent = detectQueryIntent(query, context.schema);
    // Build context description
    const schemaDescription = context.schema
        .map((col) => `- ${col.columnName} (${col.inferredType}, ${col.cardinality} unique values)`)
        .join('\n');
    const sampleData = context.dataSnapshot
        ? JSON.stringify(context.dataSnapshot.sampleRows.slice(0, 10), null, 2)
        : 'No sample data available';
    // Build conversation history
    const conversationHistory = context.previousQueries
        .slice(-3) // Last 3 queries for context
        .map((q) => `Q: ${q.query}\nA: ${q.response}`)
        .join('\n\n');
    const systemPrompt = `You are an expert data analyst assistant helping users query and understand their Google Sheets data.

**Current Spreadsheet Context:**
- Sheet: ${context.sheetName}
- Columns: ${context.schema.length}
- Rows: ${context.dataSnapshot?.rowCount || 'Unknown'}

**Schema:**
${schemaDescription}

**Sample Data (first 10 rows):**
${sampleData}

${conversationHistory ? `**Conversation History:**\n${conversationHistory}\n` : ''}

**Your task:**
1. Understand the user's question: "${query}"
2. Analyze the data based on the provided context
3. Provide a clear, concise answer
4. If applicable, suggest a visualization
5. Offer relevant follow-up questions

**Detected Intent:** ${intent.type} (confidence: ${intent.confidence}%)
**Entities:** ${JSON.stringify(intent.entities, null, 2)}

Respond in JSON format:
{
  "answer": "Clear answer to the user's question",
  "data": {
    "headers": ["col1", "col2"],
    "rows": [[val1, val2], ...]
  },
  "visualizationSuggestion": {
    "chartType": "LINE|BAR|PIE|SCATTER",
    "reasoning": "Why this chart type"
  },
  "followUpQuestions": [
    "Related question 1?",
    "Related question 2?"
  ]
}`;
    const messages = [
        {
            role: 'user',
            content: {
                type: 'text',
                text: query,
            },
        },
    ];
    return {
        messages,
        systemPrompt,
        maxTokens: 2048,
    };
}
// ============================================================================
// Multi-turn Conversation Management
// ============================================================================
/**
 * Add query to conversation context
 */
export function addToConversationHistory(context, query, response) {
    return {
        ...context,
        previousQueries: [
            ...context.previousQueries,
            {
                query,
                response,
                timestamp: Date.now(),
            },
        ].slice(-10), // Keep last 10 queries
    };
}
/**
 * Check if query references previous conversation
 */
export function referencesHistory(query) {
    const historyPatterns = [
        /\b(that|it|this|those|these|them)\b/i,
        /\b(same|previous|before|earlier|above)\b/i,
        /\b(what about|how about|and)\b/i,
    ];
    return historyPatterns.some((pattern) => pattern.test(query));
}
/**
 * Resolve references to previous queries
 */
export function resolveHistoryReferences(query, context) {
    if (context.previousQueries.length === 0)
        return query;
    const lastQuery = context.previousQueries[context.previousQueries.length - 1];
    if (!lastQuery)
        return query;
    // Simple resolution: append context if query is too short or has references
    if (query.length < 20 || referencesHistory(query)) {
        return `Context: Previous query was "${lastQuery.query}". Current query: ${query}`;
    }
    return query;
}
// ============================================================================
// Query Validation
// ============================================================================
/**
 * Validate if query can be answered with available data
 */
export function validateQuery(query, context) {
    const intent = detectQueryIntent(query, context.schema);
    // Check if any columns were detected
    if (intent.entities.columns.length === 0 && intent.type !== 'EXPLAIN') {
        return {
            valid: false,
            reason: 'Could not identify any column references in your query. Available columns: ' +
                context.schema.map((c) => c.columnName).join(', '),
        };
    }
    // Check if data snapshot is available for data queries
    if (!context.dataSnapshot && ['AGGREGATE', 'FILTER', 'COMPARE', 'TOP_N'].includes(intent.type)) {
        return {
            valid: false,
            reason: 'No data available to answer this query. Please provide data context.',
        };
    }
    return { valid: true };
}
// ============================================================================
// Quick Insights Generation
// ============================================================================
/**
 * Generate quick insights from data for conversational context
 */
export function generateQuickInsights(data, schema) {
    const insights = [];
    // Total rows
    insights.push(`Dataset contains ${data.length} rows`);
    // Numeric columns summary
    const numericCols = schema.filter((col) => col.inferredType === 'number');
    if (numericCols.length > 0) {
        insights.push(`${numericCols.length} numeric columns available for calculations`);
    }
    // High cardinality columns (potential categories)
    const categoricalCols = schema.filter((col) => col.cardinality > 1 && col.cardinality < data.length * 0.5);
    if (categoricalCols.length > 0) {
        insights.push(`Categorical columns: ${categoricalCols.map((c) => c.columnName).join(', ')}`);
    }
    // Date columns (time series potential)
    const dateCols = schema.filter((col) => col.inferredType === 'date');
    if (dateCols.length > 0) {
        insights.push(`Time series analysis available for: ${dateCols.map((c) => c.columnName).join(', ')}`);
    }
    return insights;
}
//# sourceMappingURL=conversational-helpers.js.map