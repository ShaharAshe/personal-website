// Tests for the motion added in Task 3.4 (design-doc §10): the section entrance's pure rules in src/lib/reveal.ts, then
// the build (dist/, skipped without one): which sections carry data-reveal, that nothing is hidden in the HTML, and
// that every motion rule in the built CSS sits inside a prefers-reduced-motion: no-preference query. What a browser
// does with them is checked by tests/e2e/motion.spec.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DONE, OBSERVER_OPTIONS, PENDING, REVEAL_ATTR, revealsNow, startsPending } from '../src/lib/reveal.ts';

// --- startsPending ---

const VIEWPORT = 800;

test('startsPending: only a section entirely below the screen starts hidden', () => {
  assert.equal(startsPending({ top: 1200, id: 'skills' }, VIEWPORT, ''), true);
  // Exactly at the bottom edge: none of it is on screen yet.
  assert.equal(startsPending({ top: VIEWPORT, id: 'skills' }, VIEWPORT, ''), true);
  // One pixel on screen: it stays as it is, it never blinks out.
  assert.equal(startsPending({ top: VIEWPORT - 1, id: 'skills' }, VIEWPORT, ''), false);
  assert.equal(startsPending({ top: 0, id: 'skills' }, VIEWPORT, ''), false);
  // Above the screen (the page was opened scrolled down).
  assert.equal(startsPending({ top: -2000, id: 'skills' }, VIEWPORT, ''), false);
});

test("startsPending: the URL hash's target never starts hidden, wherever it is", () => {
  assert.equal(startsPending({ top: 3000, id: 'contact' }, VIEWPORT, '#contact'), false);
  // Another section below the screen still does.
  assert.equal(startsPending({ top: 3000, id: 'skills' }, VIEWPORT, '#contact'), true);
  // A section with no id never matches an empty hash or a bare "#".
  assert.equal(startsPending({ top: 3000, id: '' }, VIEWPORT, '#'), true);
  assert.equal(startsPending({ top: 3000, id: '' }, VIEWPORT, ''), true);
});

// --- revealsNow ---

test('revealsNow: on entering the screen, or once it is above the screen', () => {
  assert.equal(revealsNow({ isIntersecting: true, bottom: 900 }), true);
  // A section taller than the screen: intersecting with its bottom far below.
  assert.equal(revealsNow({ isIntersecting: true, bottom: 5000 }), true);
  // Still below the screen.
  assert.equal(revealsNow({ isIntersecting: false, bottom: 1500 }), false);
  // A jump (e.g. to /#contact) went past it: it reveals rather than stay hidden above the visitor.
  assert.equal(revealsNow({ isIntersecting: false, bottom: -10 }), true);
  assert.equal(revealsNow({ isIntersecting: false, bottom: 0 }), true);
});

test('the observer uses threshold 0 and a bottom margin, so a section taller than the screen still reveals', () => {
  assert.equal(OBSERVER_OPTIONS.threshold, 0);
  assert.match(String(OBSERVER_OPTIONS.rootMargin), /^0px 0px -\d+% 0px$/);
  assert.deepEqual([REVEAL_ATTR, PENDING, DONE], ['data-reveal', 'pending', 'done']);
});

// --- The build ---

const ROOT = path.join(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const skip = fs.existsSync(path.join(DIST, 'index.html')) ? false : 'no dist/index.html: run npm run build first';
const read = (file: string) => fs.readFileSync(path.join(DIST, file), 'utf8');
const PAGES = ['index.html', 'resume/index.html', '404.html'];

/** The opening tags of every element carrying data-reveal. */
const revealTags = (html: string) => [...html.matchAll(/<[a-z]+\b[^>]*\sdata-reveal\b[^>]*>/g)].map(([tag]) => tag);

test('exactly the four homepage sections after the Hero carry a bare data-reveal', { skip }, () => {
  const tags = revealTags(read('index.html'));
  const ids = tags.map((tag) => tag.match(/\sid="([^"]+)"/)?.[1]);
  assert.deepEqual(ids, ['experience', 'projects', 'skills', 'contact']);
  for (const tag of tags) {
    assert.match(tag, /^<section\b/);
    // Bare or empty: a value would mean a state set in the HTML, hiding the section without JS.
    assert.match(tag, /\sdata-reveal(="")?[\s>]/, tag);
  }
  const hero = read('index.html').match(/<section\b[^>]*\bdata-hero\b[^>]*>/)?.[0] ?? '';
  assert.ok(hero, 'no Hero');
  assert.doesNotMatch(hero, /data-reveal/);
});

test('/resume and the 404 page have no entrance', { skip }, () => {
  for (const file of ['resume/index.html', '404.html']) assert.deepEqual(revealTags(read(file)), [], file);
});

test('no page is hidden in its HTML: no data-reveal state', { skip }, () => {
  for (const file of PAGES) {
    assert.doesNotMatch(read(file), /data-reveal="(pending|done)"/, file);
  }
});

/** The built stylesheet(s) a page links. */
function linkedCss(file: string): string {
  const html = read(file);
  return [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)]
    .map(([, href]) => fs.readFileSync(path.join(DIST, href), 'utf8'))
    .join('\n');
}

