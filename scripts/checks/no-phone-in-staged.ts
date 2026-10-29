// Pre-commit check (.githooks/pre-commit): fails if the CV_PHONE number is in the staged content of any
// added or modified file. Reads the index (what is about to be committed), not the working tree.
//
// Usage: node scripts/checks/no-phone-in-staged.ts [repoRoot]
// Env:   CV_PHONE  required: unset blocks the commit (fail closed)

import { spawnSync } from 'node:child_process';
import { PhoneConfigError } from './phone.ts';
import { failureMessage, findStagedHits, needsContent, parseNameStatus, stagedPhonePattern } from './staged.ts';

const repoRoot = process.argv[2] || process.cwd();

let pattern: RegExp;
try {
  pattern = stagedPhonePattern(process.env);
} catch (error) {
  if (!(error instanceof PhoneConfigError)) throw error;
  console.error(error.message);
  process.exit(1);
}

function git(args: string[]): Buffer {
  const result = spawnSync('git', args, { cwd: repoRoot, maxBuffer: 256 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    console.error(
      `pre-commit: git ${args[0]} failed, so the commit is blocked: ${result.error?.message ?? result.stderr.toString().trim()}`,
    );
    process.exit(1);
  }
  return result.stdout;
}

const entries = parseNameStatus(git(['diff', '--cached', '--name-status', '-z', '--no-renames']).toString('utf8'));

const files = entries.map(({ status, path }) => ({
  status,
  path,
  // ":<path>" is the staged blob, not the file on disk.
  content: needsContent(status) ? git(['cat-file', 'blob', `:${path}`]) : null,
}));

const hits = findStagedHits(files, pattern);
if (hits.length > 0) {
  console.error(failureMessage(hits));
  process.exit(1);
}

console.log(`No phone number in ${files.filter((file) => needsContent(file.status)).length} staged files.`);
