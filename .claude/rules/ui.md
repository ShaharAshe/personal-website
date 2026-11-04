---
paths:
  - "src/components/**"
  - "src/layouts/**"
  - "src/pages/**"
  - "src/styles/**"
---

# UI rules (design-doc §8–§11)

- Colors come from tokens in `src/styles/global.css` only:
  `--bg`, `--surface`, `--text`, `--text-muted`, `--accent`, `--border`, each defined for dark and light.
- One accent-filled button per section at most. In the Hero it's "Download Resume"; in Contact it's
  the email "Copy" button. Other buttons are outline style.
- Accent color means clickable: links and the one accent-filled button use it. Labels, chips and tags
  never use accent (language chips are outline, topic chips use the `--border` fill). Links inside content
  use accent. Site chrome (the nav, the footer and icon-only profile links) uses `text-text-muted` with
  hover to `text-text`. Link markers: the shared `GitHubIcon` (`src/components/GitHubIcon.astro`) goes on
  links whose text is "GitHub" and on icon-only GitHub links; the shared `ArrowUpRightIcon`
  (`src/components/ArrowUpRightIcon.astro`) marks other links that leave the site (e.g. Live demo, a list
  of repos); → marks links within the site (e.g. View full resume, Read more); the shared `ArrowUpIcon`
  (`src/components/ArrowUpIcon.astro`) marks Back to top. These two arrows are SVGs because the ↗ character
  can render as a colored emoji on phones; → has no emoji form, so it stays text. Don't repeat a logo on
  every item of a list; if the destination isn't obvious, say it once for the group. The shared
  `LinkedInIcon` (`src/components/LinkedInIcon.astro`) works the same way for LinkedIn: on links whose text
  names LinkedIn and on icon-only LinkedIn links, without `ArrowUpRightIcon`. `mailto:` links get the shared
  `MailIcon` (`src/components/MailIcon.astro`) instead of `ArrowUpRightIcon` (they open a mail app, not a
  page).
- Content width: one 720px column for every section, the nav and the footer, so headings and edges align.
  Project cards are one column at every width, each spanning it: at half the column, descriptions wrap into
  tall cards. Cards use a subtle 1px border, no heavy shadows.
- Prefer an Astro component with a small script for simple interactions, such as the theme toggle
  (`src/components/ThemeToggle.astro`) and the copy-email button (`src/components/CopyEmail.astro`).
- Use a React island only when the interaction is complex enough to need it, such as the contact
  form (task 3.3). Load it only where it's used, with `client:visible` or `client:idle`.
- Keep the "homepage JS < 30KB gzipped" budget from CLAUDE.md in mind when choosing.
- Email address: assemble it in the browser so it isn't plain text in the HTML. Copy button shows
  "Copied" feedback. Keep a `mailto:` link as a secondary option, also assembled in the browser from
  `getEmailParts()` (`src/lib/resume.ts`), never written into the HTML.
- Accessibility: semantic landmarks, one `<h1>` per page, labels on every input, `aria-label` on
  icon-only buttons, visible `:focus-visible` styles.
- Images: AVIF/WebP via Astro's image tools, explicit width/height, lazy loading below the fold.
- Every page: unique `<title>`, meta description, Open Graph tags.
