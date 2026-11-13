// BaseLayout (Task 2.2) checks that need a real browser: skip link behavior, keyboard focus rings,
// self-hosted fonts actually loading, and the published resume PDF. The built markup itself is covered
// by tests/base-layout.test.ts (node:test).

import { expect, test } from './fixtures.ts';
import { getResume } from '../../src/lib/resume.ts';
import { expectFocusRing, NAV_LINKS } from './helpers.ts';

test('skip link: hidden until focused, first Tab stop, Enter moves focus to <main>', async ({ page }) => {
  await page.goto('/');
  const skipLink = page.getByRole('link', { name: 'Skip to content' });
  await expect(skipLink).not.toBeInViewport();

  await page.keyboard.press('Tab');
  await expectFocusRing(skipLink);
  await expect(skipLink).toBeInViewport();

  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('nav links show a focus ring when reached by keyboard', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });

  await page.keyboard.press('Tab'); // skip link
  // The default 1280px viewport shows the home link (the name) before the section links.
  for (const name of [getResume().basics.name, ...NAV_LINKS]) {
    await page.keyboard.press('Tab');
    await expectFocusRing(nav.getByRole('link', { name }));
  }
});

// Astro's Fonts API exposes each family as a CSS variable whose first entry is the self-hosted face
// (a hashed name such as Inter-427b…), followed by a metric-matched local fallback. Loading that first
// family explicitly checks the files in dist/ load, whatever the page content happens to use.
for (const cssVariable of ['--font-inter', '--font-jetbrains-mono']) {
  test(`self-hosted font loads (${cssVariable})`, async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async (variable) => {
      const value = getComputedStyle(document.documentElement).getPropertyValue(variable);
      const family = value
        .split(',')[0]
        .trim()
        .replace(/^["']|["']$/g, '');
      await document.fonts.load(`16px "${family}"`);
      await document.fonts.ready;
      const statuses = [...document.fonts]
        .filter((face) => face.family.replace(/^["']|["']$/g, '') === family)
        .map((face) => face.status);
      return { family, statuses };
    }, cssVariable);

    expect(result.family).not.toBe('');
    expect(result.family).not.toContain('fallback');
    expect(result.statuses).toContain('loaded');
  });
}

test('/resume.pdf is served as a PDF', async ({ request }) => {
  const response = await request.get('/resume.pdf');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^application\/pdf\b/);
});
