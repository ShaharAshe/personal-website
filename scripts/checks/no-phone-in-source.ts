// Fails if the CV_PHONE number appears in any git-tracked file, e.g. hardcoded back into create_cv.js
// or a component. The phone lives only in .env (gitignored) and the CI secret.
//
// Usage: node scripts/checks/no-phone-in-source.ts [repoRoot]
// Env:   CV_PHONE  skipped with a warning if unset locally; required in CI

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { findPhone, phonePatternForCli } from './phone.ts';

const repoRoot = process.argv[2] || path.join(import.meta.dirname, '..', '..');

const pattern = phonePatternForCli('no-phone-in-source');
if (!pattern) process.exit(0);

const git = spawnSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (git.error || git.status !== 0) {
  console.error(`git ls-files failed in ${repoRoot}: ${git.error?.message ?? git.stderr.trim()}`);
  process.exit(1);
}

// Tracked files deleted from the working tree are listed by git but can't be read; skip them.
const files = git.stdout
  .split('\0')
  .filter(Boolean)
  .filter((file) => fs.existsSync(path.join(repoRoot, file)));

const hits = files.flatMap((file) =>
  findPhone(fs.readFileSync(path.join(repoRoot, file), 'utf8'), pattern).map((line) => `${file}:${line}`),
);

if (hits.length > 0) {
  console.error('The CV_PHONE number appears in git-tracked files (it must only be in .env / the CI secret):');
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}

console.log(`No phone number in ${files.length} tracked files.`);
