// The CTF chain (Task F.2, plan.md "Fun (after MVP)"): a small treasure hunt for curious visitors. Each clue says
// where the next one is and carries one part of a final answer. This module is the one source of truth: every clue
// text and every answer part lives here, and each place gets its text from it at build time:
//   0. an HTML comment on the homepage             src/pages/index.astro (CTF_COMMENT_HTML)
//   1. a base64 line in the console greeting       src/layouts/BaseLayout.astro -> console-greeting.ts
//   2. an X-Clue header on /favicon.ico            scripts/ctf/ctf-headers.mts (appends a rule to dist/_headers)
//   3. a tEXt chunk in /og-image.png               scripts/og/render-og-image.ts (npm run og)
//   4. a ROT13 file under /.well-known/            src/pages/.well-known/ctf.txt.ts
//
// The final answer is never written out whole, here or anywhere: only its parts are, and ctfAnswer() joins them.
// tests/ctf.test.ts fails if the joined parts appear in any tracked file or in dist/.
//
// Adding a step later (5: a DNS TXT record, 6: a Worker answering a special Accept header): append one entry to
// CTF_STEPS and deliver ctfClue(5) there. The clue before it then says "Next: ..." instead of ending, and the ending
// (with the assembly instructions) moves to the new last step, with no other change here.
//
// .mts, not .ts: astro.config.mjs loads scripts/ctf/ctf-headers.mts, which imports this file under plain Node (see
// scripts/csp/csp.mts). It imports nothing, so it stays safe to load from anywhere.
//
// Rules (plan.md F.2): a welcoming tone, no fake vulnerabilities or admin paths, nothing about the resume, plain
// ASCII everywhere (header values and PNG tEXt must be), no email and no phone.

export interface CtfStep {
  /** This step's part of the final answer. */
  part: string;
  /** How to reach this step, as the previous clue says it after "Next: ". */
  foundAt: string;
}

export const CTF_STEPS: readonly CtfStep[] = [
  { part: 'dig', foundAt: 'view the source of the homepage' },
  { part: 'deeper', foundAt: 'open the DevTools console on this page' },
  { part: 'than', foundAt: 'the response headers of /favicon.ico (try curl -I)' },
  { part: 'the', foundAt: 'the metadata of /og-image.png (try exiftool or strings)' },
  { part: 'dom', foundAt: '/.well-known/ctf.txt (it is ROT13)' },
];

/** How the parts are joined, and how the last clue names it. */
export const CTF_JOINER = { char: '-', name: 'hyphens' } as const;

export const CTF_ENDING = "If you'd like to get in touch, mention the final answer.";

/** The final answer: the parts in order, joined. Computed, never stored. */
export function ctfAnswer(steps: readonly CtfStep[] = CTF_STEPS): string {
  return steps.map(({ part }) => part).join(CTF_JOINER.char);
}

/** Clue i as lines. The first clue welcomes, the middle ones point on, the last one explains how to finish. */
export function ctfClueLines(i: number, steps: readonly CtfStep[] = CTF_STEPS): string[] {
  const step = steps[i];
  if (!step) throw new Error(`CTF: no step ${i}`);
  const next = steps[i + 1];
  if (!next) {
    return [
      `Nice, you found clue ${i}, the last one. Well done!`,
      `Part ${i}: "${step.part}"`,
      `To get the final answer, put the parts in order, 0 to ${i}, and join them with ${CTF_JOINER.name}.`,
      CTF_ENDING,
    ];
  }
  if (i === 0) {
    return [
      'Hi, fellow source reader! Nice, you found clue 0 of a small treasure hunt.',
      'Each clue holds one part of a final answer and says where the next one is.',
      `Part 0: "${step.part}"`,
      `Next: ${next.foundAt}.`,
    ];
  }
  return [`Nice, you found clue ${i}. Part ${i}: "${step.part}". Next: ${next.foundAt}.`];
}

export function ctfClue(i: number, steps: readonly CtfStep[] = CTF_STEPS): string {
  return ctfClueLines(i, steps).join('\n');
}

/** ROT13 on ASCII letters; everything else unchanged. Its own inverse. */
export function rot13(text: string): string {
  return text.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

/** Base64 of an ASCII string (btoa: in Node and browsers alike). */
export function toBase64(text: string): string {
  return btoa(text);
}

const PRINTABLE = /^[\x20-\x7e\n]*$/;

function checked(label: string, text: string, { singleLine = false } = {}): string {
  if (!PRINTABLE.test(text)) throw new Error(`CTF: ${label} must be printable ASCII`);
  if (singleLine && text.includes('\n')) throw new Error(`CTF: ${label} must be one line`);
  return text;
}

for (let i = 0; i < CTF_STEPS.length; i++) checked(`clue ${i}`, ctfClue(i));

/** Clue 0: the homepage's HTML comment. "--" can't appear inside a comment, and ">" can't start one. */
export const CTF_COMMENT_HTML = (() => {
  const body = ctfClueLines(0).join('\n  ');
  if (body.includes('--') || body.startsWith('>')) throw new Error('CTF: clue 0 would break the HTML comment');
  return `<!--\n  ${body}\n-->`;
})();

/** Clue 1: the last line of the console greeting (src/lib/console-greeting.ts). */
export const CTF_CONSOLE_LINE = checked('the console line', `Clue 1 (base64): ${toBase64(ctfClue(1))}`, {
  singleLine: true,
});

/** Clue 2: the response header on /favicon.ico (written into dist/_headers by scripts/ctf/ctf-headers.mts). */
export const CTF_HEADER = {
  path: '/favicon.ico',
  name: 'X-Clue',
  value: checked('the X-Clue header', ctfClue(2), { singleLine: true }),
} as const;

/** Clue 3: a tEXt chunk in public/og-image.png (npm run og). "Comment" is a standard PNG keyword exiftool shows. */
export const CTF_PNG_TEXT = { keyword: 'Comment', text: ctfClue(3) } as const;

/** Clue 4: the ROT13 file under /.well-known/. */
export const CTF_WELL_KNOWN = { path: '/.well-known/ctf.txt', body: `${rot13(ctfClue(4))}\n` } as const;
