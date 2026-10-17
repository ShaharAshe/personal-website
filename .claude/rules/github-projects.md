---
paths:
  - "scripts/github/**"
  - "src/components/Project*.astro"
  - "src/content/projects/**"
  - "src/pages/projects/**"
---

# GitHub projects rules (design-doc §6)

- Data is fetched at build time only (`scripts/github/fetch-projects.ts` → `src/data/projects.json`).
  Never fetch from GitHub in the browser.
- User: `ShaharAshe`. In CI, authenticate with `GITHUB_TOKEN` to avoid rate limits.
- Topic mapping:
  - `portfolio-featured` → wide card at the top of Projects
  - `portfolio` → regular card under "More projects"
  - `portfolio-practice` → links only, in the "Algorithm practice" line
  - none of these → not shown
- Always exclude forks and archived repos.
- Sort each group by `pushed_at`, newest first.
- Fields used: `name` (prettified for display, e.g. `log-analytics-platform` → "Log Analytics Platform"),
  `description`, languages, `topics` (minus the `portfolio-*` ones), `stargazers_count` (show only if > 0),
  `pushed_at`, `html_url`, `homepage` (shows a "Live demo" button when set).
- If `src/content/projects/<repo-name>.mdx` exists, the card links to `/projects/<repo-name>` and the MDX
  frontmatter can override fields (e.g. `status: In progress`, `team: 2 developers`).
- Fail the build, with a clear message, if a `portfolio-featured` or `portfolio` repo has no description,
  or if the GitHub API request fails. A failed build leaves the live site unchanged, which is what we want.
