# Shahar Asher – Portfolio Site

Personal portfolio for a backend engineer (Java, Spring Boot, Kafka, real-time systems).
Audience: recruiters (30–60 seconds), hiring managers and interviewers (a few minutes, want technical depth).
Goal: get interviews for Backend / Software Engineer roles.

All decisions and their reasoning are in `docs/design-doc.md` (written in Hebrew). Read the relevant
section before starting a task. If a request conflicts with the design doc, point out the conflict
and ask before proceeding.

`docs/plan.md` is the task list for building this site. It has a checkbox per task, grouped into
milestones. Keep it updated as tasks are completed — check items off, and note any deviations — so it
stays an accurate record of what's done and what's next.

## Stack

- Astro + TypeScript (strict) + Tailwind CSS
- Interactivity: prefer an `.astro` component with a small `<script>` for simple interactions (theme
  toggle, copy button). React islands (`src/components/islands/`) only for complex interaction, such
  as the contact form. Everything else ships zero JS.
- Content: `src/data/resume.yaml` (resume), GitHub API at build time (project cards), MDX in `src/content/` (deep-dive pages)
- Hosting: Cloudflare (static assets + one function for the contact form, phase 2)
- CI/CD: GitHub Actions builds everything (including the resume PDF via LibreOffice) and deploys to Cloudflare
- Site language: English only

## Commands

These npm scripts must exist and keep working (create them during scaffolding):

- `npm run dev`: local dev server
- `npm run cv`: generate the resume `.docx` and `.pdf` from `resume.yaml`, then check the PDF is exactly one page
- `npm run projects`: fetch public repos from GitHub into `src/data/projects.json`
- `npm run og`: render the committed `public/og-image.png`, `public/favicon.ico` and `public/apple-touch-icon.png`
  from `resume.yaml` and the tokens (after a build; `npm test` fails while one is stale)
- `npm test`: unit + integration tests (`node:test`, `tests/**/*.test.ts`); LibreOffice tests skip if `soffice` isn't found
- `npm run check`: `astro check` + lint + `npm test` + the site checks (see "Definition of done")
- `npm run build`: `cv` + `projects` + `astro build`
- `npm run preview`: serve the production build locally
- `npm run test:e2e`: Playwright end-to-end tests (`tests/e2e/*.spec.ts`) against the existing build
  (`wrangler dev` on port 4322, so the real `_headers` and CSP apply; `astro preview` sends no headers); locally
  uses the installed Edge, CI uses Playwright's Chromium
