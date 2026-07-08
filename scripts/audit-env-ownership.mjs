#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const roots = ['src', 'packages'];
const allowed = [
  /^src\/config\//,
  /^src\/cli\//,
  /^src\/cli\.ts$/,
  /^packages\/mcp-http\/src\/runtime-config\.ts$/,
  /^packages\/mcp-http\/src\/direct-entry\.ts$/,
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full, files);
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const violations = [];
for (const root of roots) {
  for (const file of walk(root)) {
    const normalized = file.split(path.sep).join('/');
    if (allowed.some((pattern) => pattern.test(normalized))) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (line.includes('process.env')) {
        violations.push(`${normalized}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

if (violations.length) {
  console.log(`Direct process.env reads outside approved config/startup modules: ${violations.length}`);
  console.log('Move recurring runtime config through src/config/env.ts before making this check blocking.');
  for (const line of violations.slice(0, 80)) console.log(line);
  if (violations.length > 80) console.log(`... ${violations.length - 80} more`);
  process.exitCode = 1;
} else {
  console.log('No direct process.env reads outside approved config/startup modules.');
}
