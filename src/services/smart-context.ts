/**
 * ServalSheets - Smart Context Provider
 *
 * Provides Claude with relevant context and knowledge based on detected intent.
 *
 * When Claude doesn't know what to do, it can fetch context to help decide:
 * - Templates for creating things
 * - Formulas for calculations
 * - Patterns for common workflows
 * - Examples for similar requests
 *
 * @module services/smart-context
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ============================================================================
// TYPES
// ============================================================================

export interface ContextQuery {
  /** User's request (natural language) */
  userRequest: string;
  /** Detected intent category */
  intent?: IntentCategory;
  /** Current spreadsheet context */
  spreadsheetContext?: {
    spreadsheetId: string;
    title: string;
    sheetNames: string[];
  };
}

export type IntentCategory =
  | 'create_spreadsheet'
  | 'create_crm'
  | 'create_budget'
  | 'create_tracker'
  | 'create_inventory'
  | 'create_dashboard'
  | 'read_data'
  | 'write_data'
  | 'analyze_data'
  | 'format_data'
  | 'create_chart'
  | 'add_formula'
  | 'validate_data'
  | 'share_spreadsheet'
  | 'undo_operation'
  | 'unknown';

export interface ContextResponse {
  /** Detected intent */
  intent: IntentCategory;
  /** Confidence 0-1 */
  confidence: number;
  /** Relevant knowledge */
  knowledge: {
    /** Template if creating something */
    template?: unknown;
    /** Relevant formulas */
    formulas?: Array<{
      name: string;
      syntax: string;
      example: string;
      description: string;
    }>;
    /** Workflow steps */
    workflow?: string[];
    /** Example requests and responses */
    examples?: Array<{
      request: string;
      toolCalls: Array<{
        tool: string;
        action: string;
        params: Record<string, unknown>;
      }>;
    }>;
    /** Tips and best practices */
    tips?: string[];
  };
  /** Suggested tool sequence */
  suggestedTools: string[];
  /** Questions to ask user for clarification */
  clarifyingQuestions?: string[];
}

// ============================================================================
// INTENT DETECTION
// ============================================================================

/**
 * Patterns for detecting user intent
 */
const INTENT_PATTERNS: Array<{
  pattern: RegExp;
  intent: IntentCategory;
  confidence: number;
}> = [
  // Creation intents
  {
    pattern: /\b(create|make|build|set\s*up|start)\s+(a\s+)?crm\b/i,
    intent: 'create_crm',
    confidence: 0.95,
  },
  {
    pattern: /\b(create|make|build|set\s*up|start)\s+(a\s+)?budget\b/i,
    intent: 'create_budget',
    confidence: 0.95,
  },
  {
    pattern: /\b(create|make|build|set\s*up|start)\s+(a\s+)?(tracker|tracking)\b/i,
    intent: 'create_tracker',
    confidence: 0.9,
  },
  {
    pattern: /\b(create|make|build|set\s*up|start)\s+(a\s+)?inventory\b/i,
    intent: 'create_inventory',
    confidence: 0.95,
  },
  {
    pattern: /\b(create|make|build|set\s*up|start)\s+(a\s+)?dashboard\b/i,
    intent: 'create_dashboard',
    confidence: 0.9,
  },
  {
    pattern: /\b(create|make|build|set\s*up|start)\s+(a\s+)?(new\s+)?spreadsheet\b/i,
    intent: 'create_spreadsheet',
    confidence: 0.85,
  },

  // Data operations
  {
    pattern: /\b(show|display|read|get|see|look|view|pull\s*up)\b.*\bdata\b/i,
    intent: 'read_data',
    confidence: 0.85,
  },
  {
    pattern: /\b(add|insert|write|put|enter|update|change)\b.*\b(data|row|cell|value)/i,
    intent: 'write_data',
    confidence: 0.85,
  },
  {
    pattern: /\b(analyze|check|review|audit|quality)\b/i,
    intent: 'analyze_data',
    confidence: 0.8,
  },
  {
    pattern: /\b(format|style|color|bold|highlight|make\s*it\s*look)\b/i,
    intent: 'format_data',
    confidence: 0.8,
  },

  // Charts and formulas
  {
    pattern: /\b(chart|graph|visuali[sz]e|plot)\b/i,
    intent: 'create_chart',
    confidence: 0.9,
  },
  {
    pattern: /\b(formula|calculate|sum|average|count|total)\b/i,
    intent: 'add_formula',
    confidence: 0.85,
  },
  {
    pattern: /\b(validate|validation|dropdown|restrict)\b/i,
    intent: 'validate_data',
    confidence: 0.85,
  },

  // Sharing and undo
  {
    pattern: /\b(share|permission|access|collaborat)/i,
    intent: 'share_spreadsheet',
    confidence: 0.9,
  },
  {
    pattern: /\b(undo|revert|rollback|restore|go\s*back)\b/i,
    intent: 'undo_operation',
    confidence: 0.9,
  },
];

