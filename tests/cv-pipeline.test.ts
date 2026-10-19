// Integration tests for the resume pipeline: create_cv.js -> to-pdf.js -> check-pdf.ts.
// The PDF tests need LibreOffice and are skipped, with a message, when soffice can't be found.
//
// Child processes always run with CV_PHONE empty and CI unset, so the real phone number never
// reaches a test file or test output.
//
// The golden test pins the generated Word XML for a fixture resume, so any change to the resume's
// design (fonts, sizes, spacing, page setup) fails here. If a design change is intended (and asked
// for), refresh the golden files with: UPDATE_GOLDEN=1 npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readDocxEntry } from './helpers/docx.ts';
import { resolveSoffice } from '../scripts/cv/to-pdf.js';

const root = path.join(import.meta.dirname, '..');
const fixtures = path.join(import.meta.dirname, 'fixtures');
const script = (name: string) => path.join(root, 'scripts', 'cv', name);

const childEnv: NodeJS.ProcessEnv = { ...process.env, CV_PHONE: '' };
delete childEnv.CI;

function run(scriptPath: string, args: string[]) {
  return spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', scriptPath, ...args], {
    env: childEnv,
    encoding: 'utf8',
  });
}

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-test-'));
  test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function generateDocx(fixture: string, dir: string) {
  const docx = path.join(dir, 'resume.docx');
  const result = run(script('create_cv.js'), [path.join(fixtures, fixture), docx]);
  assert.equal(result.status, 0, `create_cv.js failed:\n${result.stderr}`);
  return { docx, pdf: path.join(dir, 'resume.pdf'), result };
}

function sofficeSkipReason(): string | false {
  let soffice: string;
  try {
    soffice = resolveSoffice();
  } catch (error) {
    return `LibreOffice not available: ${(error as Error).message}`;
  }
  if (soffice !== 'soffice') return false;
  return spawnSync('soffice', ['--version']).error ? 'LibreOffice (soffice) not found; install it or set SOFFICE_PATH' : false;
}
const skipPdf = sofficeSkipReason();

// The docx library gives hyperlinks random relationship IDs; number them in order of appearance.
function normalizeIds(xml: string) {
  const ids = new Map<string, string>();
  return xml.replace(/rId[A-Za-z0-9_-]{10,}/g, (id) => {
    if (!ids.has(id)) ids.set(id, `rIdLink${ids.size + 1}`);
    return ids.get(id)!;
  });
}

test('create_cv.js output matches the golden Word XML (design unchanged)', () => {
  const { docx } = generateDocx('resume-valid.yaml', tempDir());
  for (const entry of ['word/document.xml', 'word/styles.xml']) {
    const golden = path.join(fixtures, 'golden', path.basename(entry));
    const actual = normalizeIds(readDocxEntry(docx, entry));
    if (process.env.UPDATE_GOLDEN) {
      fs.mkdirSync(path.dirname(golden), { recursive: true });
      fs.writeFileSync(golden, actual);
    }
    assert.ok(actual === fs.readFileSync(golden, 'utf8'), `${entry} differs from ${golden}`);
  }
});

test('no CV_PHONE: warns and still generates the resume', { skip: skipPdf }, () => {
  const { pdf, result } = generateDocx('resume-valid.yaml', tempDir());
  assert.match(result.stderr, /CV_PHONE not set/);

  const toPdf = run(script('to-pdf.js'), [pdf.replace(/\.pdf$/, '.docx')]);
  assert.equal(toPdf.status, 0, `to-pdf.js failed:\n${toPdf.stderr}`);
  const check = run(script('check-pdf.ts'), [pdf]);
  assert.equal(check.status, 0, `check-pdf.ts failed:\n${check.stderr}`);
});

test('an over-long resume fails the one-page check', { skip: skipPdf }, () => {
  const { docx, pdf } = generateDocx('resume-too-long.yaml', tempDir());

  const toPdf = run(script('to-pdf.js'), [docx]);
  assert.equal(toPdf.status, 0, `to-pdf.js failed:\n${toPdf.stderr}`);
  const check = run(script('check-pdf.ts'), [pdf]);
  assert.equal(check.status, 1);
  assert.match(check.stderr, /has \d+ pages; the resume must be exactly 1/);
});
