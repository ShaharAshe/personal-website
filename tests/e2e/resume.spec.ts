// /resume (Task 2.11) in a real browser: the links that lead to it and away from it, the PDF download, Copy by
// mouse and keyboard, the no-JavaScript fallback, the print stylesheet, and the layout at 375px and 1280px in both
// themes. What the built HTML contains is checked by tests/resume-page.test.ts (npm test).
//
// The real address is never printed: every comparison with it is `expect(a === b).toBe(true)`, so a failure shows
// only true/false.

import { expect, test, type Page } from '@playwright/test';
import { THEMES, THEME_STORAGE_KEY } from '../../src/lib/theme.ts';
import { COPY_FEEDBACK_MS, joinEmail, mailtoHref } from '../../src/lib/email-client.ts';
import { getEmailParts, getResume } from '../../src/lib/resume.ts';
import { RESUME_PDF_FILENAME, RESUME_PDF_URL } from '../../src/lib/resume-pdf.ts';
import {
  expectCopyIconSwap,
  expectFocusRing,
  expectInstantCopySwap,
  expectNoCheckIcon,
  expectTheme,
  themeToggle,
} from './helpers.ts';

const ADDRESS = joinEmail(getEmailParts());
const MAILTO = mailtoHref(getEmailParts());

const resume = (page: Page) => page.locator('[data-resume]');
const emailLink = (page: Page) => resume(page).locator('a[data-email-link]');
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const download = (page: Page) => resume(page).getByRole('link', { name: 'Download PDF' });
const home = (page: Page) => resume(page).getByRole('link', { name: 'Home', exact: true });
const copyButton = (page: Page) => resume(page).locator('button[data-email-copy]');
const copied = (page: Page) => copyButton(page).locator('[data-copy-done]');

async function clipboardText(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

async function expectOnResume(page: Page, status: number): Promise<void> {
  expect(status).toBe(200);
  await expect(page).toHaveURL(/\/resume$/);
  await expect(page.getByRole('heading', { level: 1, name: getResume().basics.name })).toBeVisible();
}

test('the homepage "View full resume" link opens /resume', async ({ page }) => {
  await page.goto('/');
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().isNavigationRequest()),
    page.locator('[data-full-resume]').click(),
  ]);
  await expectOnResume(page, response.status());
});

test('the nav Resume link opens /resume', async ({ page }) => {
  await page.goto('/');
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().isNavigationRequest()),
    nav(page).getByRole('link', { name: 'Resume' }).click(),
  ]);
  await expectOnResume(page, response.status());
});

test('the Home link goes back to the homepage', async ({ page }) => {
  await page.goto('/resume');
  await home(page).click();
  await expect(page).toHaveURL(/\/$/);
  expect(new URL(page.url()).pathname).toBe('/');
  await expect(page.locator('[data-hero]')).toBeVisible();
});

test('Back to top scrolls to the top of /resume and stays on /resume', async ({ page }) => {
  await page.goto('/resume');
  const link = page.getByRole('contentinfo').getByRole('link', { name: 'Back to top' });
  await link.scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await link.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator('#top')).toBeFocused();
  expect(new URL(page.url()).pathname).toBe('/resume');
});

test('on /resume the nav marks Resume as current, visibly and without accent', async ({ page }) => {
  await page.goto('/resume');
  const current = nav(page).getByRole('link', { name: 'Resume' });
  const other = nav(page).getByRole('link', { name: 'Projects' });
  await expect(current).toHaveAttribute('aria-current', 'page');
  await expect(other).not.toHaveAttribute('aria-current', 'page');

  const styleOf = (link: typeof current) =>
    link.evaluate((el) => {
      const { color, textDecorationLine } = getComputedStyle(el);
      return { color, textDecorationLine };
    });
  const [currentStyle, otherStyle] = [await styleOf(current), await styleOf(other)];
  expect(currentStyle.textDecorationLine).toBe('underline');
  expect(currentStyle.color).not.toBe(otherStyle.color);
  const accent = await download(page).evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(currentStyle.color).not.toBe(accent);
});

