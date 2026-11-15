// The CTF chain (Task F.2, src/lib/ctf.mts): every clue's text comes from the module and names where the next one is,
// the encodings decode back to the module's text, adding a step later moves the ending, and the final answer (the
// joined parts) is never written out whole in a tracked file or in dist/. The second part checks the build: each clue
// is where it should be. Following the chain in a real browser is tests/e2e/ctf.spec.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseHeaders } from '../scripts/csp/csp.mts';
import { ctfHeadersRule, withCtfHeader } from '../scripts/ctf/ctf-headers.mts';
import { listSiteFiles } from '../scripts/checks/dist-files.ts';
import {
  CTF_COMMENT_HTML,
  CTF_CONSOLE_LINE,
  CTF_ENDING,
  CTF_HEADER,
  CTF_JOINER,
  CTF_PNG_TEXT,
  CTF_STEPS,
  CTF_WELL_KNOWN,
  ctfAnswer,
  ctfClue,
  rot13,
  toBase64,
} from '../src/lib/ctf.mts';

const ROOT = path.join(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PARTS = CTF_STEPS.map(({ part }) => part);

test('five static steps, each with a part (steps 5 and 6 come later)', () => {
  assert.equal(CTF_STEPS.length, 5);
  for (const part of PARTS) assert.match(part, /^[a-z]+$/);
  assert.equal(ctfAnswer(), PARTS.join(CTF_JOINER.char));
  assert.deepEqual(CTF_JOINER, { char: '-', name: 'hyphens' });
});

test('the clue texts, exactly as approved', () => {
  assert.equal(
    ctfClue(0),
    [
      'Hi, fellow source reader! Nice, you found clue 0 of a small treasure hunt.',
      'Each clue holds one part of a final answer and says where the next one is.',
      `Part 0: "${PARTS[0]}"`,
      'Next: open the DevTools console on this page.',
    ].join('\n'),
  );
  assert.equal(
    ctfClue(1),
    `Nice, you found clue 1. Part 1: "${PARTS[1]}". Next: the response headers of /favicon.ico (try curl -I).`,
  );
  assert.equal(
    ctfClue(2),
    `Nice, you found clue 2. Part 2: "${PARTS[2]}". Next: the metadata of /og-image.png (try exiftool or strings).`,
  );
  assert.equal(ctfClue(3), `Nice, you found clue 3. Part 3: "${PARTS[3]}". Next: /.well-known/ctf.txt (it is ROT13).`);
  assert.equal(
    ctfClue(4),
    [
      'Nice, you found clue 4, the last one. Well done!',
      `Part 4: "${PARTS[4]}"`,
      'To get the final answer, put the parts in order, 0 to 4, and join them with hyphens.',
      "If you'd like to get in touch, mention the final answer.",
    ].join('\n'),
  );
  assert.equal(CTF_ENDING, "If you'd like to get in touch, mention the final answer.");
});

test('every clue but the last names the next step, and carries its own part', () => {
  for (let i = 0; i < CTF_STEPS.length; i++) {
    const clue = ctfClue(i);
    assert.ok(clue.includes(`Part ${i}: "${PARTS[i]}"`), `clue ${i} part`);
    const next = CTF_STEPS[i + 1];
    if (next) {
      assert.ok(clue.includes(`Next: ${next.foundAt}.`), `clue ${i} points to step ${i + 1}`);
      assert.equal(clue.includes(CTF_ENDING), false);
    } else {
      assert.ok(clue.endsWith(CTF_ENDING), 'the last clue ends the hunt');
    }
  }
  // The locations each delivery uses are the ones the clue before it names.
  assert.ok(CTF_STEPS[2]!.foundAt.includes(CTF_HEADER.path));
  assert.ok(CTF_STEPS[3]!.foundAt.includes('/og-image.png'));
  assert.ok(CTF_STEPS[4]!.foundAt.includes(CTF_WELL_KNOWN.path));
  assert.ok(CTF_STEPS[1]!.foundAt.includes('console'));
});

test('each delivery holds its clue: the comment, the base64 console line, the header, the PNG text, the ROT13 file', () => {
  assert.equal(CTF_COMMENT_HTML, `<!--\n  ${ctfClue(0).split('\n').join('\n  ')}\n-->`);
  const base64 = CTF_CONSOLE_LINE.match(/^Clue 1 \(base64\): ([A-Za-z0-9+/=]+)$/)?.[1];
  assert.ok(base64, CTF_CONSOLE_LINE);
  assert.equal(Buffer.from(base64, 'base64').toString('utf8'), ctfClue(1));
  assert.equal(toBase64(ctfClue(1)), Buffer.from(ctfClue(1), 'utf8').toString('base64'));
  assert.deepEqual(CTF_HEADER, { path: '/favicon.ico', name: 'X-Clue', value: ctfClue(2) });
  assert.deepEqual(CTF_PNG_TEXT, { keyword: 'Comment', text: ctfClue(3) });
  assert.equal(CTF_WELL_KNOWN.path, '/.well-known/ctf.txt');
  assert.equal(rot13(CTF_WELL_KNOWN.body.trimEnd()), ctfClue(4));
  assert.equal(CTF_WELL_KNOWN.body.endsWith('\n'), true);
});

test('rot13 shifts letters only and is its own inverse', () => {
  assert.equal(rot13('Hello, World! 0-9 "x"'), 'Uryyb, Jbeyq! 0-9 "k"');
  for (let i = 0; i < CTF_STEPS.length; i++) assert.equal(rot13(rot13(ctfClue(i))), ctfClue(i));
});

test('every text is plain ASCII; the header value is one line; the comment has no "--" inside', () => {
  const texts = [CTF_COMMENT_HTML, CTF_CONSOLE_LINE, CTF_HEADER.value, CTF_PNG_TEXT.text, CTF_WELL_KNOWN.body];
  for (const text of texts) assert.match(text, /^[\x20-\x7e\n]*$/);
  assert.doesNotMatch(CTF_HEADER.value, /[\r\n]/);
  assert.doesNotMatch(CTF_CONSOLE_LINE, /[\r\n]/);
  assert.equal(CTF_COMMENT_HTML.slice(4, -3).includes('--'), false);
});

test('no clue has an email-like "@" or a long digit run (never the email or phone)', () => {
  for (let i = 0; i < CTF_STEPS.length; i++) {
    for (const text of [ctfClue(i), rot13(ctfClue(i))]) {
      assert.equal(text.includes('@'), false);
      assert.equal(/\d{7,}/.test(text), false);
    }
  }
  assert.equal(/\d{7,}/.test(CTF_CONSOLE_LINE), false);
});

test('adding a step later changes only the clue before it: the ending moves to the new last step', () => {
  const later = [...CTF_STEPS, { part: 'extra', foundAt: 'the TXT record of example.test (try dig TXT)' }];
  assert.equal(ctfClue(4, later), `Nice, you found clue 4. Part 4: "${PARTS[4]}". Next: ${later[5]!.foundAt}.`);
  assert.ok(ctfClue(5, later).endsWith(CTF_ENDING));
  assert.ok(ctfClue(5, later).includes('0 to 5'));
  for (let i = 0; i < 4; i++) assert.equal(ctfClue(i, later), ctfClue(i), `clue ${i} is unchanged`);
});

test('the _headers rule: X-Clue on /favicon.ico, appended once, refused if a /favicon.ico rule exists', () => {
  const text = withCtfHeader('/*\n  X-Test: 1\n');
  const rules = parseHeaders(text);
  assert.deepEqual(rules.at(-1), {
    path: '/favicon.ico',
    headers: [{ name: 'X-Clue', value: CTF_HEADER.value }],
    detached: [],
  });
  assert.ok(text.endsWith(ctfHeadersRule()));
  assert.throws(() => withCtfHeader(text), /already has a \/favicon\.ico rule/);
});

// --- the joined parts never appear whole ---

const answer = ctfAnswer().toLowerCase();

test('the joined parts are in no tracked file (only the parts are written anywhere)', () => {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  assert.ok(files.length > 50, 'git ls-files listed the repo');
  const leaks = files.filter((file) => {
    const full = path.join(ROOT, file);
    return fs.existsSync(full) && fs.readFileSync(full, 'latin1').toLowerCase().includes(answer);
  });
  assert.deepEqual(leaks, []);
});

// --- the build ---

const skip = fs.existsSync(path.join(DIST, '_headers')) ? false : 'no dist/_headers: run npm run build first';
const read = (file: string) => fs.readFileSync(path.join(DIST, file), 'utf8');

test('the joined parts are in no file in dist/', { skip }, () => {
  const files = fs
    .readdirSync(DIST, { recursive: true, encoding: 'utf8' })
    .filter((file) => fs.statSync(path.join(DIST, file)).isFile());
  const leaks = files.filter((file) => fs.readFileSync(path.join(DIST, file), 'latin1').toLowerCase().includes(answer));
  assert.deepEqual(leaks, []);
});

test('dist/index.html has the clue 0 comment as written (the build keeps HTML comments)', { skip }, () => {
  const html = read('index.html');
  assert.equal(html.split(CTF_COMMENT_HTML).length - 1, 1);
});

test('the clue 0 comment is only on the homepage: not on /resume or the 404 page', { skip }, () => {
  for (const page of [path.join('resume', 'index.html'), '404.html']) {
    const html = read(page);
    assert.equal(html.includes(CTF_COMMENT_HTML), false, page);
    assert.equal(html.includes(`Part 0: "${PARTS[0]}"`), false, page);
  }
});

test('dist/.well-known/ctf.txt holds the ROT13 clue, and the no-phone/no-email checks scan it', { skip }, () => {
  assert.equal(read(path.join('.well-known', 'ctf.txt')), CTF_WELL_KNOWN.body);
  const scanned = listSiteFiles(DIST).map((file) => file.split(path.sep).join('/'));
  assert.ok(scanned.includes('.well-known/ctf.txt'), 'listSiteFiles() covers .well-known/');
});

test('dist/_headers has the X-Clue rule for /favicon.ico with the module text', { skip }, () => {
  const rule = parseHeaders(read('_headers')).find(({ path: p }) => p === CTF_HEADER.path);
  assert.deepEqual(rule?.headers, [{ name: CTF_HEADER.name, value: CTF_HEADER.value }]);
});

test('no clue location is in sitemap.xml, and no page links to one', { skip }, () => {
  assert.doesNotMatch(read('sitemap.xml'), /well-known|ctf/i);
  for (const page of ['index.html', '404.html', path.join('resume', 'index.html')]) {
    assert.doesNotMatch(read(page), /href="[^"]*(well-known|ctf\.txt)/i, page);
  }
});
