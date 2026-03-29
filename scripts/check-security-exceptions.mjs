#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const reportPath = path.resolve('SECURITY_EXCEPTIONS.md');
const warningWindowDays = Number.parseInt(process.env.SECURITY_EXCEPTION_WARN_DAYS ?? '30', 10);
const asOfDate = process.env.SECURITY_EXCEPTION_AS_OF
  ? new Date(`${process.env.SECURITY_EXCEPTION_AS_OF}T00:00:00Z`)
  : new Date();

if (Number.isNaN(asOfDate.getTime())) {
  console.error('❌ Invalid SECURITY_EXCEPTION_AS_OF date');
  process.exit(1);
}

const markdown = fs.readFileSync(reportPath, 'utf8');
const sections = markdown.split(/\n### /).slice(1);

const parseDate = (value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const writeGithubOutput = (name, value) => {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  fs.appendFileSync(outputPath, `${name}=${value}\n`);
};

const findings = [];

for (const section of sections) {
  const [headingLine] = section.split('\n', 1);
  const id = headingLine.split(':', 1)[0]?.trim() ?? 'unknown';
  const reviewMatch = section.match(/\|\s+\*\*Review By\*\*\s+\|\s+(\d{4}-\d{2}-\d{2})\s+\|/);

  if (!reviewMatch) {
    findings.push({
      id,
      status: 'invalid',
      message: 'Missing Review By date',
    });
    continue;
  }

  const reviewDate = parseDate(reviewMatch[1]);
  if (!reviewDate) {
    findings.push({
      id,
      status: 'invalid',
      message: `Invalid Review By date: ${reviewMatch[1]}`,
    });
    continue;
  }

  const diffMs = reviewDate.getTime() - asOfDate.getTime();
  const daysUntilReview = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysUntilReview < 0) {
    findings.push({
      id,
      status: 'overdue',
      message: `Review deadline passed ${Math.abs(daysUntilReview)} day(s) ago (${reviewMatch[1]})`,
    });
  } else if (daysUntilReview <= warningWindowDays) {
    findings.push({
      id,
      status: 'warning',
      message: `Review deadline is in ${daysUntilReview} day(s) (${reviewMatch[1]})`,
    });
  } else {
    findings.push({
      id,
      status: 'ok',
      message: `Review deadline is in ${daysUntilReview} day(s) (${reviewMatch[1]})`,
    });
  }
}

const overdue = findings.filter((finding) => finding.status === 'overdue');
const warnings = findings.filter((finding) => finding.status === 'warning');
const invalid = findings.filter((finding) => finding.status === 'invalid');

console.log('Security exception review status:\n');
for (const finding of findings) {
  const prefix = finding.status === 'ok' ? '✅' : finding.status === 'warning' ? '⚠️' : '❌';
  console.log(`${prefix} ${finding.id}: ${finding.message}`);
}

writeGithubOutput('overdue', overdue.length > 0 ? 'true' : 'false');
writeGithubOutput('warning_count', String(warnings.length));
writeGithubOutput('overdue_count', String(overdue.length));

if (invalid.length > 0) {
  console.error(`\n❌ Invalid security exception entries: ${invalid.length}`);
  process.exit(1);
}

if (overdue.length > 0) {
  console.error(`\n❌ Overdue security exception reviews: ${overdue.length}`);
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn(`\n⚠️ Security exception reviews due soon: ${warnings.length}`);
}

console.log('\n✅ Security exception review dates are valid');
