// The Content-Security-Policy and security headers (Task 2.14, design-doc §12). The first part tests the pure
// helpers in scripts/csp/csp.mts on fixtures; the second checks the real build: every inline <script> and <style> on
// every page (404 included) has its hash in the policy dist/_headers sends for that page, nothing in the HTML needs
// more than a hash, and the headers file stays within Cloudflare's limits. That the browser accepts the policy is in
// tests/e2e/csp.spec.ts (npm run test:e2e).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CF_BEACON_SCRIPT,
  CF_INSIGHTS_CONNECT,
  CSP_TEMPLATE,
  MAX_HEADERS_LINE_LENGTH,
  MAX_HEADERS_RULES,
  applyCsp,
  buildPolicy,
  checkHeadersLimits,
  extractInline,
  findUnhashable,
  listHtmlPages,
  parseHeaders,
  sha256Source,
  writeCspHeaders,
  type HeadersRule,
} from '../scripts/csp/csp.mts';
import { themeInitScript } from '../src/lib/theme.ts';

const ROOT = path.join(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const skip = fs.existsSync(path.join(DIST, '_headers')) ? false : 'no dist/_headers: run npm run build first';

// The headers every path must get, besides the CSP. X-Robots-Tag stays until the custom domain (plan.md Task 4.2).
const OTHER_HEADERS = {
  'Permissions-Policy': /^accelerometer=\(\), .*camera=\(\), .*geolocation=\(\), .*microphone=\(\), .*payment=\(\)/,
  'Cross-Origin-Opener-Policy': /^same-origin$/,
  'X-Frame-Options': /^DENY$/,
  'Strict-Transport-Security': /^max-age=31536000$/,
  'X-Content-Type-Options': /^nosniff$/,
  'Referrer-Policy': /^strict-origin-when-cross-origin$/,
};

// --- helpers, on fixtures ---

test('sha256Source matches a known CSP hash', () => {
  // The CSP spec's own example: <script>alert('Hello, world.');</script>
  assert.equal(sha256Source("alert('Hello, world.');"), 'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng=');
});

test('extractInline returns inline scripts and styles, skipping src scripts and JSON-LD', () => {
  const html = [
    '<script>one()</script>',
    '<script type="module">two()</script>',
    '<script type="module" src="/_astro/a.js"></script>',
    '<script type="application/ld+json">{"@type":"Person"}</script>',
    '<style>a{color:red}</style>',
    '<style media="print">\r\nb{}\r\n</style>',
  ].join('\n');
  assert.deepEqual(extractInline(html), {
    scripts: ['one()', 'two()'],
    // CRLF becomes LF, as the HTML parser does before the browser hashes it.
    styles: ['a{color:red}', '\nb{}\n'],
  });
});

test('findUnhashable reports style attributes, inline handlers and javascript: URLs', () => {
  const findings = findUnhashable(
    [
      '<div style="color:red">a</div>',
      '<button onclick="go()">b</button>',
      '<a href=" JavaScript:alert(1)">c</a>',
      '<img src="/x.png" onerror=\'x()\'>',
    ].join(''),
  );
  assert.equal(findings.length, 4);
  assert.match(findings[0]!, /^style attribute/);
  assert.match(findings[1]!, /^inline event handler \(onclick\)/);
  assert.match(findings[2]!, /^javascript: URL/);
  assert.match(findings[3]!, /^inline event handler \(onerror\)/);
});

test('findUnhashable ignores text, script and style bodies, data attributes and ">" inside quoted values', () => {
  const html = [
    '<p>Set style="x" or onclick=y in text</p>',
    '<script>el.setAttribute("style", "x"); const s = \'<a onclick="x">\';</script>',
    '<style>a[style="x"]{}</style>',
    '<div class="[&>svg]:size-4" data-onclick="x" data-style="y" aria-label="javascript: no">ok</div>',
    '<a href="/javascript:-guide">link</a>',
  ].join('');
  assert.deepEqual(findUnhashable(html), []);
});

test('buildPolicy writes the expected directives, with hashes deduplicated and sorted', () => {
  const policy = buildPolicy({ scriptHashes: ['sha256-b', 'sha256-a', 'sha256-b'], styleHashes: ['sha256-c'] });
  assert.equal(
    policy,
    "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com/beacon.min.js 'sha256-a' " +
      "'sha256-b'; style-src 'self' 'sha256-c'; img-src 'self'; font-src 'self'; " +
      "connect-src 'self' https://cloudflareinsights.com; object-src 'none'; base-uri 'none'; form-action 'none'; " +
      "frame-ancestors 'none'",
  );
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/);
});

test('applyCsp replaces the one template line and keeps its indentation', () => {
  const out = applyCsp(`/*\n  ${CSP_TEMPLATE}\n  X-Frame-Options: DENY\n`, "default-src 'self'");
  assert.equal(out, "/*\n  Content-Security-Policy: default-src 'self'\n  X-Frame-Options: DENY\n");
});

