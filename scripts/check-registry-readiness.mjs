import { existsSync } from 'fs';
import { readFileSync } from 'fs';

const required = [
  { file: 'SECURITY_SUMMARY.md', desc: 'Security summary for registry' },
  { file: 'LICENSE', desc: 'License file' },
  { file: 'PRIVACY.md', desc: 'Privacy policy' },
  { file: 'NOTICE', desc: 'Third-party license notices' },
  { file: 'README.md', desc: 'README with install instructions' },
];

let allPass = true;
for (const { file, desc } of required) {
  if (existsSync(file)) {
    console.log(`✅ ${file} — ${desc}`);
  } else {
    console.error(`❌ MISSING: ${file} — ${desc}`);
    allPass = false;
  }
}

// Check package.json has bin field
const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
if (pkg.bin) {
  console.log('✅ package.json has bin field');
} else {
  console.error('❌ package.json missing bin field');
  allPass = false;
}

if (!allPass) {
  console.error('\nRegistry readiness check FAILED');
  process.exit(1);
}
console.log('\n✅ Registry readiness check PASSED');
