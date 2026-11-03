// Browser-side email helpers for the shared email script in src/components/CopyEmail.astro. Pure logic
// (no DOM, no node imports), so tests can run it without a browser.
//
// The address never exists joined in the built site (design-doc §8.3, hard rule 8): components write
// getEmailParts()'s user and domain as two separate data attributes, and only the browser joins them
// here. Nothing in this file holds an address.

import type { EmailParts } from './resume.ts';

/** How long the Copy button shows "Copied ✓" before going back to "Copy". */
export const COPY_FEEDBACK_MS = 2000;

export type CopyResult = 'copied' | 'manual';

export function joinEmail({ user, domain }: EmailParts): string {
  return `${user}@${domain}`;
}

export function mailtoHref(parts: EmailParts): string {
  return `mailto:${joinEmail(parts)}`;
}

const validPart = (part: string | undefined): part is string => !!part && !part.includes('@');

/**
 * The parts from an element's data attributes (data-email-user / data-email-domain), or null if one is
 * missing, empty or contains an "@". With null the element stays hidden.
 */
export function readEmailParts(dataset: { emailUser?: string; emailDomain?: string }): EmailParts | null {
  const { emailUser: user, emailDomain: domain } = dataset;
  return validPart(user) && validPart(domain) ? { user, domain } : null;
}

/**
 * Copies text with the async Clipboard API. "manual" means the visitor has to copy it by hand: there
 * is no clipboard (an insecure context or an old browser), or writing to it failed (permission denied).
 */
export async function copyText(text: string, clipboard?: Pick<Clipboard, 'writeText'>): Promise<CopyResult> {
  if (!clipboard || typeof clipboard.writeText !== 'function') return 'manual';
  try {
    await clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'manual';
  }
}
