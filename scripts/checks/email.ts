// Helpers for no-email-in-dist.ts. Pure logic, so tests can import it.
//
// Matching rule: the address itself, case-insensitive, with the "@" either literal or URL-encoded
// (%40, as in an encoded mailto: link). Messages never include the address or the line it was found on.

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function emailPattern(user: string, domain: string): RegExp {
  return new RegExp(`${escape(user)}(?:@|%40)${escape(domain)}`, 'gi');
}

// 1-based line numbers of every match, without the matched text.
export function findEmail(text: string, pattern: RegExp): number[] {
  const lines: number[] = [];
  for (const match of text.matchAll(new RegExp(pattern.source, 'gi'))) {
    lines.push(text.slice(0, match.index).split('\n').length);
  }
  return lines;
}
