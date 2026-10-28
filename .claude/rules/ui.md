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
- Content width: ~720px for text, ~1100px for grids. Cards use a subtle 1px border, no heavy shadows.
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