test('Download PDF downloads the PDF with the published file name', async ({ page }) => {
  await page.goto('/resume');
  const [file] = await Promise.all([page.waitForEvent('download'), download(page).click()]);
  expect(file.suggestedFilename()).toBe(RESUME_PDF_FILENAME);
  expect(new URL(file.url()).pathname).toBe(RESUME_PDF_URL);
  expect(await file.failure()).toBeNull();
});

test.describe('with clipboard access', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('copying swaps the copy icon for a check icon for about 2 seconds; the button keeps its size', async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto('/resume');
    await expectCopyIconSwap(page, copyButton(page), ADDRESS);
  });

  test('with reduced motion, the swap is instant', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/resume');
    await expectInstantCopySwap(copyButton(page));
  });

  test('clicking the copy icon copies the address, shows "Copied" for about 2 seconds and moves nothing', async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto('/resume');
    await expect(copied(page)).toBeHidden();
    const before = await page.locator('[data-resume-summary]').boundingBox();
    const linkedIn = await resume(page).locator('[data-resume-profile="linkedin"]').boundingBox();

    await copyButton(page).click();
    await expect(copied(page)).toBeVisible();
    await expect(copied(page)).toHaveText('Copied');
    await expect(resume(page).locator('[data-copy-status]')).toHaveText('Email address copied');
    expect((await clipboardText(page)) === ADDRESS).toBe(true);
    expect(await page.locator('[data-resume-summary]').boundingBox()).toEqual(before);
    expect(await resume(page).locator('[data-resume-profile="linkedin"]').boundingBox()).toEqual(linkedIn);

    await page.clock.runFor(COPY_FEEDBACK_MS);
    await expect(copied(page)).toBeHidden();
    await expect(resume(page).locator('[data-copy-status]')).toHaveText('');
  });

  test('keyboard: Tab reaches Copy with a focus ring; Enter and Space both copy', async ({ page }) => {
    await page.clock.install();
    await page.goto('/resume');
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
    }
  });
});

test('after load the address is shown and is itself the mailto link; there is no "Open in mail app"', async ({
  page,
}) => {
  await page.goto('/resume');
  await expect(emailLink(page)).toBeVisible();
  expect((await emailLink(page).textContent())?.trim() === ADDRESS).toBe(true);
  expect((await emailLink(page).getAttribute('href')) === MAILTO).toBe(true);
  await expect(resume(page).getByRole('link', { name: 'Open in mail app' })).toHaveCount(0);
});

test('clipboard denied: the address is selected and a hint says to copy it by hand', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Clipboard.prototype, 'writeText', {
      value: () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError')),
    });
  });
  await page.goto('/resume');
  await copyButton(page).click();
  await expect(resume(page).locator('[data-copy-hint]')).toBeVisible();
  await expect(copied(page)).toBeHidden();
  await expectNoCheckIcon(copyButton(page));
  expect((await page.evaluate(() => getSelection()?.toString())) === ADDRESS).toBe(true);
});

test.describe('with a wider fallback mono font', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // Which fallback font a machine has varies, so blocking the site fonts wouldn't test the same thing everywhere.
  // JetBrains Mono is 8.4px per character here; 0.5px of letter-spacing stands in for a font as wide as 8.9px.
  test('the revealed email still fits its reserved width, on one line with the profile links', async ({ page }) => {
    await page.goto('/resume');
    await expect(emailLink(page)).toBeVisible();
    await page.addStyleTag({ content: '[data-email-address] { letter-spacing: 0.5px; }' });
    const row = await page.locator('[data-resume-email]').evaluate((slot) => ({
      width: slot.querySelector('[data-email-reveal]')!.getBoundingClientRect().width,
      minWidth: parseFloat(getComputedStyle(slot).minWidth),
    }));
    expect(row.width).toBeLessThanOrEqual(row.minWidth);
    const email = (await emailLink(page).boundingBox())!;
    const gitHub = (await resume(page).locator('[data-resume-profile="github"]').boundingBox())!;
    expect(gitHub.y).toBe(email.y);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the fallback line shows, and no email element is visible or linked', async ({ page }) => {
    await page.goto('/resume');
    await expect(resume(page).locator('[data-email-nojs]')).toBeVisible();
    for (const el of await page.locator('[data-email-reveal]').all()) await expect(el).toBeHidden();
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    await expect(download(page)).toBeVisible();
    await expect(resume(page).locator('[data-resume-separator]').first()).toBeHidden();
    await expect(resume(page).locator('[data-resume-separator]').last()).toBeVisible();
  });
});

