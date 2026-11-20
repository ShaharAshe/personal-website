// npm run test:e2e:linux (Task 2.20): the e2e suite on Linux in Docker, as close to CI's e2e step as practical,
// before a push. CI's Linux run stays the gate.
//
// Usage: npm run test:e2e:linux [-- <playwright args>]
//   e.g. npm run test:e2e:linux -- tests/e2e/motion.spec.ts --repeat-each=10
//
// Needs Docker Desktop running and an existing build (npm run build, npm run doodle:build). The first run builds the
// image (and npm ci fills the node_modules volume); later runs reuse both. See docker.ts for the commands.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MissingBuildError, requireBuild } from '../checks/phone.ts';
import { requireDoodleBuild } from '../doodles/doodle-build.ts';
import { requireDocker, docker } from './docker-cli.ts';
import {
  buildArgs,
  imageTag,
  listTagsArgs,
  lockStamp,
  nodeMajor,
  playwrightArgs,
  playwrightVersion,
  projectImages,
  removeImagesArgs,
  runArgs,
} from './docker.ts';

const ROOT = path.join(import.meta.dirname, '..', '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

// 1. The builds the container serves, with the same messages as npm run test:e2e's guards.
try {
  requireBuild(ROOT);
} catch (error) {
  if (!(error instanceof MissingBuildError)) throw error;
  console.error(error.message);
  process.exit(1);
}
requireDoodleBuild();

// 2. Docker itself.
requireDocker();

// 3. The image, built once per Playwright version, Node major and Dockerfile.
const lockText = read('package-lock.json');
const playwright = playwrightVersion(lockText);
const node = nodeMajor(read('.nvmrc'));
const tag = imageTag(playwright, node, read('scripts/e2e-linux/Dockerfile'));

if (docker(['image', 'inspect', tag], { quiet: true }).status !== 0) {
  console.log(`Building ${tag} (once per Playwright version; a few minutes the first time)...`);
  if (docker(buildArgs(tag, playwright, node, path.join(ROOT, 'scripts', 'e2e-linux'))).status !== 0) {
    console.error(`docker build failed for ${tag}.`);
    process.exit(1);
  }
  const stale = projectImages(docker(listTagsArgs, { quiet: true }).stdout, tag);
  if (stale.length > 0) {
    console.log(`Removing this project's old image(s): ${stale.join(', ')}`);
    if (docker(removeImagesArgs(stale)).status !== 0) console.warn('Warning: could not remove the old image(s).');
  }
}

// 4. The run. The container must leave .git/config alone (SKIP_GIT_HOOKS=1 keeps npm ci's prepare script from
// running git); this check catches it if anything ever does.
const gitConfig = path.join(ROOT, '.git', 'config');
const hashGitConfig = () =>
  fs.existsSync(gitConfig) ? createHash('sha256').update(fs.readFileSync(gitConfig)).digest('hex') : null;
const gitConfigBefore = hashGitConfig();

const args = playwrightArgs(process.argv.slice(2), (file) => fs.existsSync(path.join(ROOT, file)));
const result = docker(runArgs({ root: ROOT, tag, stamp: lockStamp(lockText, tag), args }));

if (hashGitConfig() !== gitConfigBefore) {
  console.error('The container changed .git/config: check `git config --local --list` (expected no change).');
  process.exit(1);
}
process.exit(result.status ?? 1);
