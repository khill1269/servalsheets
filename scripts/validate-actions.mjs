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

// Parse TOOL_COUNT
const toolCountMatch = content.match(/export const TOOL_COUNT = (\d+)/);
if (!toolCountMatch) {
  console.error('❌ Could not find TOOL_COUNT export');
  process.exit(1);
}
const toolCount = parseInt(toolCountMatch[1], 10);

// Parse ACTION_COUNT
const actionCountMatch = content.match(/export const ACTION_COUNT = (\d+)/);
if (!actionCountMatch) {
  console.error('❌ Could not find ACTION_COUNT export');
  process.exit(1);
}
const actionCount = parseInt(actionCountMatch[1], 10);

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
