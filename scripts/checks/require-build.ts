// First step of npm run check: fails fast if the build output it checks (dist/, .generated/) is missing.
//
// Usage: node scripts/checks/require-build.ts [projectRoot]

import path from 'node:path';
import { MissingBuildError, requireBuild } from './phone.ts';

const root = process.argv[2] || path.join(import.meta.dirname, '..', '..');

try {
  requireBuild(root);
} catch (error) {
  if (!(error instanceof MissingBuildError)) throw error;
  console.error(error.message);
  process.exit(1);
}
