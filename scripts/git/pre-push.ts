// Run by .githooks/pre-push. git passes the remote name and URL as arguments and one line per ref
// update on stdin. Exits 1 (and git aborts the push, sending nothing) if the push would update or
// delete main; exits 0 otherwise.
//
// Usage: node scripts/git/pre-push.ts <remote> <url> < updates

import fs from 'node:fs';
import { decidePush, parsePushLines } from './push-policy.ts';

const remote = process.argv[2] || 'origin';
const decision = decidePush(parsePushLines(fs.readFileSync(0, 'utf8')), remote);

if (!decision.allowed) {
  console.error(decision.message);
  process.exit(1);
}
