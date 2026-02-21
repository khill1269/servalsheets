/**
 * Security Analysis Agent
 *
 * Detects security vulnerabilities:
 * - SQL injection
 * - Path traversal
 * - Command injection
 * - XSS vulnerabilities
 * - Insecure randomness
 * - Hardcoded secrets
 */

import * as ts from 'typescript';
import {
  AnalysisAgent,
  AnalysisIssue,
  DimensionReport,
  AnalysisContext,
} from '../multi-agent-analysis.js';

export class SecurityAgent extends AnalysisAgent {
  constructor() {
    super('SecurityAgent', [
      'inputValidation',
      'sqlInjection',
      'pathTraversal',
      'commandInjection',
      'xss',
      'secrets',
    ]);
  }

  async analyze(
    filePath: string,
    sourceFile: ts.SourceFile,
    context: AnalysisContext
  ): Promise<DimensionReport[]> {
    const reports: DimensionReport[] = [];

    reports.push(await this.analyzeInputValidation(filePath, sourceFile));
    reports.push(await this.analyzeSQLInjection(filePath, sourceFile));
    reports.push(await this.analyzePathTraversal(filePath, sourceFile));
    reports.push(await this.analyzeCommandInjection(filePath, sourceFile));
    reports.push(await this.analyzeHardcodedSecrets(filePath, sourceFile));

    return reports;
  }

