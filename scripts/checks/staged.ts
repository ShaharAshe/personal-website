// Decision logic for the pre-commit phone check (no-phone-in-staged.ts, run by .githooks/pre-commit).
// Pure, so tests can import it; the CLI only adds the git calls and the exit code.
//
// Unlike the other phone checks this one fails closed: without CV_PHONE it can't tell whether a commit
// is safe, so it blocks it. Messages never include the number or the line it was found on.

import { PhoneConfigError, findPhone, phonePattern, readPhone } from './phone.ts';

export type StagedFile = { path: string; status: string; content: Buffer | null };

const NO_VERIFY = 'Never bypass this check with git commit --no-verify.';

export function missingPhoneMessage(): string {
  return [
    'pre-commit: CV_PHONE is not set, so the phone check cannot run and the commit is blocked.',
    'Create .env from .env.example (copy .env.example .env) and set CV_PHONE in it, then commit again.',
    NO_VERIFY,
  ].join('\n');
}

// The pattern to search staged content for. Throws PhoneConfigError (with the message to print) when
// CV_PHONE is unset or invalid.
export function stagedPhonePattern(env: NodeJS.ProcessEnv): RegExp {
  let setting;
  try {
    setting = readPhone(env);
  } catch (error) {
    if (!(error instanceof PhoneConfigError)) throw error;
    throw new PhoneConfigError(`pre-commit: ${error.message} The commit is blocked.\n${NO_VERIFY}`);
  }
  if ('skip' in setting) throw new PhoneConfigError(missingPhoneMessage());
  return phonePattern(setting.phone);
}

// Parses `git diff --cached --name-status -z --no-renames`: "<status>\0<path>\0" pairs.
export function parseNameStatus(stdout: string): { status: string; path: string }[] {
  const parts = stdout.split('\0');
  const entries: { status: string; path: string }[] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    if (parts[i]) entries.push({ status: parts[i], path: parts[i + 1] });
  }
  return entries;
}

// Files whose staged content has to be read: everything except deletions.
export function needsContent(status: string): boolean {
  return status !== 'D';
}

// Git's own heuristic: a NUL byte in the first 8000 bytes means binary.
export function isBinary(content: Buffer): boolean {
  return content.subarray(0, 8000).includes(0);
}

// "file:line" for every match in the staged text files. Deleted and binary files are skipped. A path
// that itself contains the number is reported without printing the path.
export function findStagedHits(files: StagedFile[], pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const file of files) {
    if (!needsContent(file.status)) continue;
    if (findPhone(file.path, pattern).length > 0) {
      hits.push('(a staged file path contains the number)');
      continue;
    }
    if (!file.content || isBinary(file.content)) continue;
    for (const line of findPhone(file.content.toString('utf8'), pattern)) hits.push(`${file.path}:${line}`);
  }
  return hits;
}

export function failureMessage(hits: string[]): string {
  return [
    'pre-commit: the CV_PHONE number is in staged changes (it must only be in .env / the CI secret):',
    ...hits.map((hit) => `  ${hit}`),
    'Remove it from those lines, stage the files again (git add), then commit.',
    NO_VERIFY,
  ].join('\n');
}
