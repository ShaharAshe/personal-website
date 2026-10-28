// Fails if the email from resume.yaml appears in a site file under dist/ (.html, .js, .json, .xml,
// .txt). The address must only be assembled in the browser (src/lib/resume.ts, design-doc §8.3).
// The resume .pdf/.docx are never read: they're supposed to contain it.
//
// Usage: node scripts/checks/no-email-in-dist.ts [distDir] [path/to/resume.yaml]

import fs from 'node:fs';
import path from 'node:path';
import { RESUME_YAML } from '../cv/paths.js';
import { ResumeDataError, getEmailParts } from '../../src/lib/resume.ts';
import { listSiteFiles } from './dist-files.ts';
import { emailPattern, findEmail } from './email.ts';

const distDir = process.argv[2] || path.join(import.meta.dirname, '..', '..', 'dist');
const resumePath = process.argv[3] || RESUME_YAML;

let pattern: RegExp;
try {
  const { user, domain } = getEmailParts(resumePath);
  pattern = emailPattern(user, domain);
} catch (error) {
  if (!(error instanceof ResumeDataError)) throw error;
  console.error(`no-email-in-dist: ${error.message}`);
  process.exit(1);
}

if (!fs.existsSync(distDir)) {
  console.error(`${distDir} not found: run npm run build first.`);
  process.exit(1);
}

const files = listSiteFiles(distDir);

const hits = files.flatMap((file) =>
  findEmail(fs.readFileSync(path.join(distDir, file), 'utf8'), pattern).map(
    (line) => `${path.join(path.basename(distDir), file)}:${line}`,
  ),
);

if (hits.length > 0) {
  console.error('The resume email appears in site files (it must only be assembled in the browser):');
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}

console.log(`No email address in ${files.length} site files under ${distDir}.`);