- `npm run screenshots`: review screenshots (375px/640px/1280px, dark/light) into `screenshots/` (gitignored)
- `npm run test:live`: live smoke run, a read-only subset of the e2e specs against the deployed site
  (`playwright.live.config.ts`, base URL = astro's `site`; analytics blocked by `tests/e2e/fixtures.ts`)
- `npm run screenshots:live`: the same review screenshots, taken from the deployed site

## Directory map

```
docs/design-doc.md          decisions and reasoning (source of truth for "why")
src/data/resume.yaml        THE resume content. Single source of truth
src/data/projects.json      generated at build time, gitignored
src/lib/resume.ts           typed, validated resume for components (no email; email only via getEmailParts())
src/lib/projects.ts         typed, validated projects.json for components (schema = source of the types)
src/content.config.ts       content collections (projects; frontmatter schema in src/data/project-page.schema.ts)
src/content/projects/       <repo-name>.mdx deep-dive pages, matched to GitHub repos by name
src/content/case-studies/   case studies (e.g. table-migration.mdx)
src/components/             .astro components; islands/ for React
src/styles/global.css       design tokens (CSS custom properties)
scripts/cv/                 resume generator (create_cv.js) + PDF page check
tests/                      node:test tests (npm test); fixtures/ holds test inputs and golden files
tests/e2e/                  Playwright tests (npm run test:e2e) + review-screenshots.ts (npm run screenshots)
scripts/github/             GitHub fetcher
scripts/og/                 OG image + site icon generator (npm run og) + PNG/ICO helpers for their stale checks
src/lib/ctf.mts             CTF chain (F.2): every clue text and answer part; the joined answer is never written out
scripts/ctf/                ctfHeaders(): appends the X-Clue rule for /favicon.ico to dist/_headers (before cspHeaders)
src/lib/seo.ts              absolute URLs from `site`, sitemap/robots text, Person JSON-LD, site icon paths/sizes
scripts/csp/                CSP: cspHeaders() integration (astro.config.mjs) hashes inline scripts/styles in dist/
                            into dist/_headers after every build; public/_headers holds the fail-closed template
scripts/checks/             site checks (npm run check:site) + the pre-commit phone check
.githooks/                  pre-commit (phone check) + pre-push (refuses pushes to main); npm ci points
                            core.hooksPath here (scripts/git/install-hooks.ts)
scripts/git/                hook installer + the pre-push logic (push-policy.ts)
.github/workflows/          deploy.yml (PRs, push to main, daily schedule, manual; deploys only from main)
```

## Hard rules

1. **Resume content lives only in `src/data/resume.yaml`.** Never hardcode resume text (roles, bullets,
   skills, dates) in components. The homepage Experience and Skills sections read from the YAML.
2. **The phone number never appears on the website, and never enters git.** It's supplied to
   `create_cv.js` only via the `CV_PHONE` environment variable (`.env` locally, a GitHub Actions
   secret in CI) — it is not a field in `resume.yaml`. Components must not reference it. A build
   check enforces that it never appears in `dist/`.
   A pre-commit hook (`.githooks/pre-commit`) also blocks any commit whose staged content contains it;
   never bypass it with `--no-verify`.
3. **Do not change the visual design in `scripts/cv/create_cv.js`** (fonts, sizes, colors, spacing,
   page setup) unless explicitly asked. Content changes go in the YAML.
4. **Taboola confidentiality.** Describe problems, approaches and decisions in general terms only.
   No internal table or service names, unpublished business numbers, internal screenshots or code.
   If unsure whether something is OK to publish, ask.
5. **No new dependencies without asking.** Say what it is, why it's needed, and its size.
6. **Generated files are never committed:** `src/data/projects.json`, generated `.docx`/`.pdf`, `dist/`.
7. **Secrets** only in Cloudflare / GitHub Actions secrets. Never in code or committed files.
8. **The email never appears as plain text in built HTML.** Components get it only from
   `getEmailParts()` (src/lib/resume.ts) for the CopyEmail button; `no-email-in-dist` enforces it.

## Design (details in design-doc §9)

- Direction: minimal, technical, fast. Lots of whitespace, one accent color.
- Theme: a first-time visitor gets their OS setting (`prefers-color-scheme`; dark if none is reported).
  The dark/light toggle saves `"light"` or `"dark"` in `localStorage` under the key `theme` (wrapped in
  try/catch), and from then on the saved choice wins. Key and values live in `src/lib/theme.ts`.
  The saved theme is applied by an inline script in `<head>` before first paint (no flash).
- Accent: `#4F9DFF` in dark, a darker blue (e.g. `#1F6FD1`) in light for contrast.
- Use the tokens in `src/styles/global.css`. Never hardcode colors in components.
- Fonts: Inter (or Geist Sans) + JetBrains Mono (or Geist Mono), self-hosted.
- No progress bars or percentages for skills.

## Motion (details in design-doc §10)

- Only `transform` and `opacity`. 150–300ms for interactions, up to 600ms for entrances, `ease-out`.
- Section entrance animations run once.
- `prefers-reduced-motion: reduce` disables all animation.
- Not allowed: 3D/WebGL, particles, custom cursors, loading screens, animating every element on scroll.

## Quality targets

- Lighthouse 95+ in all categories. LCP < 1.5s, CLS < 0.05, homepage JS < 30KB gzipped.
- WCAG AA contrast in both themes. Full keyboard navigation with visible focus states.
- Semantic HTML. Every page has a unique `<title>` and meta description.
- Mobile first. Check every section at 375px width.

## How to work

- One task at a time, following the roadmap in design-doc §16. Don't jump ahead.
- For anything touching more than a few files, propose a short plan first and wait for approval.
- New logic comes with automated tests (`node:test`, in `tests/`, run by `npm test`). Verify behavior
  through tests kept in the repo, not throwaway scripts, so the check keeps running after the task.
- UI behavior is covered by Playwright end-to-end tests in `tests/e2e/` (`npm run test:e2e`), for what
  needs a real browser only (what the built HTML shows is checked by `npm test`). Before saying a UI
  task is done, run `npm run screenshots` (375px and 1280px, both themes, into `screenshots/`) and
  look at them.
- Never run `git commit`, `git push`, or `git add` — the user makes all commits themselves. At the end
  of each task, propose a Conventional Commits message (`feat:`, `fix:`, `chore:`, `docs:`, `test:`) and
  the exact git commands to run, then stop. Read-only git commands (`status`, `diff`, `log`) are fine.
- **Changes reach `main` only through a branch and a pull request.** Never propose a push to `main`
  (the `.githooks/pre-push` hook refuses it; the GitHub ruleset enforces it once the repo is public).
  Branch names: `task/<milestone>-<n>-<slug>` for a plan task (e.g. `task/2-17-pr-workflow`),
  `fix/<slug>` for a fix outside a task. The proposed commands, in order:
  1. `git switch -c <branch>`
  2. `git add <explicit list of files>` (never `git add .` or `-A`; a new hook script also gets
     `git add --chmod=+x <file>`)
  3. `git commit -m "<type>: subject" -m "Body paragraph." ...`
  4. `git push -u origin <branch>`
  5. `gh pr create --fill --base main`, or open the link `git push` prints
  6. Wait for the `build` check to pass, then squash merge on GitHub
  7. Only after the PR shows "Merged": `git switch main`, `git pull`, `git fetch --prune`, then
     `git branch -D <branch>`. It's `-D`, not `-d`: a squash merge never puts the branch's own commits
     on `main`, so `-d` refuses with "not fully merged". `--prune` removes the remote branch GitHub
     deleted after the merge.
- **The PR title becomes the commit on `main`** (squash merge, "Default to pull request title and
  description"). So the PR title must be a Conventional Commit (`feat:`, `fix:`, `docs:`, `test:`,
  `chore:`), and the PR body has no `Co-Authored-By` line or other AI trailer. `gh pr create --fill`
  takes both from the commit: tell the user to check the title and body before creating the PR.
- The user runs commands in Windows Command Prompt (cmd), not bash. Proposed git commands must be
  cmd-compatible: use a separate `-m` flag per paragraph for multi-line commit messages (e.g.
  `git commit -m "feat: subject" -m "Body line one." -m "Body line two."`), never a bash heredoc or
  `$(...)` command substitution.
- Proposed commit messages never include a `Co-Authored-By` line or any other AI attribution trailer.
  The message ends with the last `-m` paragraph that describes the change.
- If the design doc is wrong or outdated, say so and propose an edit to it rather than silently diverging.
- A task that changes commands, setup, prerequisites or architecture also updates `README.md` in the
  same task. `tests/readme.test.ts` fails if an npm script is missing from it or it names one that
  doesn't exist.

## Definition of done

A task is done only when all of these pass:

- `npm run build` succeeds
- `npm run check` succeeds (types, lint, and site checks)
- `npm run test:e2e` passes (for UI changes)
- README.md updated if commands, setup or architecture changed
- Site checks: resume PDF is one page; phone number not found anywhere in `dist/`;
  every featured/portfolio repo has a description
- Screenshots reviewed (for UI changes)
- You've summarized what changed and anything left open
- A proposed commit message and the branch + PR commands to run have been given, with nothing staged or
  committed

## Updating the resume

When asked to change the resume: edit `src/data/resume.yaml` only, run `npm run cv`, confirm the PDF is
still one page, and show the YAML diff. If the change pushes the PDF to two pages, say so and suggest
what to shorten. Don't shrink fonts or margins to make it fit.