/**
 * Detect intent from user request
 */
export function detectIntent(request: string): {
  intent: IntentCategory;
  confidence: number;
} {
  const lowerRequest = request.toLowerCase();

  for (const { pattern, intent, confidence } of INTENT_PATTERNS) {
    if (pattern.test(lowerRequest)) {
      return { intent, confidence };
    }
  }

  return { intent: 'unknown', confidence: 0.5 };
}

// ============================================================================
// KNOWLEDGE LOADING
// ============================================================================

/**
 * Load knowledge files from the knowledge directory
 */
class KnowledgeLoader {
  private knowledgePath: string;
  private cache = new Map<string, unknown>();

  constructor() {
    // Find knowledge directory relative to this file
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    this.knowledgePath = join(__dirname, '..', 'knowledge');
  }

  /**
   * Load a JSON knowledge file
   */
  loadJson(filename: string): unknown {
    if (this.cache.has(filename)) {
      return this.cache.get(filename);
    }

    const filePath = join(this.knowledgePath, filename);
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      this.cache.set(filename, data);
      return data;
    } catch (error) {
      console.error(`Failed to load knowledge file ${filename}:`, error);
      return null;
    }
  }

  /**
   * Load template for a specific use case
   */
  loadTemplate(useCase: string): unknown {
    const templates = this.loadJson(`templates/${useCase}.json`);
    return templates;
  }

  /**
   * Load formulas for a category
   */
  loadFormulas(category: string): unknown {
    return this.loadJson(`formulas/${category}.json`);
  }

  /**
   * Load workflow patterns
   */
  loadWorkflowPatterns(): unknown {
    return this.loadJson('workflow-patterns.json');
  }

  /**
   * Load user intent examples
   */
  loadIntentExamples(): unknown {
    return this.loadJson('user-intent-examples.json');
  }

  /**
   * Load natural language guide
   */
  loadNaturalLanguageGuide(): unknown {
    return this.loadJson('natural-language-guide.json');
  }
}

const knowledgeLoader = new KnowledgeLoader();

// ============================================================================
// CONTEXT PROVIDER
// ============================================================================

/**
 * Get relevant context for a user request
 */
