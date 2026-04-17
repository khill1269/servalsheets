#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('🔍 Validating action metadata...');

const actionCountsPath = './src/generated/action-counts.ts';

if (!fs.existsSync(actionCountsPath)) {
  console.error(`❌ File not found: ${actionCountsPath}`);
  process.exit(1);
}

const content = fs.readFileSync(actionCountsPath, 'utf-8');

// Parse TOOL_COUNT — supports both literal (= 25) and computed (= Object.keys(...).length) forms
let toolCount;
const toolCountLiteral = content.match(/export const TOOL_COUNT = (\d+)/);
if (toolCountLiteral) {
  toolCount = parseInt(toolCountLiteral[1], 10);
} else {
  // Computed form: count top-level keys in ACTION_COUNTS object
  const countsBlock = content.match(/export const ACTION_COUNTS[^=]+=\s*\{([\s\S]*?)\};/);
  if (!countsBlock) {
    console.error('❌ Could not find TOOL_COUNT or ACTION_COUNTS export');
    process.exit(1);
  }
  toolCount = (countsBlock[1].match(/^\s+\w/gm) || []).length;
}

// Parse ACTION_COUNT — supports both literal and computed forms
let actionCount;
const actionCountLiteral = content.match(/export const ACTION_COUNT = (\d+)/);
if (actionCountLiteral) {
  actionCount = parseInt(actionCountLiteral[1], 10);
} else {
  // Computed form: sum all values in ACTION_COUNTS
  const countsBlock = content.match(/export const ACTION_COUNTS[^=]+=\s*\{([\s\S]*?)\};/);
  if (!countsBlock) {
    console.error('❌ Could not find ACTION_COUNT or ACTION_COUNTS export');
    process.exit(1);
  }
  actionCount = (countsBlock[1].match(/:\s*(\d+)/g) || [])
    .reduce((sum, m) => sum + parseInt(m.replace(/:\s*/, ''), 10), 0);
}

// Validation
if (toolCount < 1 || toolCount > 100) {
  console.error(`❌ Invalid TOOL_COUNT: ${toolCount}`);
  process.exit(1);
}

if (actionCount < 50 || actionCount > 500) {
  console.error(`❌ Invalid ACTION_COUNT: ${actionCount}`);
  process.exit(1);
}

// Verify server.json
const serverJsonPath = './server.json';
if (fs.existsSync(serverJsonPath)) {
  try {
    const serverJson = JSON.parse(fs.readFileSync(serverJsonPath, 'utf-8'));
    const serverToolCount = serverJson.tools ? serverJson.tools.length : 0;
    if (serverToolCount !== toolCount) {
      console.error(`⚠️ server.json has ${serverToolCount} tools but src/generated/action-counts.ts has ${toolCount}`);
    }
  } catch (e) {
    console.error(`❌ Failed to parse server.json: ${e.message}`);
    process.exit(1);
  }
}

console.log(`✅ Action validation passed`);
console.log(`   Tools: ${toolCount}`);
console.log(`   Actions: ${actionCount}`);
