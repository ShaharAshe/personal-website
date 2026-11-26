import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, dateRange, displayUrl, boldSegments } from '../scripts/cv/format.js';
import { resolveSoffice, WINDOWS_DEFAULT } from '../scripts/cv/to-pdf.js';

test('formatDate: month, year, and missing', () => {
  assert.equal(formatDate('2025-04'), 'Apr 2025');
  assert.equal(formatDate('2024-12'), 'Dec 2024');
  assert.equal(formatDate('2021'), '2021');
  assert.equal(formatDate(undefined), 'Present');
});

test('dateRange: closed and open-ended', () => {
  assert.equal(dateRange({ startDate: '2025-04', endDate: '2026-04' }), 'Apr 2025 - Apr 2026');
  assert.equal(dateRange({ startDate: '2021' }), '2021 - Present');
});

test('boldSegments: no terms gives one plain segment', () => {
  assert.deepEqual(boldSegments('plain text'), [{ text: 'plain text', bold: false }]);
  assert.deepEqual(boldSegments('plain text', []), [{ text: 'plain text', bold: false }]);
});

test('boldSegments: several terms, a repeated term, regex characters, and a term at the end', () => {
  assert.deepEqual(boldSegments('across 6+ subsystems, 6+ times, with zero incidents', ['6+', 'zero incidents']), [
    { text: 'across ', bold: false },
    { text: '6+', bold: true },
    { text: ' subsystems, ', bold: false },
    { text: '6+', bold: true },
    { text: ' times, with ', bold: false },
    { text: 'zero incidents', bold: true },
  ]);
});

test('boldSegments: joined segments give back the original text', () => {
  const text = 'from 30-60 minutes to 5 minutes (a.b)';
  const joined = boldSegments(text, ['30-60 minutes to 5 minutes', '(a.b)'])
    .map((s: { text: string }) => s.text)
    .join('');
  assert.equal(joined, text);
});

test('displayUrl strips scheme, www and trailing slash', () => {
  assert.equal(displayUrl('https://www.linkedin.com/in/x/'), 'linkedin.com/in/x');
  assert.equal(displayUrl('http://github.com/ShaharAshe'), 'github.com/ShaharAshe');
});

test('resolveSoffice: SOFFICE_PATH wins over everything', () => {
  const soffice = resolveSoffice({
    env: { SOFFICE_PATH: 'D:\\lo\\soffice.exe' },
    platform: 'win32',
    exists: () => true,
  });
  assert.equal(soffice, 'D:\\lo\\soffice.exe');
});

test('resolveSoffice: SOFFICE_PATH that does not exist is an error, not a fallback', () => {
  assert.throws(
    () =>
      resolveSoffice({
        env: { SOFFICE_PATH: 'D:\\missing.exe' },
        platform: 'win32',
        exists: (p) => p === WINDOWS_DEFAULT,
      }),
    /SOFFICE_PATH is set but does not exist/,
  );
});

test('resolveSoffice: default Windows path when installed', () => {
  assert.equal(resolveSoffice({ env: {}, platform: 'win32', exists: (p) => p === WINDOWS_DEFAULT }), WINDOWS_DEFAULT);
});

test('resolveSoffice: plain soffice when not on Windows or not installed there', () => {
  assert.equal(resolveSoffice({ env: {}, platform: 'linux', exists: () => true }), 'soffice');
  assert.equal(resolveSoffice({ env: {}, platform: 'win32', exists: () => false }), 'soffice');
});