export function getSmartContext(query: ContextQuery): ContextResponse {
  // Detect intent if not provided
  const { intent, confidence } = query.intent
    ? { intent: query.intent, confidence: 0.9 }
    : detectIntent(query.userRequest);

  const response: ContextResponse = {
    intent,
    confidence,
    knowledge: {},
    suggestedTools: [],
  };

  // Build context based on intent
  switch (intent) {
    case 'create_crm':
      response.knowledge.template = knowledgeLoader.loadTemplate('crm');
      response.knowledge.workflow = [
        '1. Create spreadsheet with sheets: Contacts, Companies, Deals, Activities',
        '2. Set up headers for each sheet',
        '3. Add data validation (dropdowns for status, stage, etc.)',
        '4. Add formulas for calculated fields (deal value, days since contact)',
        '5. Format headers and add conditional formatting',
        '6. Create dashboard with charts',
        '7. Protect formula cells',
      ];
      response.suggestedTools = [
        'sheets_spreadsheet',
        'sheets_values',
        'sheets_rules',
        'sheets_format',
        'sheets_charts',
        'sheets_advanced',
      ];
      response.knowledge.tips = [
        'Use sheets_transaction to batch all setup operations',
        'Create a Settings sheet for dropdown values',
        'Use emoji in sheet names for visual organization (📊 Dashboard, 👥 Contacts)',
      ];
      break;

    case 'create_budget':
      response.knowledge.template = knowledgeLoader.loadTemplate('finance');
      response.knowledge.formulas = [
        {
          name: 'SUM',
          syntax: '=SUM(range)',
          example: '=SUM(B2:B100)',
          description: 'Total expenses',
        },
        {
          name: 'SUMIF',
          syntax: '=SUMIF(range, criteria, sum_range)',
          example: '=SUMIF(A:A,"Food",B:B)',
          description: 'Sum by category',
        },
        {
          name: 'Budget remaining',
          syntax: '=budget-actual',
          example: '=C2-D2',
          description: 'Track remaining budget',
        },
      ];
      response.suggestedTools = [
        'sheets_spreadsheet',
        'sheets_values',
        'sheets_format',
        'sheets_rules',
        'sheets_charts',
      ];
      break;

    case 'create_tracker':
    case 'create_inventory':
      response.knowledge.template = knowledgeLoader.loadTemplate('inventory');
      response.suggestedTools = [
        'sheets_spreadsheet',
        'sheets_values',
        'sheets_rules',
        'sheets_format',
      ];
      break;

    case 'read_data':
      response.suggestedTools = ['sheets_values'];
      response.knowledge.examples = [
        {
          request: "Show me what's in the spreadsheet",
          toolCalls: [
            {
              tool: 'sheets_values',
              action: 'read',
              params: { range: 'Sheet1!A1:Z100' },
            },
          ],
        },
      ];
      break;

    case 'write_data':
      response.suggestedTools = ['sheets_values', 'sheets_session'];
      response.knowledge.tips = [
        'Always use dryRun first for large writes',
        'Use sheets_session to record the operation for undo',
        'Use batch_write for multiple ranges',
      ];
      break;

    case 'analyze_data':
      response.suggestedTools = ['sheets_analysis', 'sheets_analyze'];
      response.knowledge.workflow = [
        "1. Use sheets_analysis action='data_quality' for quick checks",
        "2. Use sheets_analysis action='statistics' for numeric analysis",
        '3. Use sheets_analyze for AI-powered pattern detection',
      ];
      break;

    case 'format_data':
      response.suggestedTools = ['sheets_format', 'sheets_rules'];
      response.knowledge.examples = [
        {
          request: 'Make the headers bold',
          toolCalls: [
            {
              tool: 'sheets_format',
              action: 'set_font',
              params: { range: '1:1', bold: true },
            },
          ],
        },
      ];
      break;

    case 'create_chart':
      response.suggestedTools = ['sheets_charts'];
      response.knowledge.tips = [
        "Use sheets_analyze action='suggest_chart' to get AI recommendations",
        'Ensure data has headers for automatic series naming',
      ];
      break;

    case 'add_formula':
      response.knowledge.formulas = [
        {
          name: 'SUM',
          syntax: '=SUM(range)',
          example: '=SUM(A1:A100)',
          description: 'Add values',
        },
        {
          name: 'AVERAGE',
          syntax: '=AVERAGE(range)',
          example: '=AVERAGE(B2:B100)',
          description: 'Calculate mean',
        },
        {
          name: 'VLOOKUP',
          syntax: '=VLOOKUP(key, range, col, false)',
          example: '=VLOOKUP(A2,Data!A:C,2,FALSE)',
          description: 'Look up value',
        },
        {
          name: 'IF',
          syntax: '=IF(condition, true_value, false_value)',
          example: '=IF(A1>100,"High","Low")',
          description: 'Conditional logic',
        },
        {
          name: 'COUNTIF',
          syntax: '=COUNTIF(range, criteria)',
          example: '=COUNTIF(A:A,"Yes")',
          description: 'Count matches',
        },
      ];
      response.suggestedTools = ['sheets_values', 'sheets_analyze'];
      response.knowledge.tips = [
        "Use sheets_analyze action='generate_formula' for complex formulas",
        'Write formulas as text values starting with =',
      ];
      break;

    case 'undo_operation':
      response.suggestedTools = ['sheets_session', 'sheets_history', 'sheets_versions'];
      response.knowledge.workflow = [
        "1. Use sheets_session action='find_by_reference' to find the operation",
        "2. If operation has snapshotId, use sheets_versions action='restore'",
        "3. Otherwise use sheets_history action='rollback'",
      ];
      break;

    default:
      response.clarifyingQuestions = [
        'What would you like to do with the spreadsheet?',
        'Are you trying to create something new or work with existing data?',
      ];
  }

  return response;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const SmartContext = {
  detectIntent,
  getSmartContext,
  KnowledgeLoader,
  knowledgeLoader,
  INTENT_PATTERNS,
};