// Saved dark theme, and dark from the OS with nothing saved: the two ways the site ends up dark.
const DARK_STATES = [
  { name: 'saved dark theme', saved: true },
  { name: 'OS dark theme', saved: false },
];

for (const { name, saved } of DARK_STATES) {
  test.describe(`print, ${name}`, () => {
    test.use({ colorScheme: 'dark' });

    test.beforeEach(async ({ page }) => {
      if (saved) {
        await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
          THEME_STORAGE_KEY,
          'dark',
        ] as const);
      }
      await page.goto('/resume');
      await expectTheme(page, 'dark');
      await expect(resume(page).locator('[data-email-address]')).toBeVisible();
      await page.emulateMedia({ media: 'print' });
    });

    test('the nav, footer, theme toggle, buttons and Home link are hidden', async ({ page }) => {
      await expect(page.locator('body > header')).toBeHidden();
      await expect(nav(page)).toBeHidden();
      await expect(page.locator('footer')).toBeHidden();
      await expect(themeToggle(page)).toBeHidden();
      await expect(download(page)).toBeHidden();
      await expect(copyButton(page)).toBeHidden();
      await expect(resume(page).locator('[data-resume-home]')).toBeHidden();
      for (const separator of await resume(page).locator('[data-resume-separator]').all()) {
        await expect(separator).toBeHidden();
      }
      await expect(page.locator('a[href="#main"]')).toBeHidden();
    });

    test('the background is white and all the text is dark', async ({ page }) => {
      const colors = await page.evaluate(() => {
        const of = (selector: string) => getComputedStyle(document.querySelector(selector)!);
        return {
          html: of('html').backgroundColor,
          body: of('body').backgroundColor,
          h1: of('h1').color,
          text: of('[data-resume-summary]').color,
          muted: of('[data-resume-title]').color,
          link: of('[data-resume-profile]').color,
        };
      });
      expect(colors.html).toBe('rgb(255, 255, 255)');
      expect(colors.body).toBe('rgb(255, 255, 255)');
      for (const color of [colors.h1, colors.text, colors.muted, colors.link]) {
        const [r, g, b] = color.match(/\d+/g)!.map(Number);
        expect(Math.max(r, g, b), color).toBeLessThanOrEqual(0x44);
      }
    });

    test('a project status stays on the line of its name, with the link under them', async ({ page }) => {
      const name = (await resume(page).locator('[data-project-name]').first().boundingBox())!;
      const status = (await resume(page).locator('[data-project-status]').first().boundingBox())!;
      const link = (await resume(page).locator('[data-project-link]').first().boundingBox())!;
      expect(status.y).toBeLessThan(name.y + name.height);
      expect(link.y + link.height).toBeGreaterThan(name.y + name.height);
    });

    test('the address stays, and the profile and project links show their URLs', async ({ page }) => {
      await expect(resume(page).locator('[data-email-address]')).toBeVisible();
      const { basics, projects } = getResume();
      const links = [
        ...basics.profiles.map(({ url }) => ({ url, attribute: 'data-resume-profile' })),
        ...projects.flatMap(({ url }) => (url ? [{ url, attribute: 'data-project-link' }] : [])),
      ];
      for (const { url, attribute } of links) {
        const shown = await page
          .locator(`[${attribute}][href="${url}"]`)
          .evaluate((el) => getComputedStyle(el, '::after').content);
        expect(shown).toContain(url);
      }
    });
  });
}

test('printing the homepage still hides its mail links', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Open in mail app' })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('link', { name: 'Open in mail app' })).toBeHidden();
  await expect(page.locator('[data-hero] a[data-email-link]')).toBeHidden();
  await expect(page.locator('[data-contact] [data-email-address]')).toBeVisible();
});

