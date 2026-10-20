// Shared helpers for the phone-safety checks (no-phone-in-dist.ts, no-phone-in-source.ts,
// pdf-contains-phone.ts) and the build precondition (require-build.ts). Pure logic, so tests can
// import it; the CLIs only add file I/O and exit codes.
//
// Matching rule: the phone is found by its last 9 digits, with separators (spaces, - . ( )) allowed
// between them. That catches the international form (+972 55-555-0199) and the local Israeli form
// (055-555-0199, 0555550199) whichever one CV_PHONE is stored in, and PDF text that comes out with
// spaces between characters. Messages never include the value or the line it was found on.

import fs from 'node:fs';
import path from 'node:path';

export const PHONE_DIGITS = 9;

export class PhoneConfigError extends Error {}

export type PhoneSetting = { phone: string } | { skip: string };

// CV_PHONE from the environment (the npm scripts load .env first). Unset is a skip locally and an
// error in CI, the same as create_cv.js.
export function readPhone(env: NodeJS.ProcessEnv = process.env): PhoneSetting {
  const phone = env.CV_PHONE?.trim();
  if (!phone) {
    if (env.CI) throw new PhoneConfigError('CV_PHONE environment variable is required in CI.');
    return { skip: 'CV_PHONE not set; skipping this check. Set it in .env to run it locally.' };
  }
  if (phone.replace(/\D/g, '').length < PHONE_DIGITS) {
    throw new PhoneConfigError(`CV_PHONE doesn't look like a phone number (needs at least ${PHONE_DIGITS} digits).`);
  }
  return { phone };
}

export function phonePattern(phone: string): RegExp {
  const digits = phone.replace(/\D/g, '').slice(-PHONE_DIGITS);
  if (digits.length < PHONE_DIGITS) {
    throw new PhoneConfigError(`CV_PHONE doesn't look like a phone number (needs at least ${PHONE_DIGITS} digits).`);
  }
  return new RegExp(digits.split('').join('[\\s.()-]*'), 'g');
}

// 1-based line numbers of every match, without the matched text.
export function findPhone(text: string, pattern: RegExp): number[] {
  const lines: number[] = [];
  for (const match of text.matchAll(new RegExp(pattern.source, 'g'))) {
    lines.push(text.slice(0, match.index).split('\n').length);
  }
  return lines;
}

// For the CLIs: the pattern to search for, or null after printing why the check is skipped. Exits 1
// on a config error.
export function phonePatternForCli(check: string): RegExp | null {
  try {
    const setting = readPhone();
    if ('skip' in setting) {
      console.warn(`Warning (${check}): ${setting.skip}`);
      return null;
    }
    return phonePattern(setting.phone);
  } catch (error) {
    if (!(error instanceof PhoneConfigError)) throw error;
    console.error(`${check}: ${error.message}`);
    process.exit(1);
  }
}

export class MissingBuildError extends Error {}

// npm run check runs against an existing build (CI runs npm run build first).
export function requireBuild(root: string): void {
  const missing = ['dist', '.generated'].filter((dir) => !fs.existsSync(path.join(root, dir)));
  if (missing.length > 0) {
    throw new MissingBuildError(`${missing.map((dir) => `${dir}/`).join(' and ')} not found: run npm run build first.`);
  }
}
