// npm run test:e2e:linux and npm run test:e2e:linux:clean (Task 2.20): the docker commands they build, checked
// without Docker. The real run is checked by hand (docs/plan.md, 2.20).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CONTAINER_SCRIPT,
  IMAGE_REPO,
  VOLUME,
  buildArgs,
  imageTag,
  listTagsArgs,
  lockStamp,
  nodeMajor,
  playwrightArgs,
  playwrightVersion,
  projectImages,
  removeImagesArgs,
  removeVolumeArgs,
  runArgs,
} from '../scripts/e2e-linux/docker.ts';

const ROOT = path.join(import.meta.dirname, '..');

const lock = (version: string) =>
  JSON.stringify({
    packages: { '': {}, 'node_modules/@playwright/test': { version }, 'node_modules/x': { version: '9' } },
  });

/** The value after a flag, e.g. valueOf(args, '--mount') for the first one. */
const valuesOf = (args: string[], flag: string) => args.flatMap((arg, i) => (arg === flag ? [args[i + 1]] : []));

const run = (args: string[] = []) =>
  runArgs({ root: 'C:\\Users\\Some One\\site', tag: 'personal-website-e2e:pw1.2.3-node22-abcd1234', stamp: 'S', args });

test('playwrightVersion reads @playwright/test from the lockfile, and fails clearly without it', () => {
  assert.equal(playwrightVersion(lock('1.64.1')), '1.64.1');
  assert.throws(() => playwrightVersion('{"packages":{}}'), /no node_modules\/@playwright\/test/);
});

test("the image tag follows the repo's own lockfile and .nvmrc (nothing hard-coded)", () => {
  const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
  const installed = JSON.parse(read('node_modules/@playwright/test/package.json')).version;
  const tag = imageTag(
    playwrightVersion(read('package-lock.json')),
    nodeMajor(read('.nvmrc')),
    read('scripts/e2e-linux/Dockerfile'),
  );
  assert.ok(tag.startsWith(`${IMAGE_REPO}:pw${installed}-node${nodeMajor(read('.nvmrc'))}-`), tag);
});

test('imageTag: a new Playwright, Node or Dockerfile gives a new tag; line endings do not', () => {
  const tag = imageTag('1.64.1', '22', 'FROM x\n');
  assert.match(tag, /^personal-website-e2e:pw1\.64\.1-node22-[0-9a-f]{8}$/);
  assert.notEqual(imageTag('1.65.0', '22', 'FROM x\n'), tag);
  assert.notEqual(imageTag('1.64.1', '24', 'FROM x\n'), tag);
  assert.notEqual(imageTag('1.64.1', '22', 'FROM y\n'), tag);
  assert.equal(imageTag('1.64.1', '22', 'FROM x\r\n'), tag);
});

test('nodeMajor reads .nvmrc forms', () => {
  assert.equal(nodeMajor('22\n'), '22');
  assert.equal(nodeMajor('v22.22.0'), '22');
  assert.throws(() => nodeMajor('lts/*'), /\.nvmrc/);
});

test('buildArgs: the versions as build args, the project label, and only the given folder as the context', () => {
  const args = buildArgs('personal-website-e2e:t', '1.64.1', '22', 'C:\\repo\\scripts\\e2e-linux');
  assert.equal(args[0], 'build');
  assert.deepEqual(valuesOf(args, '--tag'), ['personal-website-e2e:t']);
  assert.deepEqual(valuesOf(args, '--build-arg'), ['PLAYWRIGHT_VERSION=1.64.1', 'NODE_MAJOR=22']);
  assert.deepEqual(valuesOf(args, '--label'), [`${IMAGE_REPO}=1`]);
  assert.equal(args.at(-1), 'C:\\repo\\scripts\\e2e-linux');
});

test('lockStamp changes with the lockfile and with the image, not with line endings', () => {
  const stamp = lockStamp('{"a":1}\n', 'tag1');
  assert.notEqual(lockStamp('{"a":2}\n', 'tag1'), stamp);
  assert.notEqual(lockStamp('{"a":1}\n', 'tag2'), stamp);
  assert.equal(lockStamp('{"a":1}\r\n', 'tag1'), stamp);
});

test('runArgs: removed after the run, the repo bind-mounted, node_modules in the project volume', () => {
  const args = run();
  assert.equal(args[0], 'run');
  assert.ok(args.includes('--rm'));
  assert.ok(args.includes('--ipc=host'));
  assert.ok(args.includes('--memory=3g'));
  assert.deepEqual(valuesOf(args, '--mount'), [
    'type=bind,source=C:\\Users\\Some One\\site,target=/work',
    `type=volume,source=${VOLUME},target=/work/node_modules`,
  ]);
  assert.deepEqual(valuesOf(args, '--tmpfs'), ['/work/.wrangler']);
  assert.deepEqual(valuesOf(args, '--workdir'), ['/work']);
});

