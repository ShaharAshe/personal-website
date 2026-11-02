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
  never use accent (language chips are outline, topic chips use the `--border` fill). Link markers: the
  shared `GitHubIcon` (`src/components/GitHubIcon.astro`) goes on links whose text is "GitHub" and on
  icon-only GitHub links; ↗ marks other links that leave the site (e.g. Live demo, a list of repos); →
  marks links within the site (e.g. View full resume, Read more). Don't repeat a logo on every item of a
  list; if the destination isn't obvious, say it once for the group.
- Content width: ~720px for text, ~1100px for grids. Cards use a subtle 1px border, no heavy shadows.
- Proposed for Task 2.10: one 720px column for every section, including Projects (2-column card grid),
  so all section headings align. Decide there with screenshots; until then the ~1100px grid width stays.
- Prefer an Astro component with a small script for simple interactions, such as the theme toggle
  (`src/components/ThemeToggle.astro`) and probably the copy-email button (task 2.9).
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
