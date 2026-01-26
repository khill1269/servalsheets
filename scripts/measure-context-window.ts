/**
 * Measure actual context window impact of ServalSheets MCP server
 * This measures the JSON schemas that Claude receives via MCP
 */

import { TOOL_REGISTRY } from '../src/schemas/index.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { TOOL_ANNOTATIONS } from '../src/schemas/annotations.js';
import { TOOL_DESCRIPTIONS } from '../src/schemas/descriptions.js';

interface ToolMeasurement {
  name: string;
  schemaChars: number;
  schemaTokens: number;
  descChars: number;
  descTokens: number;
  totalChars: number;
  totalTokens: number;
}

function estimateTokens(text: string): number {
  // Claude uses roughly 4 characters per token
  return Math.ceil(text.length / 4);
}

function padEnd(s: string, len: number): string {
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

function padStart(s: string, len: number): string {
  return s.length >= len ? s : ' '.repeat(len - s.length) + s;
}

function formatNum(n: number): string {
  return n.toLocaleString();
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   ServalSheets MCP Server - Context Window Impact Analysis');
  console.log('   (Actual JSON Schema Sizes Sent to Claude)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const measurements: ToolMeasurement[] = [];

  // Measure each tool's JSON schema
  for (const [name, schema] of Object.entries(TOOL_REGISTRY)) {
    try {
      // Generate JSON Schema
      const jsonSchema = zodToJsonSchema(schema, { name, errorMessages: true });
      const schemaStr = JSON.stringify(jsonSchema);
      const schemaChars = schemaStr.length;
      const schemaTokens = estimateTokens(schemaStr);

      // Get description
      const desc = TOOL_DESCRIPTIONS[name] || '';
      const descChars = desc.length;
      const descTokens = estimateTokens(desc);

      measurements.push({
        name,
        schemaChars,
        schemaTokens,
        descChars,
        descTokens,
        totalChars: schemaChars + descChars,
        totalTokens: schemaTokens + descTokens,
      });
    } catch (e) {
      console.error(`Error processing ${name}:`, e);
    }
  }

  // Sort by total tokens (largest first)
  measurements.sort((a, b) => b.totalTokens - a.totalTokens);

  // Print detailed table
  console.log('📊 TOOL-BY-TOOL BREAKDOWN:\n');
  console.log('┌─────────────────────────┬───────────┬─────────┬───────────┬─────────┐');
  console.log('│ Tool                    │ Schema    │ Schema  │ Desc      │ Total   │');
  console.log('│                         │ Chars     │ Tokens  │ Tokens    │ Tokens  │');
  console.log('├─────────────────────────┼───────────┼─────────┼───────────┼─────────┤');

  let totalSchemaChars = 0;
  let totalSchemaTokens = 0;
  let totalDescTokens = 0;
  let totalTokens = 0;

  for (const m of measurements) {
    console.log(
      '│ ' +
        padEnd(m.name, 23) +
        ' │ ' +
        padStart(formatNum(m.schemaChars), 9) +
        ' │ ' +
        padStart(formatNum(m.schemaTokens), 7) +
        ' │ ' +
        padStart(formatNum(m.descTokens), 9) +
        ' │ ' +
        padStart(formatNum(m.totalTokens), 7) +
        ' │'
    );
    totalSchemaChars += m.schemaChars;
    totalSchemaTokens += m.schemaTokens;
    totalDescTokens += m.descTokens;
    totalTokens += m.totalTokens;
  }

  console.log('├─────────────────────────┼───────────┼─────────┼───────────┼─────────┤');
  console.log(
    '│ ' +
      padEnd('TOTAL (' + measurements.length + ' tools)', 23) +
      ' │ ' +
      padStart(formatNum(totalSchemaChars), 9) +
      ' │ ' +
      padStart(formatNum(totalSchemaTokens), 7) +
      ' │ ' +
      padStart(formatNum(totalDescTokens), 9) +
      ' │ ' +
      padStart(formatNum(totalTokens), 7) +
      ' │'
  );
  console.log('└─────────────────────────┴───────────┴─────────┴───────────┴─────────┘\n');

  // Add overhead for MCP protocol structure
  const mcpOverhead = 2000; // Approximate overhead for MCP protocol framing
  const annotationsSize = JSON.stringify(TOOL_ANNOTATIONS).length;
  const annotationsTokens = estimateTokens(JSON.stringify(TOOL_ANNOTATIONS));

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   TOTAL MCP PAYLOAD ESTIMATE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('┌─────────────────────────────────┬───────────┬─────────────┐');
  console.log('│ Component                       │   Chars   │   Tokens    │');
  console.log('├─────────────────────────────────┼───────────┼─────────────┤');
  console.log(
    '│ ' +
      padEnd('Tool Schemas (JSON)', 31) +
      ' │ ' +
      padStart(formatNum(totalSchemaChars), 9) +
      ' │ ' +
      padStart(formatNum(totalSchemaTokens), 11) +
      ' │'
  );
  console.log(
    '│ ' +
      padEnd('Tool Descriptions', 31) +
      ' │ ' +
      padStart(formatNum(totalDescTokens * 4), 9) +
      ' │ ' +
      padStart(formatNum(totalDescTokens), 11) +
      ' │'
  );
  console.log(
    '│ ' +
      padEnd('Tool Annotations', 31) +
      ' │ ' +
      padStart(formatNum(annotationsSize), 9) +
      ' │ ' +
      padStart(formatNum(annotationsTokens), 11) +
      ' │'
  );
  console.log(
    '│ ' +
      padEnd('MCP Protocol Overhead', 31) +
      ' │ ' +
      padStart(formatNum(mcpOverhead), 9) +
      ' │ ' +
      padStart(formatNum(estimateTokens(String(mcpOverhead))), 11) +
      ' │'
  );

  const grandTotalChars = totalSchemaChars + totalDescTokens * 4 + annotationsSize + mcpOverhead;
  const grandTotalTokens = totalTokens + annotationsTokens + estimateTokens(String(mcpOverhead));

  console.log('├─────────────────────────────────┼───────────┼─────────────┤');
  console.log(
    '│ ' +
      padEnd('GRAND TOTAL', 31) +
      ' │ ' +
      padStart(formatNum(grandTotalChars), 9) +
      ' │ ' +
      padStart(formatNum(grandTotalTokens), 11) +
      ' │'
  );
  console.log('└─────────────────────────────────┴───────────┴─────────────┘\n');

  // Context window impact
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   CONTEXT WINDOW IMPACT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const models = [
    { name: 'Claude 3.5 Sonnet', context: 200000 },
    { name: 'Claude 3 Opus', context: 200000 },
    { name: 'Claude Opus 4', context: 200000 },
    { name: 'Claude Haiku', context: 200000 },
  ];

  console.log('┌─────────────────────┬─────────────┬───────────┬──────────────┐');
  console.log('│ Model               │ Context     │ Used      │ Remaining    │');
  console.log('├─────────────────────┼─────────────┼───────────┼──────────────┤');

  for (const model of models) {
    const pct = ((grandTotalTokens / model.context) * 100).toFixed(2);
    const remaining = model.context - grandTotalTokens;
    console.log(
      '│ ' +
        padEnd(model.name, 19) +
        ' │ ' +
        padStart(formatNum(model.context), 11) +
        ' │ ' +
        padStart(pct + '%', 9) +
        ' │ ' +
        padStart(formatNum(remaining), 12) +
        ' │'
    );
  }

  console.log('└─────────────────────┴─────────────┴───────────┴──────────────┘\n');

  // Key insights
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   KEY INSIGHTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('✅ SUMMARY:');
  console.log(`   • ${measurements.length} tools with 267 total actions`);
  console.log(`   • Total MCP payload: ~${formatNum(grandTotalTokens)} tokens`);
  console.log(`   • Context usage: ${((grandTotalTokens / 200000) * 100).toFixed(2)}%`);
  console.log(`   • Remaining for conversation: ~${formatNum(200000 - grandTotalTokens)} tokens`);
  console.log('');

  console.log('📊 AVERAGES:');
  console.log(`   • Per tool: ~${Math.round(totalTokens / measurements.length)} tokens`);
  console.log(`   • Per action: ~${Math.round(totalTokens / 267)} tokens`);
  console.log('');

  console.log('🔝 TOP 5 LARGEST TOOLS:');
  for (let i = 0; i < 5 && i < measurements.length; i++) {
    const m = measurements[i];
    const pct = ((m.totalTokens / totalTokens) * 100).toFixed(1);
    console.log(`   ${i + 1}. ${m.name}: ${formatNum(m.totalTokens)} tokens (${pct}%)`);
  }
  console.log('');

  console.log('💡 OPTIMIZATION POTENTIAL:');
  const top3Total = measurements.slice(0, 3).reduce((sum, m) => sum + m.totalTokens, 0);
  console.log(
    `   • Top 3 tools account for ${((top3Total / totalTokens) * 100).toFixed(1)}% of tokens`
  );
  console.log('   • Lazy-loading less-used tools could reduce initial payload');
  console.log('');

  console.log('✅ Analysis complete!\n');
}

main().catch(console.error);