test('applyCsp fails when the template line is missing or repeated', () => {
  assert.throws(() => applyCsp('/*\n  X-Frame-Options: DENY\n', 'x'), /exactly once \(found 0\)/);
  assert.throws(() => applyCsp(`/*\n  ${CSP_TEMPLATE}\n/a\n  ${CSP_TEMPLATE}\n`, 'x'), /exactly once \(found 2\)/);
});

test('parseHeaders reads paths, headers and detached headers, skipping comments', () => {
  const rules = parseHeaders('# comment\n/*\n  A: 1\n  B: x: y\n\n/pdf\n  ! A\n');
  assert.deepEqual(rules, [
    {
      path: '/*',
      headers: [
        { name: 'A', value: '1' },
        { name: 'B', value: 'x: y' },
      ],
      detached: [],
    },
    { path: '/pdf', headers: [], detached: ['A'] },
  ]);
});

test('checkHeadersLimits: a line over 2,000 characters is reported with its line number and length', () => {
  const long = `  Content-Security-Policy: ${'x'.repeat(MAX_HEADERS_LINE_LENGTH)}`;
  assert.deepEqual(checkHeadersLimits(`/*\n  A: 1\n${'  B: ' + 'y'.repeat(MAX_HEADERS_LINE_LENGTH - 5)}\n`), []);
  const errors = checkHeadersLimits(`/*\n  A: 1\n${long}\n`, 'dist/_headers');
  assert.equal(errors.length, 1);
  assert.match(errors[0]!, new RegExp(`^dist/_headers line 3 is ${long.length} characters \\(max 2000\\)`));
});

test('checkHeadersLimits: more than 100 rules is reported', () => {
  const rules = (n: number) => Array.from({ length: n }, (_, i) => `/p${i}\n  A: 1`).join('\n');
  assert.deepEqual(checkHeadersLimits(rules(MAX_HEADERS_RULES)), []);
  assert.deepEqual(checkHeadersLimits(rules(MAX_HEADERS_RULES + 1)), ['_headers has 101 rules (max 100)']);
});

