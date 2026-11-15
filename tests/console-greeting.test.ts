// The DevTools console greeting (Task F.1, src/lib/console-greeting.ts): its text with the OPEN_TO_WORK flag on and
// off, the profile URLs from resume.yaml, no email or phone, the badge contrast, the script's escaping, and (on dist/)
// that every page but /resume inlines it exactly once. Its last line is the CTF chain's clue 1 (src/lib/ctf.mts), in
// either flag state; the clue itself is tested in tests/ctf.test.ts. That the browser logs it once with no CSP violation is in
// tests/e2e/console-greeting.spec.ts. Comparisons with the email or phone report only true/false.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { extractInline } from '../scripts/csp/csp.mts';
import {
  OPEN_TO_WORK_BADGE,
  OPEN_TO_WORK_LABEL,
  OPEN_TO_WORK_STYLE,
  SA_ASCII,
  consoleGreeting,
  consoleGreetingScript,
} from '../src/lib/console-greeting.ts';
import { CTF_CONSOLE_LINE } from '../src/lib/ctf.mts';
import { joinEmail } from '../src/lib/email-client.ts';
import { getEmailParts, getResume } from '../src/lib/resume.ts';
import { OPEN_TO_WORK } from '../src/lib/site.ts';
import { contrast } from './helpers/contrast.ts';

const { name, profiles } = getResume().basics;
const urlOf = (network: string) => profiles.find((p) => p.network === network)?.url ?? '';
const LINKEDIN = urlOf('LinkedIn');
const GITHUB = urlOf('GitHub');

const clue = CTF_CONSOLE_LINE;
const on = consoleGreeting({ profiles, openToWork: true, clue });
const off = consoleGreeting({ profiles, openToWork: false, clue });

test('resume.yaml has the LinkedIn and GitHub profiles the greeting links to', () => {
  assert.match(LINKEDIN, /^https:\/\/(www\.)?linkedin\.com\//);
  assert.match(GITHUB, /^https:\/\/github\.com\//);
});

test('the ASCII art is "SA": the initials of basics.name, 5 lines, no trailing spaces', () => {
  const initials = name
    .split(/\s+/)
    .map((word) => word[0])
    .join('');
  assert.equal(initials, 'SA');
  assert.equal(SA_ASCII.length, 5);
  for (const line of SA_ASCII) assert.equal(line, line.trimEnd(), `trailing space in ${JSON.stringify(line)}`);
});

test('flag on: ASCII art, the "Open to work" badge with the LinkedIn URL, the GitHub URL, then the CTF clue', () => {
  assert.equal(
    on.format,
    [...SA_ASCII, '', `%c ${OPEN_TO_WORK_LABEL} %c LinkedIn: ${LINKEDIN}`, `GitHub: ${GITHUB}`, '', clue].join('\n'),
  );
  assert.equal(on.format.match(/%c/g)?.length, 2);
  assert.deepEqual(on.styles, [OPEN_TO_WORK_STYLE, '']);
});

test('flag off: the same greeting without the "Open to work" line', () => {
  assert.doesNotMatch(off.format, /Open to work|%c|linkedin/i);
  assert.deepEqual(off.styles, []);
  const withoutBadgeLine = on.format
    .split('\n')
    .filter((line) => !line.includes(OPEN_TO_WORK_LABEL))
    .join('\n');
  assert.equal(off.format, withoutBadgeLine);
  assert.ok(off.format.includes(GITHUB));
  assert.ok(off.format.endsWith(`\n\n${clue}`), 'the CTF clue is the last line with the flag off too');
});

test('a missing LinkedIn or GitHub profile fails the build', () => {
  const only = (network: string) => profiles.filter((p) => p.network === network);
  assert.throws(() => consoleGreeting({ profiles: only('GitHub'), openToWork: false, clue }), /LinkedIn and a GitHub/);
  assert.throws(() => consoleGreeting({ profiles: only('LinkedIn'), openToWork: true, clue }), /LinkedIn and a GitHub/);
});

test('the badge style uses only properties every console supports (Chrome and Firefox)', () => {
  const props = OPEN_TO_WORK_STYLE.split(';').map((decl) => decl.split(':')[0]?.trim());
  assert.deepEqual(props, ['background', 'color', 'padding', 'border-radius', 'font-weight']);
});

test('the badge text meets WCAG AA (4.5:1) on its own background, whatever the DevTools theme', () => {
  assert.ok(contrast(OPEN_TO_WORK_BADGE.color, OPEN_TO_WORK_BADGE.background) >= 4.5);
});

for (const [state, greeting] of [
  ['on', on],
  ['off', off],
] as const) {
  const script = consoleGreetingScript(greeting);
  const text = [greeting.format, ...greeting.styles, script].join('\n');

  test(`flag ${state}: no email address`, () => {
    assert.equal(text.includes(joinEmail(getEmailParts())), false);
    assert.equal(/@/.test(text), false);
  });

  test(`flag ${state}: no phone (checked with the profile URLs removed, whose slugs may end in digits)`, () => {
    const rest = text.replaceAll(LINKEDIN, '').replaceAll(GITHUB, '');
    const phone = (process.env.CV_PHONE ?? '').replace(/\D/g, '');
    if (phone) assert.equal(rest.replace(/\D/g, '').includes(phone), false);
    assert.equal(/\d{7,}/.test(rest), false);
  });

  test(`flag ${state}: the script is one console.log call whose arguments are the format and styles`, () => {
    assert.equal(script.match(/console\.\w+/g)?.join(), 'console.log');
    assert.equal(
      script,
      `console.log(${[greeting.format, ...greeting.styles].map((a) => JSON.stringify(a)).join(', ')});`,
    );
    // What the browser would log: the parsed arguments equal the greeting.
    const args = JSON.parse(`[${script.slice('console.log('.length, -');'.length)}]`) as string[];
    assert.deepEqual(args, [greeting.format, ...greeting.styles]);
  });
}

test('consoleGreetingScript writes "<" as \\u003c, so the text can never close the <script> element', () => {
  const script = consoleGreetingScript({ format: 'a</script><b>', styles: [] });
  assert.equal(script.includes('<'), false);
  assert.equal(script, 'console.log("a\\u003c/script>\\u003cb>");');
  assert.equal(JSON.parse(script.slice('console.log('.length, -');'.length)), 'a</script><b>');
});

// --- the build ---

const DIST = path.join(import.meta.dirname, '..', 'dist');
const skip = fs.existsSync(path.join(DIST, 'index.html')) ? false : 'no dist/index.html: run npm run build first';
const built = consoleGreetingScript(consoleGreeting({ profiles, openToWork: OPEN_TO_WORK, clue }));
const greetingsIn = (page: string) =>
  extractInline(fs.readFileSync(path.join(DIST, page), 'utf8')).scripts.filter((s) => s.includes('console.'));

for (const page of ['index.html', '404.html']) {
  test(`${page}: inlines the greeting exactly once, as built from OPEN_TO_WORK (${OPEN_TO_WORK})`, { skip }, () => {
    assert.deepEqual(greetingsIn(page), [built]);
  });
}

test('resume/index.html: no greeting (the Fun features never touch /resume)', { skip }, () => {
  assert.deepEqual(greetingsIn(path.join('resume', 'index.html')), []);
});
