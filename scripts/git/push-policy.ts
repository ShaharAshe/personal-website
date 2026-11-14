// Decision logic for the pre-push hook (.githooks/pre-push → scripts/git/pre-push.ts): refuse any push
// that would update or delete `main` on a remote, so changes reach main only through a pull request
// (README "Contributing and deploy flow", docs/plan.md task 2.17). Pure, so tests can import it.

export const PROTECTED_BRANCH = 'main';
export const PROTECTED_REF = `refs/heads/${PROTECTED_BRANCH}`;

// One line of the hook's stdin: `<local ref> <local oid> <remote ref> <remote oid>` (githooks(5)).
export type PushUpdate = { localRef: string; localOid: string; remoteRef: string; remoteOid: string };

export type PushDecision = { allowed: boolean; message: string };

// An all-zero object id (SHA-1 or SHA-256) as the local oid means the remote ref is being deleted.
export function isZeroOid(oid: string): boolean {
  return /^0+$/.test(oid);
}

export function parsePushLines(stdin: string): PushUpdate[] {
  return stdin
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [localRef = '', localOid = '', remoteRef = '', remoteOid = ''] = line.split(/\s+/);
      return { localRef, localOid, remoteRef, remoteOid };
    });
}

export function refusedMessage(remote: string, deletion: boolean): string {
  const what = deletion
    ? `delete '${PROTECTED_BRANCH}' on '${remote}'`
    : `push to '${PROTECTED_BRANCH}' on '${remote}'`;
  return [
    `pre-push: refusing to ${what}.`,
    `Changes reach '${PROTECTED_BRANCH}' only through a pull request whose 'build' check passes.`,
    '',
    'Use a branch and a PR instead:',
    '  git switch -c task/<n>-<n>-<slug>      (e.g. task/2-17-pr-workflow; commits made on main come along)',
    '  git push -u origin <branch>',
    '  gh pr create --fill --base main        (or open the link git push prints)',
    `If you committed on ${PROTECTED_BRANCH} by mistake, after switching to the branch reset main with:`,
    `  git branch -f ${PROTECTED_BRANCH} origin/${PROTECTED_BRANCH}`,
    '',
    'After the PR shows "Merged" (squash):',
    `  git switch ${PROTECTED_BRANCH}`,
    '  git pull',
    '  git fetch --prune',
    '  git branch -D <branch>',
  ].join('\n');
}

export function decidePush(updates: PushUpdate[], remote = 'origin'): PushDecision {
  const hit = updates.find((update) => update.remoteRef === PROTECTED_REF);
  if (!hit) return { allowed: true, message: '' };
  return { allowed: false, message: refusedMessage(remote, isZeroOid(hit.localOid)) };
}
