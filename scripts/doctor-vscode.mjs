#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const home = os.homedir();
const userMcpPath = path.join(home, 'Library/Application Support/Code/User/mcp.json');
const extensionRoot = path.join(home, '.vscode/extensions');
const nonSecretSensitiveNames = new Set(['GOOGLE_TOKEN_STORE_PATH']);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function shell(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function du(target) {
  if (!fs.existsSync(target)) return 'missing';
  const output = shell('du', ['-sh', target]).trim();
  return output ? output.split(/\s+/)[0] : 'unknown';
}

function listExtensions() {
  const output = shell('code', ['--list-extensions', '--show-versions']);
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

function taskReport() {
  const packagePath = path.join(root, 'package.json');
  const tasksPath = path.join(root, '.vscode/tasks.json');
  if (!fs.existsSync(packagePath) || !fs.existsSync(tasksPath)) return;

  const scripts = new Set(Object.keys(readJson(packagePath).scripts || {}));
  const tasks = readJson(tasksPath).tasks || [];
  const missing = [];
  const background = [];

  for (const task of tasks) {
    if (task.isBackground) background.push(task.label);
    const text = [task.command, ...(Array.isArray(task.args) ? task.args : [])].join(' ');
    for (const match of text.matchAll(/npm\s+run\s+([A-Za-z0-9:_-]+)/g)) {
      if (!scripts.has(match[1])) missing.push(`${task.label} -> ${match[1]}`);
    }
  }

  console.log('\nVS Code tasks');
  console.log(`  total: ${tasks.length}`);
  console.log(`  background: ${background.length ? background.join(', ') : 'none'}`);
  console.log(`  missing package scripts: ${missing.length ? missing.join('; ') : 'none'}`);
}

function extensionReport() {
  const installed = listExtensions();
  const watched = [
    'streetsidesoftware.code-spell-checker',
    'zixuanchen.vitest-explorer',
    'hbenl.vscode-test-explorer',
    'ms-vscode.test-adapter-converter',
    'newbpydev.mcp-diagnostics-extension',
    'snyk-security.snyk-vulnerability-scanner',
    'googlecloudtools.cloudcode',
    'googlecloudtools.datacloud',
    'wallabyjs.wallaby-vscode',
    'wallabyjs.quokka-vscode',
    'wallabyjs.console-ninja',
    'wix.vscode-import-cost',
    'kisstkondoros.vscode-codemetrics',
  ];
  const installedWatched = installed.filter((line) =>
    watched.some((id) => line.toLowerCase().startsWith(`${id}@`))
  );
  const staleDirs = fs.existsSync(extensionRoot)
    ? fs
        .readdirSync(extensionRoot)
        .filter((name) =>
          /(code-spell-checker|zixuanchen|vscode-test-explorer|test-adapter|newbpydev)/i.test(
            name
          )
        )
        .sort()
    : [];

  console.log('\nExtensions');
  console.log(`  installed: ${installed.length}`);
  console.log(`  extension dir size: ${du(extensionRoot)}`);
  console.log(`  watched heavy/duplicate IDs: ${installedWatched.length ? installedWatched.join(', ') : 'none'}`);
  console.log(`  stale duplicate/problem dirs: ${staleDirs.length ? staleDirs.join(', ') : 'none'}`);
}

function mcpReport() {
  const files = [
    path.join(root, '.mcp.json'),
    userMcpPath,
  ].filter((file) => fs.existsSync(file));
  const sensitiveKey = /(SECRET|TOKEN|API_KEY|HMAC|ENCRYPTION|CLIENT_ID)/i;

  console.log('\nMCP config');
  for (const file of files) {
    const obj = readJson(file);
    const servers = obj.servers || obj.mcpServers || {};
    const latest = [];
    const plaintext = [];
    const endpoints = new Map();

    for (const [name, config] of Object.entries(servers)) {
      const args = Array.isArray(config.args) ? config.args.join(' ') : '';
      if (/@latest/.test(args)) latest.push(name);

      const endpointKey = config.url || `${config.command || ''} ${args}`.trim();
      if (endpointKey) {
        const names = endpoints.get(endpointKey) || [];
        names.push(name);
        endpoints.set(endpointKey, names);
      }

      for (const [key, value] of Object.entries(config.env || {})) {
        if (
          sensitiveKey.test(key) &&
          !nonSecretSensitiveNames.has(key) &&
          typeof value === 'string' &&
          !/^\$\{[^}]+\}$/.test(value)
        ) {
          plaintext.push(`${name}.${key}`);
        }
      }
      for (const [key, value] of Object.entries(config.headers || {})) {
        if (sensitiveKey.test(key) && typeof value === 'string' && !/^\$\{[^}]+\}$/.test(value)) {
          plaintext.push(`${name}.headers.${key}`);
        }
      }
    }

    const duplicates = [...endpoints.entries()]
      .filter(([, names]) => names.length > 1)
      .map(([, names]) => names.join(' + '));

    console.log(`  ${file}`);
    console.log(`    servers: ${Object.keys(servers).length}`);
    console.log(`    @latest args: ${latest.length ? latest.join(', ') : 'none'}`);
    console.log(`    duplicate endpoints: ${duplicates.length ? duplicates.join('; ') : 'none'}`);
    console.log(`    plaintext-like sensitive values: ${plaintext.length ? plaintext.join(', ') : 'none'}`);
  }
}

function processReport() {
  const output = shell('pgrep', [
    '-fl',
    'code-spell-checker|cspell|_server/dist/main.cjs|newbpydev|vitest-explorer|test-adapter',
  ]).trim();
  console.log('\nLive process checks');
  console.log(`  removed extension remnants: ${output || 'none'}`);
}

console.log('ServalSheets VS Code Doctor');
console.log(`workspace size: ${du(root)}`);
console.log(`VS Code logs size: ${du(path.join(home, 'Library/Application Support/Code/logs'))}`);
taskReport();
extensionReport();
mcpReport();
processReport();
