import { spawnSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, relative } from 'path';

function parseActionCounts(actionCountsSource) {
  const actionCountsBlock = actionCountsSource.match(/export const ACTION_COUNTS[^{]*\{([^}]+)\}/s);

  if (!actionCountsBlock) {
    throw new Error('Could not parse ACTION_COUNTS block from src/generated/action-counts.ts');
  }

  const entries = actionCountsBlock[1].match(/\w+:\s*\d+/g) ?? [];
  const counts = Object.fromEntries(
    entries.map(entry => {
      const [tool, count] = entry.split(':').map(part => part.trim());
      return [tool, Number.parseInt(count, 10)];
    }),
  );

  return {
    counts,
    toolCount: Object.keys(counts).length,
    actionCount: Object.values(counts).reduce((sum, count) => sum + count, 0),
  };
}

export function loadSourceDocFacts(rootDir) {
  const packageJsonPath = join(rootDir, 'package.json');
  const serverJsonPath = join(rootDir, 'server.json');
  const manifestJsonPath = join(rootDir, 'src/generated/manifest.json');
  const actionCountsPath = join(rootDir, 'src/generated/action-counts.ts');

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const serverJson = JSON.parse(readFileSync(serverJsonPath, 'utf8'));
  const manifestJson = JSON.parse(readFileSync(manifestJsonPath, 'utf8'));
  const actionCountsSource = readFileSync(actionCountsPath, 'utf8');
  const runtimeCountsResult = spawnSync(
    process.execPath,
    ['--import', 'tsx', join(rootDir, 'scripts/runtime-doc-facts.ts')],
    {
      cwd: rootDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        LOG_LEVEL: process.env.LOG_LEVEL ?? 'error',
      },
    },
  );

  if (runtimeCountsResult.status !== 0) {
    throw new Error(
      `Failed to collect runtime doc facts: ${runtimeCountsResult.stderr || runtimeCountsResult.stdout || 'unknown error'}`,
    );
  }

  const runtimeCounts = JSON.parse(runtimeCountsResult.stdout);

  const parsedCounts = parseActionCounts(actionCountsSource);
  const tools = manifestJson.tools.map(tool => ({
    name: tool.name,
    actionCount: tool.actionCount,
    actions: [...tool.actions],
  }));

  return {
    generatedAt: new Date().toISOString(),
    package: {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
    },
    server: {
      name: serverJson.name,
      version: serverJson.version,
      protocolVersion: serverJson.mcpProtocol,
      description: serverJson.description,
    },
    counts: {
      tools: parsedCounts.toolCount,
      actions: parsedCounts.actionCount,
      prompts: runtimeCounts.prompts,
      resources: runtimeCounts.resources,
      resourceTemplates: runtimeCounts.resourceTemplates,
    },
    tools,
    sources: {
      packageJson: relative(rootDir, packageJsonPath),
      serverJson: relative(rootDir, serverJsonPath),
      generatedManifest: relative(rootDir, manifestJsonPath),
      generatedActionCounts: relative(rootDir, actionCountsPath),
      runtimeCounts: relative(rootDir, join(rootDir, 'scripts/runtime-doc-facts.ts')),
    },
  };
}

export function factsFilePath(rootDir) {
  return join(rootDir, 'docs/generated/facts.json');
}

export function writeDocFactsFile(rootDir, facts) {
  const outputPath = factsFilePath(rootDir);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(facts, null, 2)}\n`, 'utf8');
  return outputPath;
}

export function readDocFactsFile(rootDir) {
  return JSON.parse(readFileSync(factsFilePath(rootDir), 'utf8'));
}

export function hasFreshDocFactsFile(rootDir, sourceFacts) {
  try {
    const existingFacts = readDocFactsFile(rootDir);
    return JSON.stringify({
      package: existingFacts.package,
      server: existingFacts.server,
      counts: existingFacts.counts,
      tools: existingFacts.tools,
      sources: existingFacts.sources,
    }) === JSON.stringify({
      package: sourceFacts.package,
      server: sourceFacts.server,
      counts: sourceFacts.counts,
      tools: sourceFacts.tools,
      sources: sourceFacts.sources,
    });
  } catch {
    return false;
  }
}
