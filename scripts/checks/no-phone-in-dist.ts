// Fails if the CV_PHONE number appears in a site file under dist/ (.html, .js, .json, .xml, .txt).
// The resume .pdf/.docx are never read: they're supposed to contain the phone.
//
// Usage: node scripts/checks/no-phone-in-dist.ts [distDir]
// Env:   CV_PHONE  skipped with a warning if unset locally; required in CI

import fs from 'node:fs';
import path from 'node:path';
import { listSiteFiles } from './dist-files.ts';
import { findPhone, phonePatternForCli } from './phone.ts';

const distDir = process.argv[2] || path.join(import.meta.dirname, '..', '..', 'dist');

const pattern = phonePatternForCli('no-phone-in-dist');
if (!pattern) process.exit(0);

if (!fs.existsSync(distDir)) {
  console.error(`${distDir} not found: run npm run build first.`);
  process.exit(1);
}

const files = listSiteFiles(distDir);

const hits = files.flatMap((file) =>
  findPhone(fs.readFileSync(path.join(distDir, file), 'utf8'), pattern).map(
    (line) => `${path.join(path.basename(distDir), file)}:${line}`,
  ),
);

if (hits.length > 0) {
  console.error('The CV_PHONE number appears in site files (it must only be in the resume PDF/DOCX):');
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}

console.log(`No phone number in ${files.length} site files under ${distDir}.`);
