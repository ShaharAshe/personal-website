// npm "prepare" script (runs on npm install / npm ci): points git at the committed .githooks/ folder
// so the pre-commit phone check is active on every clone. Never fails the install: in CI, without git,
// or outside a git checkout it prints why and exits 0.
//
// Usage: node scripts/git/install-hooks.ts

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { HOOKS_PATH, decideHookInstall, skipHookInstall } from './hooks.ts';

const packageRoot = path.join(import.meta.dirname, '..', '..');

// Before any git call: the npm ci in npm run test:e2e:linux's container sets SKIP_GIT_HOOKS=1.
const skip = skipHookInstall(process.env);
if (skip) {
  console.log(skip);
  process.exit(0);
}

function git(args: string[]) {
  return spawnSync('git', args, { cwd: packageRoot, encoding: 'utf8' });
}

try {
  const toplevel = git(['rev-parse', '--show-toplevel']);
  const gitAvailable = !toplevel.error;
  const isRepoRoot =
    gitAvailable && toplevel.status === 0 && fs.realpathSync(toplevel.stdout.trim()) === fs.realpathSync(packageRoot);
  const current = isRepoRoot ? git(['config', '--local', '--get', 'core.hooksPath']).stdout.trim() : '';

  const decision = decideHookInstall({
    ci: Boolean(process.env.CI),
    gitAvailable,
    isRepoRoot,
    currentHooksPath: current || null,
  });

  if (decision.action === 'set') {
    const result = git(['config', '--local', 'core.hooksPath', HOOKS_PATH]);
    if (result.status !== 0) throw new Error(result.stderr.trim());
  }
  console.log(decision.message);
} catch (error) {
  console.warn(
    `Warning: could not install git hooks (${(error as Error).message}). Run: git config core.hooksPath ${HOOKS_PATH}`,
  );
}
