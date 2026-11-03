// Tests for the browser-side email helpers in src/lib/email-client.ts (used by CopyEmail.astro's script):
// joining the parts, the mailto: href, reading parts from data attributes, and the clipboard-failure
// fallback decision. Made-up addresses only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COPY_FEEDBACK_MS, copyText, joinEmail, mailtoHref, readEmailParts } from '../src/lib/email-client.ts';

const parts = { user: 'jane', domain: 'example.com' };

test('joinEmail joins user and domain with one "@"', () => {
  assert.equal(joinEmail(parts), 'jane@example.com');
  assert.equal(joinEmail({ user: 'jane.doe+jobs', domain: 'mail.example.org' }), 'jane.doe+jobs@mail.example.org');
});

test('mailtoHref builds a mailto: link to the joined address', () => {
  assert.equal(mailtoHref(parts), 'mailto:jane@example.com');
});

test('readEmailParts reads data-email-user / data-email-domain', () => {
  assert.deepEqual(readEmailParts({ emailUser: 'jane', emailDomain: 'example.com' }), parts);
});

test('readEmailParts returns null when a part is missing or empty', () => {
  assert.equal(readEmailParts({}), null);
  assert.equal(readEmailParts({ emailUser: 'jane' }), null);
  assert.equal(readEmailParts({ emailDomain: 'example.com' }), null);
  assert.equal(readEmailParts({ emailUser: '', emailDomain: 'example.com' }), null);
  assert.equal(readEmailParts({ emailUser: 'jane', emailDomain: '' }), null);
});

test('readEmailParts returns null when a part contains "@" (an already-joined address)', () => {
  assert.equal(readEmailParts({ emailUser: 'jane@example.com', emailDomain: 'example.com' }), null);
  assert.equal(readEmailParts({ emailUser: 'jane', emailDomain: '@example.com' }), null);
});

test('copyText: a working clipboard gets the text, result "copied"', async () => {
  const written: string[] = [];
  const clipboard = { writeText: async (text: string) => void written.push(text) };
  assert.equal(await copyText('jane@example.com', clipboard), 'copied');
  assert.deepEqual(written, ['jane@example.com']);
});

test('copyText: writeText rejecting (permission denied) falls back to "manual"', async () => {
  const clipboard = { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) };
  assert.equal(await copyText('jane@example.com', clipboard), 'manual');
});

test('copyText: writeText throwing synchronously falls back to "manual"', async () => {
  const clipboard = {
    writeText(): Promise<void> {
      throw new Error('boom');
    },
  };
  assert.equal(await copyText('jane@example.com', clipboard), 'manual');
});

test('copyText: no clipboard (insecure context, old browser) falls back to "manual"', async () => {
  assert.equal(await copyText('jane@example.com', undefined), 'manual');
  assert.equal(await copyText('jane@example.com', {} as Pick<Clipboard, 'writeText'>), 'manual');
});

test('the "Copied" feedback lasts about 2 seconds', () => {
  assert.equal(COPY_FEEDBACK_MS, 2000);
});
