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
- React islands only where interaction is needed (theme toggle, copy email, contact form). Prefer
  `client:visible` or `client:idle` over `client:load`.
- Email address: assemble it in the browser so it isn't plain text in the HTML. Copy button shows
  "Copied" feedback. Keep a `mailto:` link as a secondary option.
- Accessibility: semantic landmarks, one `<h1>` per page, labels on every input, `aria-label` on
  icon-only buttons, visible `:focus-visible` styles.
- Images: AVIF/WebP via Astro's image tools, explicit width/height, lazy loading below the fold.
- Every page: unique `<title>`, meta description, Open Graph tags.
