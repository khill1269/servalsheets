/**
 * Measure context window impact with optimization modes
 * Shows token savings from lazy loading and minimal descriptions
 */

import {
  TOOL_DEFINITIONS,
  ACTIVE_TOOL_DEFINITIONS,
} from '../src/mcp/registration/tool-definitions.js';
import { TOOL_DESCRIPTIONS, TOOL_DESCRIPTIONS_MINIMAL } from '../src/schemas/index.js';
import { getLazyLoadTools, getSchemaStats } from '../src/config/schema-optimization.js';
import {
  DEFER_DESCRIPTIONS,
  TOOL_MODE,
  STRIP_SCHEMA_DESCRIPTIONS,
} from '../src/config/constants.js';
import { USE_SCHEMA_REFS } from '../src/utils/schema-compat.js';

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function formatNum(n: number): string {
  return n.toLocaleString();
}

function padEnd(s: string, len: number): string {
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

function padStart(s: string, len: number): string {
  return s.length >= len ? s : ' '.repeat(len - s.length) + s;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   ServalSheets - Context Window Optimization Analysis');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Current configuration
  console.log('📊 CURRENT CONFIGURATION:\n');
  console.log(`   TOOL_MODE: ${TOOL_MODE}`);
  console.log(`   DEFER_DESCRIPTIONS: ${DEFER_DESCRIPTIONS}`);
  console.log(`   STRIP_SCHEMA_DESCRIPTIONS: ${STRIP_SCHEMA_DESCRIPTIONS}`);
  console.log(`   USE_SCHEMA_REFS: ${USE_SCHEMA_REFS}`);
  console.log(
    `   Lazy-loaded tools: ${getLazyLoadTools().length > 0 ? getLazyLoadTools().join(', ') : 'none'}`
  );
  console.log('');

  // Tool counts
  const allTools = TOOL_DEFINITIONS.length;
  const activeTools = ACTIVE_TOOL_DEFINITIONS.length;
  const lazyTools = allTools - activeTools;

  console.log('📦 TOOL COUNTS:\n');
  console.log(`   Total defined: ${allTools} tools`);
  console.log(`   Active (loaded): ${activeTools} tools`);
  console.log(`   Lazy-loaded: ${lazyTools} tools`);
  console.log('');

  // Description analysis
  console.log('📝 DESCRIPTION TOKEN COMPARISON:\n');
  console.log('┌─────────────────────────┬────────────┬────────────┬──────────┐');
  console.log('│ Tool                    │ Full Desc  │ Mini Desc  │ Savings  │');
  console.log('├─────────────────────────┼────────────┼────────────┼──────────┤');

  let totalFullTokens = 0;
  let totalMiniTokens = 0;

  for (const tool of ACTIVE_TOOL_DEFINITIONS) {
    const fullDesc = TOOL_DESCRIPTIONS[tool.name] || '';
    const miniDesc = TOOL_DESCRIPTIONS_MINIMAL[tool.name] || fullDesc;
    const fullTokens = estimateTokens(fullDesc);
    const miniTokens = estimateTokens(miniDesc);
    const savings = fullTokens - miniTokens;

    totalFullTokens += fullTokens;
    totalMiniTokens += miniTokens;

    console.log(
      '│ ' +
        padEnd(tool.name, 23) +
        ' │ ' +
        padStart(formatNum(fullTokens), 10) +
        ' │ ' +
        padStart(formatNum(miniTokens), 10) +
        ' │ ' +
        padStart(formatNum(savings), 8) +
        ' │'
    );
  }

  console.log('├─────────────────────────┼────────────┼────────────┼──────────┤');
  console.log(
    '│ ' +
      padEnd('TOTAL', 23) +
      ' │ ' +
      padStart(formatNum(totalFullTokens), 10) +
      ' │ ' +
      padStart(formatNum(totalMiniTokens), 10) +
      ' │ ' +
      padStart(formatNum(totalFullTokens - totalMiniTokens), 8) +
      ' │'
  );
  console.log('└─────────────────────────┴────────────┴────────────┴──────────┘\n');

  // Schema stats
  const stats = getSchemaStats();
  console.log('🔧 OPTIMIZATION STATS:\n');
  console.log(`   Schema mode: ${stats.mode}`);
  console.log(`   Lazy load enabled: ${stats.lazyLoadEnabled}`);
  console.log(`   Estimated token savings: ~${formatNum(stats.estimatedTokenSavings)}`);
  console.log('');

  // Summary comparison
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   ESTIMATED CONTEXT USAGE BY CONFIGURATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Estimate base schema tokens (from earlier measurement: ~30K for all tools)
  const baseSchemaTokensPerTool = 1400; // Average schema tokens per tool
  const descOverhead = 500; // MCP protocol overhead per tool

  const configs = [
    {
      name: 'Full (default)',
      tools: allTools,
      useMinimalDesc: false,
      desc: 'All 21 tools, full descriptions',
    },
    {
      name: 'Full + Mini Desc',
      tools: allTools,
      useMinimalDesc: true,
      desc: 'All 21 tools, minimal descriptions',
    },
    {
      name: 'Lazy Enterprise',
      tools: activeTools,
      useMinimalDesc: false,
      desc: `${activeTools} tools (enterprise lazy-loaded)`,
    },
    {
      name: 'Lazy + Mini Desc',
      tools: activeTools,
      useMinimalDesc: true,
      desc: `${activeTools} tools, minimal descriptions`,
    },
    { name: 'Standard Mode', tools: 12, useMinimalDesc: false, desc: '12 standard tools' },
    { name: 'Lite Mode', tools: 8, useMinimalDesc: false, desc: '8 essential tools' },
    {
      name: 'Lite + Mini Desc',
      tools: 8,
      useMinimalDesc: true,
      desc: '8 tools, minimal descriptions',
    },
  ];

  console.log('┌─────────────────────┬───────┬────────────┬──────────┬───────────┐');
  console.log('│ Configuration       │ Tools │ Est Tokens │ Context  │ Remaining │');
  console.log('├─────────────────────┼───────┼────────────┼──────────┼───────────┤');

  const contextWindow = 200000;

  for (const cfg of configs) {
    const schemaTokens = cfg.tools * baseSchemaTokensPerTool;
    const descTokens = cfg.useMinimalDesc
      ? totalMiniTokens * (cfg.tools / activeTools)
      : totalFullTokens * (cfg.tools / activeTools);
    const totalTokens = Math.round(schemaTokens + descTokens);
    const pct = ((totalTokens / contextWindow) * 100).toFixed(1);
    const remaining = contextWindow - totalTokens;

    console.log(
      '│ ' +
        padEnd(cfg.name, 19) +
        ' │ ' +
        padStart(String(cfg.tools), 5) +
        ' │ ' +
        padStart('~' + formatNum(totalTokens), 10) +
        ' │ ' +
        padStart(pct + '%', 8) +
        ' │ ' +
        padStart('~' + formatNum(remaining), 9) +
        ' │'
    );
  }

  console.log('└─────────────────────┴───────┴────────────┴──────────┴───────────┘\n');

  // Recommendations
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   OPTIMIZATION OPTIONS FOR FULL MODE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('🔧 ENVIRONMENT VARIABLES:\n');
  console.log('   SERVAL_DEFER_DESCRIPTIONS=true');
  console.log('     → Uses minimal ~100 char descriptions (saves ~7K tokens)\n');
  console.log('   SERVAL_STRIP_SCHEMA_DESCRIPTIONS=true');
  console.log('     → Removes inline .describe() from schemas (saves ~14K tokens)\n');
  console.log('   SERVAL_SCHEMA_REFS=true');
  console.log('     → Uses $defs for shared types (saves ~60% of schema size)\n');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   RECOMMENDED CONFIGURATIONS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('🎯 FULL MODE - OPTIMIZED (recommended for Claude Desktop):');
  console.log('   SERVAL_STRIP_SCHEMA_DESCRIPTIONS=true SERVAL_DEFER_DESCRIPTIONS=true');
  console.log('   → All 21 tools, ~16K tokens (~8% context), ~184K remaining\n');

  console.log('🚀 FULL MODE - MAXIMUM OPTIMIZATION:');
  console.log(
    '   SERVAL_STRIP_SCHEMA_DESCRIPTIONS=true SERVAL_DEFER_DESCRIPTIONS=true SERVAL_SCHEMA_REFS=true'
  );
  console.log('   → All 21 tools, ~12K tokens (~6% context), ~188K remaining\n');

  console.log('🔬 FULL MODE - DEFAULT (development/testing):');
  console.log('   No env vars needed');
  console.log('   → All 21 tools, ~37K tokens (~18.5% context), full docs inline\n');

  console.log('✅ Analysis complete!\n');
}

main().catch(console.error);
