// Runs the docker CLI for run.ts and clean.ts (Task 2.20). The commands themselves are built in docker.ts.

import { spawnSync } from 'node:child_process';

/** Runs docker with the given args: output shown, or captured with `quiet`. No shell, so no quoting issues in cmd. */
export function docker(args: readonly string[], options: { quiet?: boolean } = {}) {
  const result = spawnSync('docker', args, {
    stdio: options.quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout ?? '', error: result.error };
}

/** Exits with a clear message when Docker isn't installed or isn't running. */
export function requireDocker(): void {
  const info = docker(['info', '--format', '{{.ServerVersion}}'], { quiet: true });
  if ((info.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
    console.error('Docker not found: install Docker Desktop (https://www.docker.com/products/docker-desktop/).');
    process.exit(1);
  }
  if (info.status !== 0) {
    console.error("Docker isn't running: start Docker Desktop, wait until it says it's running, and try again.");
    process.exit(1);
  }
}
