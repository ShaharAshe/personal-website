// Docs checks (Task 2.18): no tracked text file has Hebrew (the docs are in English), every "§N" / "§N.N"
// reference in the repo points to a numbered heading in docs/design-doc.md, and every in-doc link in the design
// doc points to one of its headings.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = path.join(import.meta.dirname, '..');
const DESIGN_DOC = 'docs/design-doc.md';
const doc = fs.readFileSync(path.join(ROOT, DESIGN_DOC), 'utf8');

// Built from code points, so this file has no Hebrew character of its own.
const HEBREW = new RegExp(`[${String.fromCodePoint(0x0590)}-${String.fromCodePoint(0x05ff)}]`);

const noGit = spawnSync('git', ['--version']).error ? 'git not found' : false;

/** Every tracked text file (binaries, with a NUL byte, are skipped), as [path, lines]. */
function trackedTextFiles(): [file: string, lines: string[]][] {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  assert.ok(files.length > 50, 'git ls-files listed the repo');
  return files.flatMap((file): [string, string[]][] => {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) return [];
    const bytes = fs.readFileSync(full);
    if (bytes.includes(0)) return [];
    return [[file, bytes.toString('utf8').split('\n')]];
  });
}

/** The section numbers of the design doc's numbered headings: "## 10. …" → "10", "### 10.3 …" → "10.3". */
const sections = new Set([...doc.matchAll(/^#{2,6} (\d+(?:\.\d+)*)\.?\s/gm)].map(([, number]) => number));

/** GitHub's heading anchor: lowercase, punctuation dropped, each space becomes "-". */
function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

test('the design doc has its numbered sections (sanity check for the § test)', () => {
  for (const number of ['0', '1', '9.2', '10.3', '13.3', '18']) assert.ok(sections.has(number), `§${number}`);
});

test('no tracked text file contains Hebrew (U+0590–U+05FF); the docs are in English', { skip: noGit }, () => {
  const hits = trackedTextFiles().flatMap(([file, lines]) =>
    lines.flatMap((line, i) => (HEBREW.test(line) ? [`${file}:${i + 1}: Hebrew text (U+0590–U+05FF)`] : [])),
  );
  assert.deepEqual(hits, [], `${hits.length} line(s) with Hebrew:\n${hits.join('\n')}`);
});

test(`every "§N" / "§N.N" reference in a tracked file is a numbered heading in ${DESIGN_DOC}`, { skip: noGit }, () => {
  let count = 0;
  const broken = trackedTextFiles().flatMap(([file, lines]) =>
    lines.flatMap((line, i) =>
      [...line.matchAll(/§(\d+(?:\.\d+)*)/g)].flatMap(([, number]) => {
        count += 1;
        return sections.has(number) ? [] : [`${file}:${i + 1}: §${number} has no heading in ${DESIGN_DOC}`];
      }),
    ),
  );
  assert.ok(count > 100, `found ${count} § references`);
  assert.deepEqual(broken, [], `${broken.length} broken § reference(s):\n${broken.join('\n')}`);
});

test(`every in-doc link "](#…)" in ${DESIGN_DOC} points to one of its headings`, () => {
  const anchors = new Set([...doc.matchAll(/^#{1,6} (.+)$/gm)].map(([, heading]) => slug(heading)));
  const links = [...doc.matchAll(/\]\(#([^)]+)\)/g)].map(([, anchor]) => decodeURIComponent(anchor));
  assert.ok(links.length > 10, `found ${links.length} in-doc links`);
  const broken = links.filter((anchor) => !anchors.has(anchor));
  assert.deepEqual(broken, [], `in-doc links with no matching heading:\n${broken.join('\n')}`);
});
