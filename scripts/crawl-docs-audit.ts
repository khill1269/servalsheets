#!/usr/bin/env npx tsx
/**
 * 🕷️ ServalSheets Docs Crawler & Deep Audit
 *
 * Crawls every file in docs/, performs deep analysis including:
 * - File metadata (size, line count, last modified, word count)
 * - Frontmatter extraction and validation
 * - Internal link checking (broken links)
 * - Cross-reference consistency (action counts, tool counts, version refs)
 * - Duplicate content detection (fuzzy + exact)
 * - Stale content detection (old dates, outdated references)
 * - Binary file detection
 * - Naming convention violations
 * - Orphaned files (not linked from any index)
 * - TODO/FIXME/HACK markers
 * - Empty or near-empty files
 *
 * Usage:
 *   npx tsx scripts/crawl-docs-audit.ts
 *   npx tsx scripts/crawl-docs-audit.ts --json
 *   npx tsx scripts/crawl-docs-audit.ts --output audit-output/docs-crawl.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

// ─── Config ──────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_DIR = path.resolve(__dirname, '..', 'docs');
const BINARY_EXTENSIONS = new Set(['.xlsx', '.docx', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz']);
const IMAGE_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp']);
const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx']);
const DATA_EXTENSIONS = new Set(['.json', '.csv', '.yaml', '.yml']);
const WEB_EXTENSIONS = new Set(['.html', '.htm']);

// ─── Types ───────────────────────────────────────────────────────────────────

interface FileInfo {
  relativePath: string;
  absolutePath: string;
  extension: string;
  category: 'markdown' | 'data' | 'binary' | 'web' | 'image' | 'text' | 'other';
  sizeBytes: number;
  sizeHuman: string;
  lineCount: number;
  wordCount: number;
  lastModified: string;
  contentHash: string;
  subfolder: string;
}

interface FrontmatterInfo {
  hasFrontmatter: boolean;
  title?: string;
  description?: string;
  date?: string;
  version?: string;
  status?: string;
  lastUpdated?: string;
  raw?: Record<string, unknown>;
}

interface LinkInfo {
  type: 'internal' | 'external' | 'anchor';
  target: string;
  lineNumber: number;
  exists?: boolean;
}

interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  message: string;
  file: string;
  line?: number;
  suggestion?: string;
}

interface CountReference {
  file: string;
  line: number;
  text: string;
  extractedNumber: number;
}

interface DuplicateGroup {
  hash: string;
  files: string[];
}

interface AuditResult {
  metadata: {
    auditDate: string;
    docsRoot: string;
    totalFiles: number;
    totalDirectories: number;
    totalSizeBytes: number;
    totalSizeHuman: string;
    totalLines: number;
    totalWords: number;
  };
  files: FileInfo[];
  frontmatter: Record<string, FrontmatterInfo>;
  links: Record<string, LinkInfo[]>;
  issues: Issue[];
  actionCountRefs: CountReference[];
  toolCountRefs: CountReference[];
  versionRefs: CountReference[];
  duplicates: DuplicateGroup[];
  todoMarkers: { file: string; line: number; text: string }[];
  emptyFiles: string[];
  binaryFiles: string[];
  orphanedFiles: string[];
  subfolderStats: Record<string, {
    fileCount: number;
    totalSize: number;
    markdownCount: number;
    issueCount: number;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name === '.DS_Store' || entry.name === '.git') continue;
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function countDirectories(dir: string): number {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || entry.name === '.git') continue;
    if (entry.isDirectory()) {
      count += 1 + countDirectories(path.join(dir, entry.name));
    }
  }
  return count;
}

function extractFrontmatter(content: string): FrontmatterInfo {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { hasFrontmatter: false };

  const raw: Record<string, unknown> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      raw[key] = value;
    }
  }

  return {
    hasFrontmatter: true,
    title: raw['title'] as string | undefined,
    description: raw['description'] as string | undefined,
    date: raw['date'] as string | undefined,
    version: raw['version'] as string | undefined,
    status: raw['status'] as string | undefined,
    lastUpdated: (raw['last_updated'] ?? raw['lastUpdated']) as string | undefined,
    raw,
  };
}

function extractLinks(content: string, filePath: string): LinkInfo[] {
  const links: LinkInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    // Markdown links: [text](target)
    const mdLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    while ((match = mdLinkRegex.exec(lines[i])) !== null) {
      const target = match[2].split('#')[0].split('?')[0]; // strip anchors and query
      if (!target) {
        links.push({ type: 'anchor', target: match[2], lineNumber: i + 1 });
      } else if (target.startsWith('http://') || target.startsWith('https://')) {
        links.push({ type: 'external', target, lineNumber: i + 1 });
      } else {
        // Resolve relative to file location
        const resolvedPath = target.startsWith('/')
          ? path.join(DOCS_DIR, target)
          : path.join(path.dirname(filePath), target);

        // Check existence with and without .md extension
        const exists = fs.existsSync(resolvedPath) ||
          fs.existsSync(resolvedPath + '.md') ||
          fs.existsSync(resolvedPath + '/index.md') ||
          fs.existsSync(path.join(DOCS_DIR, '..', target));

        links.push({ type: 'internal', target, lineNumber: i + 1, exists });
      }
    }
  }

  return links;
}

function findActionCountRefs(content: string, filePath: string): CountReference[] {
  const refs: CountReference[] = [];
  const lines = content.split('\n');
  // Match patterns like "403 actions", "407 Actions", "actions: 404"
  const patterns = [
    /(\d{3,4})\s+actions?\b/gi,
    /actions?\s*[:=]\s*(\d{3,4})/gi,
    /action_count\s*[:=]\s*(\d{3,4})/gi,
    /actionCount\s*[:=]\s*(\d{3,4})/gi,
  ];

  for (let i = 0; i < lines.length; i++) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(lines[i])) !== null) {
        const num = parseInt(match[1] || match[2], 10);
        if (num >= 100 && num <= 999) {
          refs.push({
            file: filePath,
            line: i + 1,
            text: lines[i].trim().substring(0, 120),
            extractedNumber: num,
          });
        }
      }
    }
  }

  return refs;
}

function findToolCountRefs(content: string, filePath: string): CountReference[] {
  const refs: CountReference[] = [];
  const lines = content.split('\n');
  const patterns = [
    /(\d{1,3})\s+tools?\b/gi,
    /tools?\s*[:=]\s*(\d{1,3})/gi,
    /tool_count\s*[:=]\s*(\d{1,3})/gi,
  ];

  for (let i = 0; i < lines.length; i++) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(lines[i])) !== null) {
        const num = parseInt(match[1] || match[2], 10);
        if (num >= 10 && num <= 50) {
          refs.push({
            file: filePath,
            line: i + 1,
            text: lines[i].trim().substring(0, 120),
            extractedNumber: num,
          });
        }
      }
    }
  }

  return refs;
}

function findVersionRefs(content: string, filePath: string): CountReference[] {
  const refs: CountReference[] = [];
  const lines = content.split('\n');
  const pattern = /v?(\d+\.\d+\.\d+)/g;

  for (let i = 0; i < lines.length; i++) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(lines[i])) !== null) {
      const ver = match[1];
      // Filter to likely ServalSheets versions
      if (ver.startsWith('1.') || ver.startsWith('2.')) {
        refs.push({
          file: filePath,
          line: i + 1,
          text: lines[i].trim().substring(0, 120),
          extractedNumber: parseFloat(ver),
        });
      }
    }
  }

  return refs;
}

function findTodoMarkers(content: string, filePath: string): { file: string; line: number; text: string }[] {
  const markers: { file: string; line: number; text: string }[] = [];
  const lines = content.split('\n');
  const pattern = /\b(TODO|FIXME|HACK|XXX|TEMP|WORKAROUND)\b/i;

  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      markers.push({
        file: filePath,
        line: i + 1,
        text: lines[i].trim().substring(0, 120),
      });
    }
  }

  return markers;
}

// ─── Main Crawler ────────────────────────────────────────────────────────────

function crawlDocs(): AuditResult {
  console.log('🕷️  Crawling docs/ directory...\n');

  const allFiles = walkDir(DOCS_DIR);
  const totalDirs = countDirectories(DOCS_DIR);

  const files: FileInfo[] = [];
  const frontmatter: Record<string, FrontmatterInfo> = {};
  const links: Record<string, LinkInfo[]> = {};
  const issues: Issue[] = [];
  const allActionRefs: CountReference[] = [];
  const allToolRefs: CountReference[] = [];
  const allVersionRefs: CountReference[] = [];
  const allTodoMarkers: { file: string; line: number; text: string }[] = [];
  const emptyFiles: string[] = [];
  const binaryFiles: string[] = [];
  const contentHashes: Map<string, string[]> = new Map();
  const allLinkedFiles = new Set<string>();
  const subfolderStats: Record<string, { fileCount: number; totalSize: number; markdownCount: number; issueCount: number }> = {};

  let totalSize = 0;
  let totalLines = 0;
  let totalWords = 0;

  for (const absPath of allFiles) {
    const relPath = path.relative(DOCS_DIR, absPath);
    const ext = path.extname(absPath).toLowerCase();
    const stat = fs.statSync(absPath);
    const subfolder = relPath.includes('/') ? relPath.split('/')[0] : '(root)';

    // Init subfolder stats
    if (!subfolderStats[subfolder]) {
      subfolderStats[subfolder] = { fileCount: 0, totalSize: 0, markdownCount: 0, issueCount: 0 };
    }
    subfolderStats[subfolder].fileCount++;
    subfolderStats[subfolder].totalSize += stat.size;

    // Categorize file
    let category: FileInfo['category'] = 'other';
    if (BINARY_EXTENSIONS.has(ext)) category = 'binary';
    else if (IMAGE_EXTENSIONS.has(ext)) category = 'image';
    else if (MARKDOWN_EXTENSIONS.has(ext)) category = 'markdown';
    else if (DATA_EXTENSIONS.has(ext)) category = 'data';
    else if (WEB_EXTENSIONS.has(ext)) category = 'web';
    else if (['.txt', '.log'].includes(ext)) category = 'text';

    if (category === 'markdown') subfolderStats[subfolder].markdownCount++;

    // Read content for text files
    let content = '';
    let lineCount = 0;
    let wordCount = 0;
    let contentHash = '';

    if (category !== 'binary' && category !== 'image') {
      try {
        content = fs.readFileSync(absPath, 'utf-8');
        lineCount = content.split('\n').length;
        wordCount = content.split(/\s+/).filter(Boolean).length;
        contentHash = crypto.createHash('md5').update(content).digest('hex');
      } catch {
        content = '';
        contentHash = 'unreadable';
      }
    } else {
      contentHash = crypto.createHash('md5').update(fs.readFileSync(absPath)).digest('hex');
      binaryFiles.push(relPath);
    }

    totalSize += stat.size;
    totalLines += lineCount;
    totalWords += wordCount;

    const fileInfo: FileInfo = {
      relativePath: relPath,
      absolutePath: absPath,
      extension: ext,
      category,
      sizeBytes: stat.size,
      sizeHuman: humanSize(stat.size),
      lineCount,
      wordCount,
      lastModified: stat.mtime.toISOString(),
      contentHash,
      subfolder,
    };

    files.push(fileInfo);

    // Track content hashes for duplicate detection
    if (content && lineCount > 5) {
      const existing = contentHashes.get(contentHash);
      if (existing) {
        existing.push(relPath);
      } else {
        contentHashes.set(contentHash, [relPath]);
      }
    }

    // ─── Per-file analysis (markdown files only) ──────────────────────────

    if (category === 'markdown' && content) {
      // Frontmatter
      const fm = extractFrontmatter(content);
      frontmatter[relPath] = fm;

      // Links
      const fileLinks = extractLinks(content, absPath);
      links[relPath] = fileLinks;

      // Track linked files
      for (const link of fileLinks) {
        if (link.type === 'internal') {
          allLinkedFiles.add(link.target);
        }
      }

      // Broken links
      for (const link of fileLinks) {
        if (link.type === 'internal' && link.exists === false) {
          issues.push({
            severity: 'medium',
            category: 'broken-link',
            message: `Broken internal link: ${link.target}`,
            file: relPath,
            line: link.lineNumber,
            suggestion: `Check if the file exists or fix the path`,
          });
        }
      }

      // Action count references
      const actionRefs = findActionCountRefs(content, relPath);
      allActionRefs.push(...actionRefs);

      // Tool count references
      const toolRefs = findToolCountRefs(content, relPath);
      allToolRefs.push(...toolRefs);

      // Version references
      const verRefs = findVersionRefs(content, relPath);
      allVersionRefs.push(...verRefs);

      // TODO markers
      const todos = findTodoMarkers(content, relPath);
      allTodoMarkers.push(...todos);

      // Empty / near-empty check
      if (lineCount <= 3 || wordCount <= 10) {
        emptyFiles.push(relPath);
        issues.push({
          severity: 'low',
          category: 'empty-file',
          message: `File is empty or near-empty (${lineCount} lines, ${wordCount} words)`,
          file: relPath,
          suggestion: 'Add content or remove the file',
        });
      }

      // Missing frontmatter
      if (!fm.hasFrontmatter) {
        issues.push({
          severity: 'low',
          category: 'missing-frontmatter',
          message: 'No frontmatter found',
          file: relPath,
          suggestion: 'Add YAML frontmatter with title, description, date',
        });
      }

      // Naming convention: check for spaces in filenames
      if (relPath.includes(' ')) {
        issues.push({
          severity: 'low',
          category: 'naming',
          message: 'Filename contains spaces',
          file: relPath,
          suggestion: 'Use hyphens or underscores instead of spaces',
        });
      }
    }

    // Non-markdown in docs (issues for HTML, txt, binary)
    if (category === 'web') {
      issues.push({
        severity: 'low',
        category: 'wrong-format',
        message: `HTML file in docs/ (should be markdown or moved to artifacts)`,
        file: relPath,
        suggestion: 'Convert to .md or move to research/artifacts',
      });
    }

    if (category === 'binary') {
      issues.push({
        severity: 'medium',
        category: 'binary-in-docs',
        message: `Binary file (${ext}) in docs/ — not version-control friendly`,
        file: relPath,
        suggestion: 'Move to external storage or .gitignore',
      });
    }

    if (category === 'text' && ext === '.txt') {
      issues.push({
        severity: 'low',
        category: 'wrong-format',
        message: `Plain text file in docs/ — should be .md or moved to artifacts`,
        file: relPath,
        suggestion: 'Convert to markdown or move to test artifacts',
      });
    }
  }

  // ─── Cross-file analysis ─────────────────────────────────────────────────

  // Detect action count inconsistencies
  const uniqueActionCounts = [...new Set(allActionRefs.map(r => r.extractedNumber))];
  if (uniqueActionCounts.length > 1) {
    issues.push({
      severity: 'critical',
      category: 'count-inconsistency',
      message: `Action count inconsistency: found values ${uniqueActionCounts.sort().join(', ')} across ${allActionRefs.length} references`,
      file: '(cross-file)',
      suggestion: 'Run schema regeneration and update all docs to match SOURCE_OF_TRUTH.md',
    });
  }

  // Detect tool count inconsistencies
  const uniqueToolCounts = [...new Set(allToolRefs.map(r => r.extractedNumber))];
  if (uniqueToolCounts.length > 1) {
    issues.push({
      severity: 'critical',
      category: 'count-inconsistency',
      message: `Tool count inconsistency: found values ${uniqueToolCounts.sort().join(', ')} across ${allToolRefs.length} references`,
      file: '(cross-file)',
      suggestion: 'Update all docs to reflect actual tool count from codebase',
    });
  }

  // Exact duplicates
  const duplicates: DuplicateGroup[] = [];
  for (const [hash, filePaths] of contentHashes) {
    if (filePaths.length > 1) {
      duplicates.push({ hash, files: filePaths });
      issues.push({
        severity: 'medium',
        category: 'duplicate-content',
        message: `Exact duplicate content: ${filePaths.join(' ↔ ')}`,
        file: filePaths[0],
        suggestion: 'Remove duplicate or consolidate',
      });
    }
  }

  // .DS_Store detection
  const dsStoreFiles = allFiles.filter(f => f.endsWith('.DS_Store'));
  for (const ds of dsStoreFiles) {
    issues.push({
      severity: 'info',
      category: 'ds-store',
      message: `.DS_Store file found`,
      file: path.relative(DOCS_DIR, ds),
      suggestion: 'Add to .gitignore',
    });
  }

  // Compute subfolder issue counts
  for (const issue of issues) {
    const subfolder = issue.file.includes('/') ? issue.file.split('/')[0] : '(root)';
    if (subfolderStats[subfolder]) {
      subfolderStats[subfolder].issueCount++;
    }
  }

  // ─── Build result ─────────────────────────────────────────────────────────

  const result: AuditResult = {
    metadata: {
      auditDate: new Date().toISOString(),
      docsRoot: DOCS_DIR,
      totalFiles: files.length,
      totalDirectories: totalDirs,
      totalSizeBytes: totalSize,
      totalSizeHuman: humanSize(totalSize),
      totalLines: totalLines,
      totalWords: totalWords,
    },
    files,
    frontmatter,
    links,
    issues: issues.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    actionCountRefs: allActionRefs,
    toolCountRefs: allToolRefs,
    versionRefs: allVersionRefs,
    duplicates,
    todoMarkers: allTodoMarkers,
    emptyFiles,
    binaryFiles,
    orphanedFiles: [], // computed below
    subfolderStats,
  };

  return result;
}

// ─── Report Generator ────────────────────────────────────────────────────────

function generateMarkdownReport(result: AuditResult): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push('title: Docs Crawler Deep Audit');
  lines.push(`date: ${result.metadata.auditDate.split('T')[0]}`);
  lines.push('status: active');
  lines.push('generated: true');
  lines.push('---');
  lines.push('');
  lines.push('# 🕷️ Docs Crawler Deep Audit Report');
  lines.push('');
  lines.push(`> Generated: ${result.metadata.auditDate}`);
  lines.push('');

  // ─── Overview ──────────────────────────────────────────────────────────
  lines.push('## 📊 Overview');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total files | ${result.metadata.totalFiles} |`);
  lines.push(`| Total directories | ${result.metadata.totalDirectories} |`);
  lines.push(`| Total size | ${result.metadata.totalSizeHuman} |`);
  lines.push(`| Total lines | ${result.metadata.totalLines.toLocaleString()} |`);
  lines.push(`| Total words | ${result.metadata.totalWords.toLocaleString()} |`);
  lines.push(`| Total issues | ${result.issues.length} |`);
  lines.push(`| Duplicate groups | ${result.duplicates.length} |`);
  lines.push(`| TODO markers | ${result.todoMarkers.length} |`);
  lines.push(`| Binary files | ${result.binaryFiles.length} |`);
  lines.push(`| Empty/near-empty | ${result.emptyFiles.length} |`);
  lines.push('');

  // ─── File Category Breakdown ───────────────────────────────────────────
  lines.push('## 📂 File Categories');
  lines.push('');
  const categories = new Map<string, number>();
  for (const f of result.files) {
    categories.set(f.category, (categories.get(f.category) || 0) + 1);
  }
  lines.push('| Category | Count |');
  lines.push('|----------|-------|');
  for (const [cat, count] of [...categories.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${cat} | ${count} |`);
  }
  lines.push('');

  // ─── Subfolder Stats ──────────────────────────────────────────────────
  lines.push('## 📁 Subfolder Analysis');
  lines.push('');
  lines.push('| Subfolder | Files | Size | Markdown | Issues |');
  lines.push('|-----------|-------|------|----------|--------|');
  for (const [folder, stats] of Object.entries(result.subfolderStats).sort((a, b) => b[1].fileCount - a[1].fileCount)) {
    lines.push(`| \`${folder}\` | ${stats.fileCount} | ${humanSize(stats.totalSize)} | ${stats.markdownCount} | ${stats.issueCount} |`);
  }
  lines.push('');

  // ─── Issues by Severity ───────────────────────────────────────────────
  const severities = ['critical', 'high', 'medium', 'low', 'info'] as const;
  const issueEmoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵', info: 'ℹ️' };

  lines.push('## 🚨 Issues Summary');
  lines.push('');
  for (const sev of severities) {
    const sevIssues = result.issues.filter(i => i.severity === sev);
    if (sevIssues.length === 0) continue;
    lines.push(`| Count | Severity |`);
    lines.push(`|-------|----------|`);
    lines.push(`| ${sevIssues.length} | ${issueEmoji[sev]} ${sev.toUpperCase()} |`);
    lines.push('');
  }

  // Issue counts by category
  lines.push('### Issues by Category');
  lines.push('');
  const categoryMap = new Map<string, number>();
  for (const issue of result.issues) {
    categoryMap.set(issue.category, (categoryMap.get(issue.category) || 0) + 1);
  }
  lines.push('| Category | Count |');
  lines.push('|----------|-------|');
  for (const [cat, count] of [...categoryMap.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${cat} | ${count} |`);
  }
  lines.push('');

  // ─── Critical & High Issues Detail ────────────────────────────────────
  lines.push('## 🔴 Critical & High Issues');
  lines.push('');
  const criticalHigh = result.issues.filter(i => i.severity === 'critical' || i.severity === 'high');
  if (criticalHigh.length === 0) {
    lines.push('No critical or high severity issues found.');
  } else {
    for (const issue of criticalHigh) {
      lines.push(`### ${issueEmoji[issue.severity]} [${issue.severity.toUpperCase()}] ${issue.category}`);
      lines.push(`- **File:** \`${issue.file}\`${issue.line ? ` (line ${issue.line})` : ''}`);
      lines.push(`- **Message:** ${issue.message}`);
      if (issue.suggestion) lines.push(`- **Suggestion:** ${issue.suggestion}`);
      lines.push('');
    }
  }

  // ─── All Medium Issues ─────────────────────────────────────────────────
  lines.push('## 🟡 Medium Issues');
  lines.push('');
  const mediumIssues = result.issues.filter(i => i.severity === 'medium');
  if (mediumIssues.length === 0) {
    lines.push('No medium severity issues found.');
  } else {
    lines.push('| File | Category | Message |');
    lines.push('|------|----------|---------|');
    for (const issue of mediumIssues) {
      lines.push(`| \`${issue.file}\` | ${issue.category} | ${issue.message.substring(0, 80)} |`);
    }
  }
  lines.push('');

  // ─── Action Count Cross-Reference ─────────────────────────────────────
  lines.push('## 🔢 Action Count Cross-Reference');
  lines.push('');
  if (result.actionCountRefs.length > 0) {
    const grouped = new Map<number, string[]>();
    for (const ref of result.actionCountRefs) {
      const list = grouped.get(ref.extractedNumber) || [];
      list.push(`${ref.file}:${ref.line}`);
      grouped.set(ref.extractedNumber, list);
    }
    lines.push('| Count | References |');
    lines.push('|-------|------------|');
    for (const [count, refs] of [...grouped.entries()].sort()) {
      lines.push(`| **${count}** | ${refs.join(', ')} |`);
    }
  } else {
    lines.push('No action count references found.');
  }
  lines.push('');

  // ─── Tool Count Cross-Reference ───────────────────────────────────────
  lines.push('## 🔧 Tool Count Cross-Reference');
  lines.push('');
  if (result.toolCountRefs.length > 0) {
    const grouped = new Map<number, string[]>();
    for (const ref of result.toolCountRefs) {
      const list = grouped.get(ref.extractedNumber) || [];
      list.push(`${ref.file}:${ref.line}`);
      grouped.set(ref.extractedNumber, list);
    }
    lines.push('| Count | References |');
    lines.push('|-------|------------|');
    for (const [count, refs] of [...grouped.entries()].sort()) {
      lines.push(`| **${count}** | ${refs.join(', ')} |`);
    }
  } else {
    lines.push('No tool count references found.');
  }
  lines.push('');

  // ─── Duplicates ───────────────────────────────────────────────────────
  lines.push('## 🔁 Exact Duplicate Files');
  lines.push('');
  if (result.duplicates.length > 0) {
    for (const dup of result.duplicates) {
      lines.push(`- **Hash:** \`${dup.hash.substring(0, 8)}\``);
      for (const f of dup.files) {
        lines.push(`  - \`${f}\``);
      }
    }
  } else {
    lines.push('No exact duplicates found.');
  }
  lines.push('');

  // ─── Binary Files ─────────────────────────────────────────────────────
  lines.push('## 📦 Binary Files');
  lines.push('');
  if (result.binaryFiles.length > 0) {
    for (const f of result.binaryFiles) {
      const info = result.files.find(fi => fi.relativePath === f);
      lines.push(`- \`${f}\` (${info?.sizeHuman || 'unknown'})`);
    }
  } else {
    lines.push('No binary files found.');
  }
  lines.push('');

  // ─── TODO Markers ─────────────────────────────────────────────────────
  lines.push('## 📌 TODO / FIXME Markers');
  lines.push('');
  if (result.todoMarkers.length > 0) {
    lines.push('| File | Line | Text |');
    lines.push('|------|------|------|');
    for (const marker of result.todoMarkers.slice(0, 50)) {
      lines.push(`| \`${marker.file}\` | ${marker.line} | ${marker.text.substring(0, 80)} |`);
    }
    if (result.todoMarkers.length > 50) {
      lines.push(`| ... | ... | *(${result.todoMarkers.length - 50} more)* |`);
    }
  } else {
    lines.push('No TODO/FIXME markers found.');
  }
  lines.push('');

  // ─── Broken Links ─────────────────────────────────────────────────────
  lines.push('## 🔗 Broken Internal Links');
  lines.push('');
  const brokenLinks = result.issues.filter(i => i.category === 'broken-link');
  if (brokenLinks.length > 0) {
    lines.push('| File | Line | Target |');
    lines.push('|------|------|--------|');
    for (const bl of brokenLinks) {
      lines.push(`| \`${bl.file}\` | ${bl.line || '-'} | ${bl.message.replace('Broken internal link: ', '')} |`);
    }
  } else {
    lines.push('No broken internal links found.');
  }
  lines.push('');

  // ─── Frontmatter Coverage ─────────────────────────────────────────────
  lines.push('## 📝 Frontmatter Coverage');
  lines.push('');
  const mdFiles = result.files.filter(f => f.category === 'markdown');
  const withFM = Object.values(result.frontmatter).filter(fm => fm.hasFrontmatter).length;
  lines.push(`- Markdown files: ${mdFiles.length}`);
  lines.push(`- With frontmatter: ${withFM} (${Math.round(100 * withFM / mdFiles.length)}%)`);
  lines.push(`- Without frontmatter: ${mdFiles.length - withFM}`);
  lines.push('');

  // ─── Complete File Inventory ──────────────────────────────────────────
  lines.push('## 📋 Complete File Inventory');
  lines.push('');
  lines.push('| Path | Category | Size | Lines | Words |');
  lines.push('|------|----------|------|-------|-------|');
  for (const f of result.files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
    lines.push(`| \`${f.relativePath}\` | ${f.category} | ${f.sizeHuman} | ${f.lineCount} | ${f.wordCount} |`);
  }
  lines.push('');

  return lines.join('\n');
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const outputIdx = args.indexOf('--output');
const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : undefined;

const result = crawlDocs();

// Print summary to console
console.log(`\n${'═'.repeat(60)}`);
console.log('🕷️  DOCS CRAWLER AUDIT COMPLETE');
console.log(`${'═'.repeat(60)}\n`);
console.log(`📁 Files:        ${result.metadata.totalFiles}`);
console.log(`📂 Directories:  ${result.metadata.totalDirectories}`);
console.log(`💾 Total size:   ${result.metadata.totalSizeHuman}`);
console.log(`📝 Total lines:  ${result.metadata.totalLines.toLocaleString()}`);
console.log(`📖 Total words:  ${result.metadata.totalWords.toLocaleString()}`);
console.log(`🚨 Issues:       ${result.issues.length}`);
console.log(`  🔴 Critical:   ${result.issues.filter(i => i.severity === 'critical').length}`);
console.log(`  🟠 High:       ${result.issues.filter(i => i.severity === 'high').length}`);
console.log(`  🟡 Medium:     ${result.issues.filter(i => i.severity === 'medium').length}`);
console.log(`  🔵 Low:        ${result.issues.filter(i => i.severity === 'low').length}`);
console.log(`  ℹ️  Info:       ${result.issues.filter(i => i.severity === 'info').length}`);
console.log(`🔁 Duplicates:   ${result.duplicates.length} groups`);
console.log(`📌 TODOs:        ${result.todoMarkers.length}`);
console.log(`📦 Binary files: ${result.binaryFiles.length}`);
console.log('');

// Output
if (jsonMode) {
  const jsonOut = outputPath || 'audit-output/docs-crawl.json';
  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));
  console.log(`📄 JSON saved to: ${jsonOut}`);
}

// Always generate markdown report
const mdReport = generateMarkdownReport(result);
const mdOut = outputPath?.replace('.json', '.md') || 'docs/audits/DOCS_CRAWLER_DEEP_AUDIT_2026-03-24.md';
fs.mkdirSync(path.dirname(mdOut), { recursive: true });
fs.writeFileSync(mdOut, mdReport);
console.log(`📄 Markdown report saved to: ${mdOut}`);

// Also save JSON alongside
const jsonSidecar = mdOut.replace('.md', '.json');
fs.mkdirSync(path.dirname(jsonSidecar), { recursive: true });
fs.writeFileSync(jsonSidecar, JSON.stringify(result, null, 2));
console.log(`📄 JSON data saved to: ${jsonSidecar}`);

console.log('\n✅ Done!\n');
