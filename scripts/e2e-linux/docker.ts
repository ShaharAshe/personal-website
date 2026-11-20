// The docker commands behind npm run test:e2e:linux and npm run test:e2e:linux:clean (Task 2.20), as pure functions
// (no I/O), so tests/e2e-linux.test.ts checks them without Docker. run.ts and clean.ts run them.
//
// The container mirrors CI's e2e step: Linux, the lockfile's Playwright and its Chromium, CI's fonts, CI=true. It runs
// only wrangler dev and Playwright, against the dist/ and dist-doodle/ built on Windows (static files, the same on any
// OS). Linux node_modules live in a Docker volume, never in the working copy.

import { createHash } from 'node:crypto';

/** This project's image repository. Cleanup only ever touches tags of this name. */
export const IMAGE_REPO = 'personal-website-e2e';
/** This project's Linux node_modules volume. */
export const VOLUME = 'personal-website-e2e-node-modules';
/** Where the repo is mounted in the container. */
export const WORKDIR = '/work';
/** Caps the container inside Docker's VM, so a runaway run is killed there instead of starving Windows. */
export const MEMORY = '3g';
/** The npm ci stamp inside the volume: the lockfile + image the volume's node_modules were installed for. */
export const STAMP_FILE = 'node_modules/.lock-stamp';

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** The @playwright/test version in package-lock.json: what npm ci installs in the container. */
export function playwrightVersion(lockText: string): string {
  const lock = JSON.parse(lockText) as { packages?: Record<string, { version?: string }> };
  const version = lock.packages?.['node_modules/@playwright/test']?.version;
  if (!version) throw new Error('package-lock.json has no node_modules/@playwright/test entry: run npm install.');
  return version;
}

/** The Node major in .nvmrc ("22", "v22.22.0" → "22"), the one CI's setup-node uses. */
export function nodeMajor(nvmrc: string): string {
  const match = /^v?(\d+)/.exec(nvmrc.trim());
  if (!match) throw new Error(`.nvmrc must start with a Node version, got "${nvmrc.trim()}".`);
  return match[1];
}

/**
 * The image tag: the Playwright version, the Node major and a short hash of the Dockerfile, so a change to any of them
 * builds a new image (and run.ts removes the old one).
 */
export function imageTag(playwright: string, node: string, dockerfile: string): string {
  return `${IMAGE_REPO}:pw${playwright}-node${node}-${sha256(dockerfile.replace(/\r\n/g, '\n')).slice(0, 8)}`;
}

/** docker build for the image, with only the Dockerfile's folder as the context. */
export function buildArgs(tag: string, playwright: string, node: string, contextDir: string): string[] {
  return [
    'build',
    '--tag',
    tag,
    '--build-arg',
    `PLAYWRIGHT_VERSION=${playwright}`,
    '--build-arg',
    `NODE_MAJOR=${node}`,
    '--label',
    `${IMAGE_REPO}=1`,
    contextDir,
  ];
}

/**
 * The npm ci stamp: the lockfile and the image tag. npm ci runs in the container when it differs from the one in the
 * volume, so a lockfile change, a new Node or a new Playwright reinstalls node_modules.
 */
export function lockStamp(lockText: string, tag: string): string {
  return sha256(`${lockText.replace(/\r\n/g, '\n')}\n${tag}`);
}

/**
 * The arguments passed through to Playwright. No --workers is added: playwright.config.ts's value applies, as on CI.
 * Windows-style paths that exist (tests\e2e\x.spec.ts) get forward slashes; anything else, such as a -g regex, is
 * passed unchanged.
 */
export function playwrightArgs(userArgs: readonly string[], exists: (file: string) => boolean): string[] {
  return userArgs.map((arg) =>
    !arg.startsWith('-') && arg.includes('\\') && exists(arg) ? arg.replace(/\\/g, '/') : arg,
  );
}

/**
 * What runs inside the container: npm ci when the stamp changed (SKIP_GIT_HOOKS=1 keeps our prepare script away from
 * the bind-mounted .git; esbuild's and workerd's install scripts still run), then the same command as CI's e2e step.
 * The arguments arrive as "$@", so nothing is re-quoted.
 */
export const CONTAINER_SCRIPT = [
  'set -e',
  `if [ "$(cat ${STAMP_FILE} 2>/dev/null)" != "$LOCK_STAMP" ]; then`,
  '  echo "package-lock.json or the image changed: npm ci into the Linux node_modules volume..."',
  '  npm ci --no-audit --no-fund',
  `  printf '%s' "$LOCK_STAMP" > ${STAMP_FILE}`,
  'fi',
  'exec npm run test:e2e -- "$@"',
].join('\n');

/** docker run for one test run: removed afterwards (--rm); the image and the volume stay. */
export function runArgs(options: { root: string; tag: string; stamp: string; args: readonly string[] }): string[] {
  return [
    'run',
    '--rm',
    '--init',
    // Chromium needs more shared memory than Docker's 64MB default (the Playwright docs' advice).
    '--ipc=host',
    `--memory=${MEMORY}`,
    '--mount',
    `type=bind,source=${options.root},target=${WORKDIR}`,
    '--mount',
    `type=volume,source=${VOLUME},target=${WORKDIR}/node_modules`,
    // wrangler dev's local state stays in the container, apart from the Windows .wrangler/.
    '--tmpfs',
    `${WORKDIR}/.wrangler`,
    '--workdir',
    WORKDIR,
    '--env',
    'CI=true',
    '--env',
    'WRANGLER_SEND_METRICS=false',
    '--env',
    'SKIP_GIT_HOOKS=1',
    '--env',
    `LOCK_STAMP=${options.stamp}`,
    options.tag,
    'bash',
    '-c',
    CONTAINER_SCRIPT,
    'bash',
    ...options.args,
  ];
}

/** docker image ls for this project's repository only, one tag per line. */
export const listTagsArgs = ['image', 'ls', IMAGE_REPO, '--format', '{{.Tag}}'];

/** This project's tags from `docker image ls` output, as full references, minus `keep` and untagged entries. */
export function projectImages(listOutput: string, keep?: string): string[] {
  return listOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((tag) => tag && tag !== '<none>')
    .map((tag) => `${IMAGE_REPO}:${tag}`)
    .filter((ref) => ref !== keep);
}

/** docker image rm for this project's images. Refuses any reference outside IMAGE_REPO. */
export function removeImagesArgs(refs: readonly string[]): string[] {
  for (const ref of refs) {
    if (!ref.startsWith(`${IMAGE_REPO}:`)) throw new Error(`Not this project's image: ${ref}`);
  }
  return ['image', 'rm', ...refs];
}

/** docker volume rm for this project's node_modules volume. */
export const removeVolumeArgs = ['volume', 'rm', VOLUME];