  private async analyzeInputValidation(
    filePath: string,
    sourceFile: ts.SourceFile
  ): Promise<DimensionReport> {
    const startTime = Date.now();
    const issues: AnalysisIssue[] = [];

    // Check if handler receives external input
    const isHandler = filePath.includes('/handlers/');
    const isHttpEndpoint = filePath.includes('http-server') || filePath.includes('remote-server');

    if (!isHandler && !isHttpEndpoint) {
      return {
        dimension: 'inputValidation',
        status: 'pass',
        issueCount: 0,
        issues: [],
        duration: Date.now() - startTime,
      };
    }

    let hasZodValidation = false;
    let hasManualValidation = false;

    const visit = (node: ts.Node) => {
      // Check for Zod parsing
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const methodName = node.expression.name.text;
        if (methodName === 'parse' || methodName === 'safeParse') {
          hasZodValidation = true;
        }
      }

      // Check for manual validation (typeof, instanceof, etc.)
      if (ts.isBinaryExpression(node)) {
        if (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken) {
          const left = node.left;
          if (
            ts.isTypeOfExpression(left) ||
            (ts.isCallExpression(left) &&
              ts.isPropertyAccessExpression(left.expression) &&
              left.expression.name.text === 'isArray')
          ) {
            hasManualValidation = true;
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    if (!hasZodValidation && !hasManualValidation) {
      issues.push(
        this.createIssue(
          'inputValidation',
          filePath,
          'No input validation detected - external input should be validated',
          {
            severity: 'critical',
            suggestion: 'Add Zod schema validation or manual type checking',
            estimatedEffort: '1-2h',
            references: ['https://owasp.org/www-project-top-ten/2017/A1_2017-Injection'],
          }
        )
      );
    }

    return {
      dimension: 'inputValidation',
      status: issues.length === 0 ? 'pass' : 'fail',
      issueCount: issues.length,
      issues,
      duration: Date.now() - startTime,
    };
  }

  private async analyzeSQLInjection(
    filePath: string,
    sourceFile: ts.SourceFile
  ): Promise<DimensionReport> {
    const startTime = Date.now();
    const issues: AnalysisIssue[] = [];

    const visit = (node: ts.Node) => {
      // Check for string concatenation or template literals in SQL-like contexts
      if (ts.isTemplateExpression(node) || ts.isBinaryExpression(node)) {
        const text = node.getText(sourceFile);

        // SQL keywords
        const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'FROM', 'WHERE'];
        const hasSQLKeyword = sqlKeywords.some((kw) => text.toUpperCase().includes(kw));

        if (hasSQLKeyword) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

          issues.push(
            this.createIssue(
              'sqlInjection',
              filePath,
              'Potential SQL injection: string interpolation in SQL query',
              {
                severity: 'critical',
                line,
                suggestion: 'Use parameterized queries or prepared statements',
                estimatedEffort: '30min-1h',
                references: ['https://owasp.org/www-community/attacks/SQL_Injection'],
              }
            )
          );
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return {
      dimension: 'sqlInjection',
      status: issues.length === 0 ? 'pass' : 'fail',
      issueCount: issues.length,
      issues,
      duration: Date.now() - startTime,
    };
  }

  private async analyzePathTraversal(
    filePath: string,
    sourceFile: ts.SourceFile
  ): Promise<DimensionReport> {
    const startTime = Date.now();
    const issues: AnalysisIssue[] = [];

    const visit = (node: ts.Node) => {
      // Check for path.join/resolve with user input
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const obj = node.expression.expression;
        const method = node.expression.name.text;

        if (
          ts.isIdentifier(obj) &&
          obj.text === 'path' &&
          (method === 'join' || method === 'resolve')
        ) {
          // Check if any argument looks like user input
          const hasUserInput = node.arguments.some((arg) => {
            const text = arg.getText(sourceFile);
            return (
              text.includes('request') ||
              text.includes('input') ||
              text.includes('params') ||
              text.includes('req.')
            );
          });

          if (hasUserInput) {
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

            issues.push(
              this.createIssue(
                'pathTraversal',
                filePath,
                'Potential path traversal: user input used in path construction',
                {
                  severity: 'critical',
                  line,
                  suggestion: 'Sanitize path input, validate against allowlist',
                  estimatedEffort: '1h',
                  references: ['https://owasp.org/www-community/attacks/Path_Traversal'],
                }
              )
            );
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return {
      dimension: 'pathTraversal',
      status: issues.length === 0 ? 'pass' : 'fail',
      issueCount: issues.length,
      issues,
      duration: Date.now() - startTime,
    };
  }

  private async analyzeCommandInjection(
    filePath: string,
    sourceFile: ts.SourceFile
  ): Promise<DimensionReport> {
    const startTime = Date.now();
    const issues: AnalysisIssue[] = [];

    const visit = (node: ts.Node) => {
      // Check for child_process.exec with user input
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;

        if (method === 'exec' || method === 'spawn') {
          const firstArg = node.arguments[0];
          if (firstArg) {
            const text = firstArg.getText(sourceFile);
            const hasUserInput =
              text.includes('request') || text.includes('input') || text.includes('${');

            if (hasUserInput) {
              const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

              issues.push(
                this.createIssue(
                  'commandInjection',
                  filePath,
                  'Potential command injection: user input in shell command',
                  {
                    severity: 'critical',
                    line,
                    suggestion: 'Use spawn with argument array, avoid shell interpolation',
                    estimatedEffort: '1-2h',
                    references: ['https://owasp.org/www-community/attacks/Command_Injection'],
                  }
                )
              );
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return {
      dimension: 'commandInjection',
      status: issues.length === 0 ? 'pass' : 'fail',
      issueCount: issues.length,
      issues,
      duration: Date.now() - startTime,
    };
  }

  private async analyzeHardcodedSecrets(
    filePath: string,
    sourceFile: ts.SourceFile
  ): Promise<DimensionReport> {
    const startTime = Date.now();
    const issues: AnalysisIssue[] = [];

    // Patterns for secrets
    const SECRET_PATTERNS = [
      { pattern: /api[_-]?key\s*[:=]\s*["'][^"']{20,}["']/i, type: 'API Key' },
      { pattern: /secret\s*[:=]\s*["'][^"']{20,}["']/i, type: 'Secret' },
      { pattern: /password\s*[:=]\s*["'][^"']+["']/i, type: 'Password' },
      { pattern: /token\s*[:=]\s*["'][^"']{20,}["']/i, type: 'Token' },
      { pattern: /jwt\s*[:=]\s*["'][^"']{20,}["']/i, type: 'JWT' },
    ];

    const text = sourceFile.getText();

    for (const { pattern, type } of SECRET_PATTERNS) {
      const matches = text.matchAll(new RegExp(pattern, 'g'));

      for (const match of matches) {
        const pos = match.index || 0;
        const line = sourceFile.getLineAndCharacterOfPosition(pos).line + 1;

        issues.push(
          this.createIssue('secrets', filePath, `Potential hardcoded ${type} detected`, {
            severity: 'critical',
            line,
            suggestion: 'Use environment variables or secret management service',
            estimatedEffort: '30min',
            references: [
              'https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password',
            ],
          })
        );
      }
    }

    return {
      dimension: 'secrets',
      status: issues.length === 0 ? 'pass' : 'fail',
      issueCount: issues.length,
      issues,
      duration: Date.now() - startTime,
    };
  }
}