/** The preludes of the at-rules around `index` in minified CSS (outermost first), e.g. ['@media screen and (...)']. */
function enclosingAtRules(css: string, index: number): string[] {
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < index; i++) {
    if (css[i] === '{') {
      stack.push(css.slice(start, i).trim());
      start = i + 1;
    } else if (css[i] === '}') {
      stack.pop();
      start = i + 1;
    } else if (css[i] === ';') {
      start = i + 1;
    }
  }
  return stack.filter((prelude) => prelude.startsWith('@'));
}

const NO_PREFERENCE = /prefers-reduced-motion:\s*no-preference/;

/** Every place `pattern` appears in the CSS, with the at-rules around it. */
function uses(css: string, pattern: RegExp) {
  return [...css.matchAll(new RegExp(pattern, 'g'))].map((match) => ({
    text: match[0],
    atRules: enclosingAtRules(css, match.index),
  }));
}

test(
  'the cross-document View Transition is only inside a prefers-reduced-motion: no-preference query',
  { skip },
  () => {
    const css = linkedCss('index.html');
    const rules = uses(css, /@view-transition/);
    assert.equal(rules.length, 1, '@view-transition rules');
    assert.ok(
      rules[0].atRules.some((prelude) => NO_PREFERENCE.test(prelude)),
      `@view-transition is inside ${JSON.stringify(rules[0].atRules)}`,
    );
    assert.match(css, /@view-transition\{navigation:auto\}/);
    // Every page links the same stylesheet, so every page opts in (a transition needs both pages to).
    for (const file of PAGES) assert.match(linkedCss(file), /@view-transition\{navigation:auto\}/, file);
    for (const use of uses(css, /::view-transition-(old|new|group)\(root\)/)) {
      assert.ok(
        use.atRules.some((prelude) => NO_PREFERENCE.test(prelude)),
        use.text,
      );
    }
  },
);

test(
  'the entrance and the card hover are screen-only, without reduced motion, and transform/opacity only',
  { skip },
  () => {
    const css = linkedCss('index.html');
    const rules = uses(css, /\[data-reveal=(pending|done)\][^{]*\{|\[data-project-card\](:hover)?\{/);
    assert.equal(rules.length, 4, JSON.stringify(rules));
    for (const { text, atRules } of rules) {
      assert.ok(
        atRules.some((prelude) => /screen/.test(prelude) && NO_PREFERENCE.test(prelude)),
        `${text} is inside ${JSON.stringify(atRules)}`,
      );
    }
    // The card's hover only on devices that can hover.
    for (const { text, atRules } of rules.filter(({ text }) => text.startsWith('[data-project-card]'))) {
      assert.ok(atRules.includes('@media (hover:hover)'), text);
    }
    // The children move, never the section itself: its box is what a /#hash jump scrolls to and what the observer sees.
    assert.match(css, /\[data-reveal=pending\]>\*\{opacity:0;transform:translateY\(12px\)\}/);
    assert.match(css, /\[data-reveal=done\]>\*\{transition:opacity \.5s ease-out,transform \.5s ease-out\}/);
    assert.doesNotMatch(css, /\[data-reveal=(pending|done)\]\{/);
    assert.match(css, /\[data-project-card\]\{transition:transform \.2s ease-out\}/);
    assert.match(css, /\[data-project-card\]:hover\{transform:translateY\(-2px\)\}/);
  },
);

test('the entrance ships as its own small inline script on the homepage only', { skip }, () => {
  const scripts = (file: string) =>
    [...read(file).matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(([, js]) => js);
  const reveal = scripts('index.html').filter((js) => js.includes('IntersectionObserver'));
  assert.equal(reveal.length, 1, 'inline scripts using IntersectionObserver on the homepage');
  assert.ok(!reveal[0].includes('[data-theme-toggle]'), 'the entrance is folded into the toggle script');
  for (const file of ['resume/index.html', '404.html']) {
    assert.ok(!scripts(file).some((js) => js.includes('IntersectionObserver')), file);
  }
});
