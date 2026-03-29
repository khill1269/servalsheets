import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');

const DEFAULT_ROOTS = ['docs', '.github/workflows'];
const SCANNABLE_EXTENSIONS = new Set(['.md', '.yml', '.yaml']);
const SKIP_DIR_NAMES = new Set(['.git', 'node_modules', 'dist']);
const SKIP_RELATIVE_PREFIXES = ['docs/audits/artifacts/'];
const NPM_RUN_PATTERN = /npm run ([A-Za-z0-9:_-]+)/g;

interface Reference {
  file: string;
  line: number;
  lineText: string;
  script: string;
}

function toRepoRelative(absolutePath: string): string {
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/');
}

function shouldSkipFile(relativePath: string): boolean {
  return SKIP_RELATIVE_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

function collectFiles(rootRelativePath: string): string[] {
  const rootAbsolutePath = path.join(repoRoot, rootRelativePath);
  if (!fs.existsSync(rootAbsolutePath)) return [];

  const files: string[] = [];
  const stack = [rootAbsolutePath];

  while (stack.length > 0) {
    const currentPath = stack.pop();
    if (!currentPath) continue;

    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      const entryRelativePath = toRepoRelative(entryPath);

      if (entry.isDirectory()) {
        if (!SKIP_DIR_NAMES.has(entry.name) && !shouldSkipFile(`${entryRelativePath}/`)) {
          stack.push(entryPath);
        }
        continue;
      }

      if (!entry.isFile()) continue;
      if (!SCANNABLE_EXTENSIONS.has(path.extname(entry.name))) continue;
      if (shouldSkipFile(entryRelativePath)) continue;

      files.push(entryPath);
    }
  }

  return files.sort();
}

function getLineNumber(source: string, matchIndex: number): number {
  let line = 1;
  for (let i = 0; i < matchIndex; i += 1) {
    if (source[i] === '\n') line += 1;
  }
  return line;
}

function getLineText(source: string, lineNumber: number): string {
  return source.split(/\r?\n/)[lineNumber - 1]?.trim() ?? '';
}

function loadPackageScripts(): Set<string> {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    scripts?: Record<string, string>;
  };
  return new Set(Object.keys(packageJson.scripts ?? {}));
}

function scanFiles(roots: string[], scripts: Set<string>): {
  filesScanned: number;
  missingReferences: Map<string, Reference[]>;
} {
  const files = roots.flatMap((root) => collectFiles(root));
  const missingReferences = new Map<string, Reference[]>();

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const match of content.matchAll(NPM_RUN_PATTERN)) {
      const script = match[1];
      if (!script || scripts.has(script)) continue;

      const line = getLineNumber(content, match.index ?? 0);
      const reference: Reference = {
        file: toRepoRelative(filePath),
        line,
        lineText: getLineText(content, line),
        script,
      };

      const existing = missingReferences.get(script) ?? [];
      existing.push(reference);
      missingReferences.set(script, existing);
    }
  }

  return { filesScanned: files.length, missingReferences };
}

function main(): void {
  const roots = process.argv.slice(2);
  const scanRoots = roots.length > 0 ? roots : DEFAULT_ROOTS;
  const scripts = loadPackageScripts();
  const { filesScanned, missingReferences } = scanFiles(scanRoots, scripts);

  if (missingReferences.size === 0) {
    console.log(
      `✅ npm run references are valid in ${filesScanned} files across ${scanRoots.join(', ')}`
    );
    return;
  }

  console.error(
    `❌ Found ${missingReferences.size} missing npm run script reference(s) across ${filesScanned} files`
  );
  for (const [script, references] of [...missingReferences.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    console.error(`\n- ${script}`);
    for (const reference of references) {
      console.error(`  ${reference.file}:${reference.line}`);
      console.error(`    ${reference.lineText}`);
    }
  }
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  }
}
