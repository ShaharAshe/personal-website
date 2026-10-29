// Decision logic for install-hooks.ts (the npm "prepare" script): whether to point git's
// core.hooksPath at the committed .githooks/ folder. Pure, so tests can import it.

export const HOOKS_PATH = '.githooks';

export type HookInstallState = {
  ci: boolean;
  gitAvailable: boolean;
  // The package folder is the top level of a git work tree (false for a ZIP download, or a folder
  // nested in some other repo).
  isRepoRoot: boolean;
  // Current local core.hooksPath, or null if unset.
  currentHooksPath: string | null;
};

export type HookInstallDecision = { action: 'skip' | 'already' | 'set' | 'warn'; message: string };

export function decideHookInstall(state: HookInstallState): HookInstallDecision {
  if (state.ci) return { action: 'skip', message: 'CI: git hooks not installed (not needed in CI).' };
  if (!state.gitAvailable) return { action: 'skip', message: 'git not found: git hooks not installed.' };
  if (!state.isRepoRoot) return { action: 'skip', message: 'Not a git repository root: git hooks not installed.' };
  if (state.currentHooksPath === HOOKS_PATH) {
    return { action: 'already', message: `Git hooks already installed (core.hooksPath = ${HOOKS_PATH}).` };
  }
  if (state.currentHooksPath) {
    return {
      action: 'warn',
      message:
        `Warning: core.hooksPath is already set to another folder, so the pre-commit phone check is NOT active. ` +
        `Run: git config core.hooksPath ${HOOKS_PATH}`,
    };
  }
  return { action: 'set', message: `Git hooks installed (core.hooksPath = ${HOOKS_PATH}).` };
}