for (const width of [375, 1280]) {
  for (const theme of THEMES) {
    test.describe(`/resume at ${width}px, ${theme}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: theme });

      test('no horizontal scroll', async ({ page }) => {
        await page.goto('/resume');
        await expectTheme(page, theme);
        await expect(resume(page).locator('[data-email-address]')).toBeVisible();
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
      });

      test('the revealed email fits its reserved space, so nothing moves when it appears', async ({ page }) => {
        await page.goto('/resume');
        await expect(resume(page).locator('[data-email-address]')).toBeVisible();

        const row = await page.locator('[data-resume-email]').evaluate((slot) => {
          const { width, height } = slot.querySelector('[data-email-reveal]')!.getBoundingClientRect();
          const { minWidth, minHeight } = getComputedStyle(slot);
          return { width, height, minWidth: parseFloat(minWidth), minHeight: parseFloat(minHeight) };
        });
        expect(row.height).toBeLessThanOrEqual(row.minHeight);
        if (width > 640) expect(row.width).toBeLessThanOrEqual(row.minWidth);

        // Back to how the page looks before the script runs: the links and the summary stay exactly where they are.
        const positions = () =>
          page.evaluate(() =>
            [...document.querySelectorAll('[data-resume-profile], [data-resume-summary]')].map((el) => {
              const { x, y } = el.getBoundingClientRect();
              return { x, y };
            }),
          );
        const revealed = await positions();
        await page.locator('[data-resume] [data-email-reveal]').evaluate((el: HTMLElement) => {
          el.hidden = true;
        });
        expect(await positions()).toEqual(revealed);
      });

      test('the contact line keeps each item whole; on phones the email has its own line', async ({ page }) => {
        await page.goto('/resume');
        await expect(emailLink(page)).toBeVisible();
        const email = (await emailLink(page).boundingBox())!;
        const linkedIn = (await resume(page).locator('[data-resume-profile="linkedin"]').boundingBox())!;
        const gitHub = (await resume(page).locator('[data-resume-profile="github"]').boundingBox())!;
        const button = (await copyButton(page).boundingBox())!;

        expect(button.x).toBeGreaterThanOrEqual(email.x + email.width);
        expect(button.y + button.height / 2).toBeCloseTo(email.y + email.height / 2, 0);
        expect(linkedIn.y).toBe(gitHub.y);
        if (width === 375) expect(linkedIn.y).toBeGreaterThanOrEqual(email.y + email.height);
        else expect(linkedIn.y).toBe(email.y);
        await expect(copyButton(page)).toHaveAccessibleName('Copy email address');
      });

      test('a project link sits where Experience has its dates', async ({ page }) => {
        await page.goto('/resume');
        const link = resume(page).locator('[data-project-link]').first();
        await expect(link).toHaveText('GitHub');
        await expect(link.locator('svg[data-icon="github"]')).toHaveCount(1);
        const linkBox = (await link.boundingBox())!;
        const nameBox = (await resume(page).locator('[data-project-name]').first().boundingBox())!;
        const datesBox = (await resume(page).locator('#experience [data-entry-dates]').first().boundingBox())!;

        expect(linkBox.x + linkBox.width).toBeLessThanOrEqual(width);
        if (width === 375) {
          expect(linkBox.y + linkBox.height).toBeGreaterThan(nameBox.y + nameBox.height);
          expect(linkBox.x).toBe(nameBox.x);
        } else {
          expect(linkBox.y).toBeLessThan(nameBox.y + nameBox.height);
          expect(linkBox.x + linkBox.width).toBeCloseTo(datesBox.x + datesBox.width, 0);
        }
      });

      test('projects are spaced like Experience entries', async ({ page }) => {
        await page.goto('/resume');
        const listClass = (selector: string) =>
          page
            .locator(selector)
            .first()
            .evaluate((el) => el.parentElement!.className);
        expect(await listClass('[data-resume-project]')).toBe(await listClass('#experience [data-resume-entry]'));
      });
    });
  }
}