test('writeCspHeaders fails the build on unhashable markup and on a line over the limit', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-'));
  try {
    fs.writeFileSync(path.join(dir, '_headers'), `/*\n  ${CSP_TEMPLATE}\n`);
    fs.writeFileSync(path.join(dir, 'index.html'), '<div onclick="x()"></div>');
    assert.throws(() => writeCspHeaders(dir), /index\.html: inline event handler \(onclick\)/);

    // 40 different inline scripts: 40 hashes of ~55 characters push the CSP line past 2,000.
    const scripts = Array.from({ length: 40 }, (_, i) => `<script>s${i}()</script>`).join('');
    fs.writeFileSync(path.join(dir, 'index.html'), scripts);
    assert.throws(() => writeCspHeaders(dir), /dist\/_headers line 2 is \d{4} characters \(max 2000\)/);
    // A failed check leaves the template in place: nothing half-written.
    assert.match(fs.readFileSync(path.join(dir, '_headers'), 'utf8'), new RegExp(CSP_TEMPLATE));

    fs.writeFileSync(path.join(dir, 'index.html'), '<script>ok()</script>');
    const result = writeCspHeaders(dir);
    assert.deepEqual(result.scriptHashes, [sha256Source('ok()')]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('public/_headers has the fail-closed template line in the /* rule', () => {
  const rules = parseHeaders(fs.readFileSync(path.join(ROOT, 'public', '_headers'), 'utf8'));
  const all = rules.find((rule) => rule.path === '/*');
  assert.ok(all, 'no /* rule in public/_headers');
  assert.deepEqual(
    all.headers.filter(({ name }) => name === 'Content-Security-Policy').map(({ value }) => value),
    ["default-src 'none'"],
  );
});

// --- the build ---

const headersText = skip ? '' : fs.readFileSync(path.join(DIST, '_headers'), 'utf8');
const rules = skip ? [] : parseHeaders(headersText);
const allPaths = rules.find((rule) => rule.path === '/*');
const policy = allPaths?.headers.find(({ name }) => name === 'Content-Security-Policy')?.value ?? '';
const directive = (name: string) =>
  policy
    .split(';')
    .map((part) => part.trim().split(/\s+/))
    .find(([key]) => key === name)
    ?.slice(1) ?? [];
const pages = skip
  ? []
  : listHtmlPages(DIST).map((file) => ({ file, html: fs.readFileSync(path.join(DIST, file), 'utf8') }));

test('the build has the three pages, 404 included', { skip }, () => {
  assert.deepEqual(
    pages.map(({ file }) => file.replace(/\\/g, '/')),
    ['404.html', 'index.html', 'resume/index.html'],
  );
});

test(
  'dist/_headers: the /* rule sends the real CSP (template replaced) and every other security header',
  { skip },
  () => {
    assert.ok(allPaths, 'no /* rule in dist/_headers');
    assert.doesNotMatch(headersText, new RegExp(CSP_TEMPLATE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(allPaths.headers.filter(({ name }) => name === 'Content-Security-Policy').length, 1);
    assert.match(
      policy,
      /^default-src 'self'; script-src 'self' https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js 'sha256-/,
    );
    for (const [name, value] of Object.entries(OTHER_HEADERS)) {
      const sent: HeadersRule['headers'] = allPaths.headers.filter((header) => header.name === name);
      assert.equal(sent.length, 1, `${name} missing or repeated in the /* rule`);
      assert.match(sent[0]!.value, value, name);
    }
  },
);

test(
  'dist/_headers: no other rule sets or removes a security header (the 404 page gets /* like every path)',
  { skip },
  () => {
    const names = ['Content-Security-Policy', 'Content-Security-Policy-Report-Only', ...Object.keys(OTHER_HEADERS)];
    for (const rule of rules.filter((r) => r !== allPaths)) {
      for (const name of names) {
        assert.ok(!rule.headers.some((header) => header.name === name), `${rule.path} sets ${name}`);
        assert.ok(!rule.detached.includes(name), `${rule.path} removes ${name}`);
      }
    }
  },
);

test('the CSP has the expected directives and never unsafe-inline or unsafe-eval', { skip }, () => {
  assert.deepEqual(
    policy.split(';').map((part) => part.trim().split(/\s+/)[0]),
    [
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'font-src',
      'connect-src',
      'object-src',
      'base-uri',
      'form-action',
      'frame-ancestors',
    ],
  );
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval|\*/);
  assert.deepEqual(directive('frame-ancestors'), ["'none'"]);
  assert.deepEqual(directive('object-src'), ["'none'"]);
});

test(
  'the only third-party sources are the Web Analytics beacon (script-src) and its endpoint (connect-src)',
  { skip },
  () => {
    const [self, beacon, ...hashes] = directive('script-src');
    assert.deepEqual([self, beacon], ["'self'", 'https://static.cloudflareinsights.com/beacon.min.js']);
    assert.equal(beacon, CF_BEACON_SCRIPT);
    assert.ok(hashes.length > 0);
    for (const hash of hashes) assert.match(hash, /^'sha256-[A-Za-z0-9+/]+=*'$/);
    assert.ok(
      directive('style-src')
        .slice(1)
        .every((source) => /^'sha256-/.test(source)),
    );
    assert.deepEqual(directive('connect-src'), ["'self'", 'https://cloudflareinsights.com']);
    assert.equal(directive('connect-src')[1], CF_INSIGHTS_CONNECT);
    // Every other directive is exactly as in Task 2.14.
    const unchanged: Record<string, string[]> = {
      'default-src': ["'self'"],
      'img-src': ["'self'"],
      'font-src': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'none'"],
      'form-action': ["'none'"],
      'frame-ancestors': ["'none'"],
    };
    for (const [name, sources] of Object.entries(unchanged)) assert.deepEqual(directive(name), sources, name);
    assert.equal(directive('style-src')[0], "'self'");
  },
);

for (const { file, html } of pages) {
  test(`${file}: every inline script and style has its hash in the CSP`, { skip }, () => {
    const { scripts, styles } = extractInline(html);
    assert.ok(scripts.length > 0, 'expected at least the no-flash theme script');
    const scriptSrc = directive('script-src');
    const styleSrc = directive('style-src');
    for (const text of scripts) {
      assert.ok(scriptSrc.includes(`'${sha256Source(text)}'`), `script not allowed: ${text.slice(0, 80)}`);
    }
    for (const text of styles) {
      assert.ok(styleSrc.includes(`'${sha256Source(text)}'`), `style not allowed: ${text.slice(0, 80)}`);
    }
  });

  test(`${file}: no style attributes, inline event handlers or javascript: URLs`, { skip }, () => {
    assert.deepEqual(findUnhashable(html), []);
  });

  test(
    `${file}: the no-flash script is inlined exactly as themeInitScript, and its hash is in the CSP`,
    { skip },
    () => {
      assert.ok(extractInline(html).scripts.includes(themeInitScript), 'themeInitScript not inlined verbatim');
      assert.ok(directive('script-src').includes(`'${sha256Source(themeInitScript)}'`));
    },
  );
}

test('dist/_headers stays within Cloudflare limits (2,000 characters per line, 100 rules)', { skip }, (t) => {
  assert.deepEqual(checkHeadersLimits(headersText, 'dist/_headers'), []);
  const cspLine = headersText.split('\n').find((line) => line.trim().startsWith('Content-Security-Policy:')) ?? '';
  // Not an assertion on the exact length: printed so a growing policy is visible in the test output.
  t.diagnostic(`CSP line: ${cspLine.length}/${MAX_HEADERS_LINE_LENGTH} characters`);
});
