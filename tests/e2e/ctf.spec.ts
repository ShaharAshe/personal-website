// The CTF chain (Task F.2) solved like a visitor would, against `wrangler dev` (the real _headers) locally and the
// deployed site in the live run (npm run test:live): the page source, the console, the response headers, the PNG's
// bytes and the .well-known file. Each next location is read from the clue text itself, never from the module; the
// module is used only at the very end, to check the assembled answer. The texts themselves are in tests/ctf.test.ts.

import { expect, test } from './fixtures.ts';
import { ctfAnswer } from '../../src/lib/ctf.mts';

/** The first root-relative path in a clue, e.g. "/favicon.ico" (a trailing "." or ")" isn't part of it). */
const pathIn = (text: string) => text.match(/(\/[\w.-]+(?:\/[\w.-]+)*)/)?.[1]?.replace(/\.$/, '');

const partIn = (text: string, i: number) => text.match(new RegExp(`Part ${i}: "([^"]+)"`))?.[1];

/** A visitor's ROT13 (independent of the module's). */
const rot13 = (text: string) =>
  text.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });

/** What `strings` prints: runs of 4+ printable ASCII characters. */
const strings = (bytes: Buffer) => bytes.toString('latin1').match(/[\x20-\x7e]{4,}/g) ?? [];

test('a solver follows the chain from View Source to /.well-known/ and assembles the final answer', async ({
  page,
  request,
}) => {
  const parts: string[] = [];

  // 0: View Source on the homepage. One HTML comment, pointing to the console.
  const source = await (await request.get('/')).text();
  const comment =
    [...source.matchAll(/<!--([\s\S]*?)-->/g)].map(([, body]) => body!).find((body) => /clue 0/.test(body)) ?? '';
  expect(comment).toContain('clue 0');
  parts.push(partIn(comment, 0)!);
  expect(comment).toMatch(/Next: .*DevTools console/);

  // 1: the console. A base64 line; decoded, it names the next path.
  const logs: string[] = [];
  page.on('console', (message) => logs.push(message.text()));
  await page.goto('/');
  await page.waitForLoadState('load');
  await expect.poll(() => logs.some((text) => /Clue 1 \(base64\): /.test(text))).toBe(true);
  const base64 = logs.join('\n').match(/Clue 1 \(base64\): ([A-Za-z0-9+/=]+)/)![1]!;
  const clue1 = Buffer.from(base64, 'base64').toString('utf8');
  parts.push(partIn(clue1, 1)!);
  const headersPath = pathIn(clue1.slice(clue1.indexOf('Next:')))!;
  expect(headersPath).toBe('/favicon.ico');

  // 2: the response headers of that path (curl -I). X-Clue names the image.
  const iconResponse = await request.head(headersPath);
  expect(iconResponse.status()).toBe(200);
  const clue2 = iconResponse.headers()['x-clue'] ?? '';
  parts.push(partIn(clue2, 2)!);
  const imagePath = pathIn(clue2.slice(clue2.indexOf('Next:')))!;
  expect(imagePath).toBe('/og-image.png');

  // 3: the image's metadata, read like `strings` would. It names the .well-known file.
  const imageResponse = await request.get(imagePath);
  expect(imageResponse.status()).toBe(200);
  const clue3 = strings(await imageResponse.body()).find((run) => run.includes('Part 3:')) ?? '';
  parts.push(partIn(clue3, 3)!);
  const filePath = pathIn(clue3.slice(clue3.indexOf('Next:')))!;
  expect(filePath).toBe('/.well-known/ctf.txt');
  expect(clue3).toContain('ROT13');

  // 4: the file, plain text, ROT13. The last part, how to assemble the answer, and the ending.
  const fileResponse = await request.get(filePath);
  expect(fileResponse.status()).toBe(200);
  expect(fileResponse.headers()['content-type']).toMatch(/^text\/plain/);
  const clue4 = rot13(await fileResponse.text());
  parts.push(partIn(clue4, 4)!);
  expect(clue4).toContain("If you'd like to get in touch, mention the final answer.");
  const joiner = clue4.includes('join them with hyphens') ? '-' : undefined;
  expect(joiner).toBe('-');

  expect(parts.every(Boolean)).toBe(true);
  expect(parts.join(joiner)).toBe(ctfAnswer());
});

test('the clue 0 comment is only on the homepage', async ({ request }) => {
  for (const path of ['/resume', '/no-such-page']) {
    const html = await (await request.get(path)).text();
    expect(html, path).not.toContain('clue 0');
  }
});
