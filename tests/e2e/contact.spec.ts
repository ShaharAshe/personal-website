// Contact (Task 2.9) in a real browser: the email assembled after load (Contact and Hero mailto links,
// the shown address), Copy by mouse and keyboard with the "Copied ✓" feedback, the clipboard-denied
// fallback, the no-JavaScript fallback, the nav link, and the layout at 375px and 1280px in both themes.
// What the built HTML contains is checked by tests/contact.test.ts (npm test).
//
// The real address is never printed: every comparison with it is `expect(a === b).toBe(true)`, so a
// failure shows only true/false.

import { expect, test, type Page } from '@playwright/test';
import { THEMES } from '../../src/lib/theme.ts';
import { COPY_FEEDBACK_MS, joinEmail, mailtoHref } from '../../src/lib/email-client.ts';
import { getEmailParts } from '../../src/lib/resume.ts';
import { expectFocusRing, expectTheme } from './helpers.ts';

const ADDRESS = joinEmail(getEmailParts());
const MAILTO = mailtoHref(getEmailParts());

const contact = (page: Page) => page.locator('[data-contact]');
const copyButton = (page: Page) => contact(page).locator('button[data-email-copy]');
const copied = (page: Page) => copyButton(page).locator('[data-copy-done]');
const idle = (page: Page) => copyButton(page).locator('[data-copy-idle]');
const status = (page: Page) => contact(page).locator('[data-copy-status]');
const hint = (page: Page) => contact(page).locator('[data-copy-hint]');
const heroEmail = (page: Page) => page.locator('[data-hero]').getByRole('link', { name: 'Email', exact: true });
const contactMailto = (page: Page) => contact(page).getByRole('link', { name: 'Open in mail app' });

async function clipboardText(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

test('the nav Contact link brings the section into view', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Contact' }).click();
  await expect(page).toHaveURL(/#contact$/);
  await expect(contact(page).getByRole('heading', { level: 2, name: "Let's talk" })).toBeInViewport();
});

test('after load, the address and both mailto links (Contact and Hero) point to the right address', async ({
  page,
}) => {
  await page.goto('/');
  await expect(contactMailto(page)).toBeVisible();
  await expect(heroEmail(page)).toBeVisible();
  expect((await contactMailto(page).getAttribute('href')) === MAILTO).toBe(true);
  expect((await heroEmail(page).getAttribute('href')) === MAILTO).toBe(true);
  expect((await contact(page).locator('[data-email-address]').textContent()) === ADDRESS).toBe(true);
  await expect(contact(page).locator('[data-email-nojs]')).toHaveCount(0);
});

test.describe('with clipboard access', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('clicking Copy copies the address and shows "Copied ✓" for about 2 seconds', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await expect(idle(page)).toBeVisible();
    await expect(copied(page)).toBeHidden();

    await copyButton(page).click();
    await expect(copied(page)).toBeVisible();
    await expect(copied(page)).toHaveText('Copied ✓');
    await expect(idle(page)).toBeHidden();
    await expect(status(page)).toHaveText('Email address copied');
    expect((await clipboardText(page)) === ADDRESS).toBe(true);
    await expect(hint(page)).toBeHidden();

    await page.clock.runFor(COPY_FEEDBACK_MS);
    await expect(copied(page)).toBeHidden();
    await expect(idle(page)).toBeVisible();
    await expect(status(page)).toHaveText('');
  });

  test('keyboard: Tab reaches Copy with a focus ring; Enter and Space both copy', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    // Focus by keyboard (Shift+Tab, Tab), so :focus-visible applies.
    await copyButton(page).focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expectFocusRing(copyButton(page));
    await expect(copyButton(page)).toHaveAccessibleName('Copy email address');

    for (const key of ['Enter', 'Space']) {
      await page.evaluate(() => navigator.clipboard.writeText(''));
      await page.keyboard.press(key);
      await expect(copied(page)).toBeVisible();
      expect((await clipboardText(page)) === ADDRESS, `${key} copied the address`).toBe(true);
      await page.clock.runFor(COPY_FEEDBACK_MS);
      await expect(copied(page)).toBeHidden();
      await expect(copyButton(page)).toBeFocused();
    }
  });
});

test('clipboard denied: the address is selected and a hint says to copy it by hand', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Clipboard.prototype, 'writeText', {
      value: () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError')),
    });
  });
  await page.goto('/');
  await copyButton(page).click();

  await expect(hint(page)).toBeVisible();
  await expect(hint(page)).toContainText('The address is selected');
  await expect(status(page)).toContainText('The address is selected');
  await expect(copied(page)).toBeHidden();
  await expect(idle(page)).toBeVisible();
  expect((await page.evaluate(() => getSelection()?.toString())) === ADDRESS).toBe(true);
});

test('no clipboard API at all (e.g. an insecure context): the same fallback', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined });
  });
  await page.goto('/');
  await copyButton(page).click();
  await expect(hint(page)).toBeVisible();
  expect((await page.evaluate(() => getSelection()?.toString())) === ADDRESS).toBe(true);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the fallback line shows, and no email element is visible or reachable by Tab', async ({ page }) => {
    await page.goto('/');
    await expect(contact(page).locator('[data-email-nojs]')).toBeVisible();
    await expect(contact(page).locator('[data-email-nojs]')).toContainText('LinkedIn');
    for (const el of await page.locator('[data-email-reveal]').all()) await expect(el).toBeHidden();
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    await expect(contact(page).getByRole('link', { name: 'View my LinkedIn profile' })).toBeVisible();

    // Walk the whole Tab order: no stop is an email element.
    const stops = await page.evaluate(
      () => document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]').length,
    );
    for (let i = 0; i < stops + 2; i++) {
      await page.keyboard.press('Tab');
      const onEmail = await page.evaluate(
        () => !!document.activeElement?.closest('[data-email-reveal], [data-email-link], [data-email-copy]'),
      );
      expect(onEmail, `Tab stop ${i + 1} is an email element`).toBe(false);
    }
  });
});

for (const width of [375, 1280]) {
  for (const theme of THEMES) {
    test.describe(`Contact at ${width}px, ${theme}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: theme });

      test('no horizontal scroll; cards, Copy and links inside the viewport width', async ({ page }) => {
        await page.goto('/');
        await expectTheme(page, theme);

        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

        const parts = [
          contact(page).locator('[data-contact-card="email"]'),
          contact(page).locator('[data-contact-card="linkedin"]'),
          contact(page).locator('[data-email-address]'),
          copyButton(page),
          contactMailto(page),
          contact(page).locator('[data-contact-linkedin]'),
          contact(page).locator('[data-contact-github]'),
        ];
        for (const part of parts) {
          await part.scrollIntoViewIfNeeded();
          await expect(part).toBeVisible();
          const box = await part.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        }
      });
    });
  }
}