test('runArgs: CI=true like CI, no metrics, the prepare script kept away from git, and the npm ci stamp', () => {
  assert.deepEqual(valuesOf(run(), '--env'), [
    'CI=true',
    'WRANGLER_SEND_METRICS=false',
    'SKIP_GIT_HOOKS=1',
    'LOCK_STAMP=S',
  ]);
});

test("runArgs: the image, then bash -c with the user's args as positional parameters, in order", () => {
  const userArgs = ['tests/e2e/motion.spec.ts', '-g', 'theme (dark|light)', '--repeat-each=10', '--workers', '2'];
  const args = run(userArgs);
  const at = args.indexOf('personal-website-e2e:pw1.2.3-node22-abcd1234');
  assert.deepEqual(args.slice(at + 1, at + 5), ['bash', '-c', CONTAINER_SCRIPT, 'bash']);
  assert.deepEqual(args.slice(at + 5), userArgs);
});

test('the container script runs npm ci only when the stamp changed, then the same command as CI', () => {
  assert.match(CONTAINER_SCRIPT, /if \[ "\$\(cat node_modules\/\.lock-stamp 2>\/dev\/null\)" != "\$LOCK_STAMP" \]/);
  assert.match(CONTAINER_SCRIPT, /npm ci /);
  assert.doesNotMatch(CONTAINER_SCRIPT, /--ignore-scripts/);
  assert.match(CONTAINER_SCRIPT, /exec npm run test:e2e -- "\$@"$/);
});

test('playwrightArgs adds no --workers by default: the config value applies, as on CI', () => {
  assert.deepEqual(
    playwrightArgs([], () => false),
    [],
  );
  const args = playwrightArgs(['tests/e2e/motion.spec.ts', '--repeat-each=10'], () => true);
  assert.deepEqual(args, ['tests/e2e/motion.spec.ts', '--repeat-each=10']);
  assert.ok(!args.some((arg) => arg.startsWith('--workers') || arg.startsWith('-j')));
});

test("playwrightArgs passes the user's --workers / -j through unchanged, in order", () => {
  for (const userArgs of [
    ['--workers=4'],
    ['--workers', '4'],
    ['-j2'],
    ['-j', '2'],
    ['x.spec.ts', '--workers=2', '-g', 'a'],
  ]) {
    assert.deepEqual(
      playwrightArgs(userArgs, () => false),
      userArgs,
    );
  }
});

test('playwrightArgs: existing Windows paths get forward slashes; flags and other values stay as typed', () => {
  const exists = (file: string) => file === 'tests\\e2e\\motion.spec.ts';
  assert.deepEqual(playwrightArgs(['tests\\e2e\\motion.spec.ts', '-g', 'a\\d+b', '--grep=\\w'], exists), [
    'tests/e2e/motion.spec.ts',
    '-g',
    'a\\d+b',
    '--grep=\\w',
  ]);
});

test("cleanup lists only this project's repository", () => {
  assert.deepEqual(listTagsArgs, ['image', 'ls', IMAGE_REPO, '--format', '{{.Tag}}']);
});

test("projectImages: this project's tags as references, minus the current one and untagged entries", () => {
  const listed = 'pw1.64.1-node22-aaaaaaaa\r\npw1.63.0-node22-bbbbbbbb\n<none>\n\n';
  assert.deepEqual(projectImages(listed), [
    `${IMAGE_REPO}:pw1.64.1-node22-aaaaaaaa`,
    `${IMAGE_REPO}:pw1.63.0-node22-bbbbbbbb`,
  ]);
  assert.deepEqual(projectImages(listed, `${IMAGE_REPO}:pw1.64.1-node22-aaaaaaaa`), [
    `${IMAGE_REPO}:pw1.63.0-node22-bbbbbbbb`,
  ]);
  assert.deepEqual(projectImages(''), []);
});

test("removeImagesArgs refuses anything outside this project's repository", () => {
  assert.deepEqual(removeImagesArgs([`${IMAGE_REPO}:a`, `${IMAGE_REPO}:b`]), [
    'image',
    'rm',
    `${IMAGE_REPO}:a`,
    `${IMAGE_REPO}:b`,
  ]);
  for (const other of [
    'mcr.microsoft.com/playwright:v1.64.1-noble',
    'node:22-bookworm-slim',
    `${IMAGE_REPO}-other:a`,
    IMAGE_REPO,
  ]) {
    assert.throws(() => removeImagesArgs([`${IMAGE_REPO}:a`, other]), /Not this project's image/);
  }
});

test('removeVolumeArgs removes only the project volume', () => {
  assert.deepEqual(removeVolumeArgs, ['volume', 'rm', VOLUME]);
  assert.equal(VOLUME, 'personal-website-e2e-node-modules');
});
