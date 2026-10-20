# Portfolio Site — Task List

> Source of truth for what's done and what's next. Update checkboxes as tasks complete. Full
> reasoning behind each decision lives in `design-doc.md`; this file is the execution plan.

## Context

Starting from a design doc (`docs/design-doc.md`, decisions final) plus `CLAUDE.md`, `.claude/rules/*`,
`src/data/resume.yaml`, and `scripts/cv/create_cv.js`. No code exists yet — not even a git repo or
`package.json`. The goal of this plan is to sequence the build so the riskiest, hardest-to-debug-later
pieces (resume→PDF pipeline, GitHub project fetch, Cloudflare CI/CD) are proven working — in CI, not
just locally — before any real page is built. Everything else follows design-doc §16's phase structure
(Prep → MVP → Depth → Launch).

Reality check performed before this plan:
- Node v22.22.2, git 2.45.1, gh 2.96.0 (authenticated as `ShaharAshe`) are installed locally (Windows).
  LibreOffice will be installed locally before Task 1.2.
- Current GitHub repos confirm design-doc §6.5 exactly: `log-analytics-platform`, `NeetCode`,
  `project_euler` have no description; none of the 7 repos have any `portfolio-*` topic yet.
- Latest stable Astro is 7.4.x. Tailwind integration for Astro today is the `@tailwindcss/vite` Vite
  plugin (CSS-first config, no `tailwind.config.js`) — `@astrojs/tailwind` is legacy/v3-only.
- A static Astro site needs **no** `@astrojs/cloudflare` adapter — only once a server-rendered route
  (the contact form, Phase 2) is added.

## Doc corrections

- [x] `docs/design-doc.md` §14: `wrangler.toml` → `wrangler.jsonc` (current Cloudflare convention).
- [x] `docs/design-doc.md` §14: `src/content/config.ts` → `src/content.config.ts` (correct Astro 5+/7 location).
- [x] `docs/design-doc.md` §7.5/§13.3: add the CI font-fidelity detail — the published PDF is built on
      `ubuntu-24.04` with `libreoffice-writer` + `fonts-liberation`, verified via `fc-match Arial`
      resolving to Liberation Sans; this is the only PDF that ever gets published.
- [x] `docs/design-doc.md` §13.3: replace the "every PR gets a preview deployment" line with "PRs and
      other branches run build + check only; no preview deployments for now".

## Decisions locked in during planning

- Lint/format: ESLint + `typescript-eslint` + `eslint-plugin-astro`, plus Prettier +
  `prettier-plugin-astro` + `prettier-plugin-tailwindcss`.
- PDF page-count check: ~~`pdf-lib`~~ `pdf-parse` (changed in Task 1.2, also used for the phone-text check in 1.4).
- GitHub repo metadata fixes (descriptions, `portfolio-*` topics, README typo) — user does these
  themselves, outside Claude Code, before Milestone 2 Task 2.8 needs real data.
- Milestone 1 includes an early, CI-only deploy spike: scaffold → `npm run cv` → deploy to Cloudflare,
  all through GitHub Actions, so `/resume.pdf` is live from day one — and by the time that pipeline
  first runs, `npm run check` (Task 1.4) is already the real site-checks command, not a stub.
- **Phone check** (`npm run check`) scans only site-rendered files under `dist/` — `.html`, `.js`,
  `.json`, `.xml`, `.txt` — and explicitly excludes the resume `.pdf`/`.docx`, which are supposed to
  contain the phone number.
- **PDF font fidelity**: CI runs on `ubuntu-24.04` (pinned, not `ubuntu-latest`), installs
  `libreoffice-writer` + `fonts-liberation`, and the job fails if `fc-match Arial` doesn't resolve to
  Liberation Sans. The CI-built PDF is the only one ever published. Locally-built PDFs (real Arial, on
  Windows) are previews only, for checking content/layout, not the shipped artifact.
- **Local `soffice` resolution** (used by `npm run cv`, Windows): `SOFFICE_PATH` env var → default
  Windows install path (`C:\Program Files\LibreOffice\program\soffice.exe`) → plain `soffice` (relies on
  PATH — this is the branch CI uses). User installs LibreOffice locally before Task 1.2.
- Content collections live in `src/content.config.ts` (Astro 5+/7 convention), not
  `src/content/config.ts`.
- **Deploy only from `main`.** PRs and other branches run `build` + `check` only — no deploy, no
  preview URL for now.
- The `/resume` page and the homepage Contact section both render the email via the same client-side
  `CopyEmail` island — nowhere does the email appear as plain text in built HTML.
- JSON-LD `Person` schema (Task 2.13) is built from `resume.yaml` but **excludes `email` and `phone`
  entirely** — it's for SEO rich results, not a contact-harvesting surface.
- Node version pinned via `.nvmrc` (`22`) + `package.json` `engines.node`, so CI matches local exactly.
- Milestone 3: for Tasks 3.1 (Log Analytics Platform page) and 3.2 (case study), **the user drafts the
  actual text**; Claude Code builds the layout, MDX wiring, and (for 3.1) the SVG diagram around it.
- GitHub disables scheduled workflows after 60 days with no repository activity. Regular commits/PRs
  prevent that; if it does get disabled, re-enabling requires a manual click — Actions tab → select the
  workflow → "Enable workflow" banner. A `workflow_dispatch` run or a push does not auto-reinstate a
  disabled schedule.

## Things the user needs to do themselves (and when)

| # | Action | Needed by |
|---|---|---|
| 1 | Install LibreOffice locally (24.2+) | Before Milestone 1, Task 1.2 |
| 2 | Add descriptions to `log-analytics-platform`, `NeetCode`, `project_euler`; add `portfolio-*` topics per §6.5; fix "About As"→"About Us" typo in `scam-reporting-app` README | Before Milestone 2, Task 2.8 |
| 3 | Create a free Cloudflare account | Milestone 1, Task 1.5 |
| 4 | Create a Cloudflare API token (Workers deploy scope) and the account ID; add both as GitHub Actions secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) | Milestone 1, Task 1.5 |
| 5 | Enable Cloudflare Web Analytics on the site once it has a URL, grab the beacon token | Milestone 2, Task 2.15 |
| 6 | Decide/approve the OG image design (or approve a simple generated placeholder) | Milestone 2, Task 2.13 |
| 7 | Draft the real content: Log Analytics Platform architecture + narrative, and the table-migration case study narrative (checked against §12 confidentiality) | Milestone 3, Tasks 3.1–3.2 |
| 8 | Decide contact-form email provider: Cloudflare Email Routing vs Resend; provide its secret/API key as a Cloudflare secret | Milestone 3, Task 3.3 |
| 9 | Choose and purchase the domain via Cloudflare Registrar | Milestone 4, Task 4.1 |
| 10 | Create a local `.env` (from `.env.example`) with your real `CV_PHONE`; add `CV_PHONE` as a GitHub Actions secret | Before Milestone 1, Task 1.2 (local), and Task 1.5 (CI secret) |

## New dependencies introduced by this plan

(beyond what `create_cv.js` already needs: `docx`, `js-yaml`)

`astro`, `typescript`, `tailwindcss` + `@tailwindcss/vite`, `@astrojs/react` + `react` + `react-dom`,
`@astrojs/mdx`, `@astrojs/sitemap`, `pdf-parse` (replaced `pdf-lib` in Task 1.2), `@types/js-yaml`
(dev), ~~`tsx`~~ (dropped in Task 1.2: Node 22 runs the `.ts` scripts natively), `eslint` + `typescript-eslint` +
`eslint-plugin-astro`, `prettier` + `prettier-plugin-astro` + `prettier-plugin-tailwindcss`,
`@playwright/test` (dev, required by CLAUDE.md's screenshot workflow). `@astrojs/cloudflare` is added
later, only in Milestone 3 when the contact form needs a server-rendered route.

---

## Milestone 1 — Risky infrastructure first

- [x] **1.1 Scaffold the project** — Astro + TypeScript (strict) + Tailwind v4 + React islands, buildable, nothing real on the page yet. Node version pinned.
  - Files: `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/styles/global.css` (stub), `src/pages/index.astro` (stub), `.gitignore`, `.nvmrc` (`22`), git repo init.
  - Verify: `git init` done; `npm run dev` serves a blank page; `npm run build` produces `dist/`; `node -v` matches `.nvmrc`.
  - Depends on: nothing.
  - Done (2026-10-18). Notes / deviations:
    - Repo already existed, so no `git init`. Set up by hand instead of `npm create astro` (directory not empty).
    - Versions: `astro@7.4.0`, `@astrojs/react@7.1.0`, `react`/`react-dom@19.3.1`, `tailwindcss` +
      `@tailwindcss/vite@4.3.3`. Dev: `@types/react` + `@types/react-dom` (required peers of
      `@astrojs/react`).
    - **TypeScript pinned to 6.x (`6.0.3`), not the latest 7.x**: `@astrojs/check` (Task 1.4) only
      supports `typescript ^5 || ^6`.
    - **`package.json` has no `"type": "module"`** so `scripts/cv/create_cv.js` (CommonJS, `require`)
      keeps working in Task 1.2. Astro config is `.mjs`, so it's ESM regardless. New `.ts` scripts are
      unaffected (run via `tsx`).
    - `engines.node`: `>=22.22.0 <23` (Astro 7 needs ≥ 22.22.0).
    - Scripts for now: `dev`, `build` (`astro build` only), `preview`. `build` gains `cv` + `projects`
      in Tasks 1.2/1.3; `check` is added in Task 1.4.
    - `.gitignore` also ignores `.generated/`, `*.docx`, `*.pdf` (generated resume files).

- [x] **1.2 Resume → Word → PDF pipeline, wired and checked** — Confirm the already-verified `create_cv.js` (now reading phone from `CV_PHONE`, not `resume.yaml` — this repo is public) + a new PDF conversion + one-page check work as an `npm run cv` script; add schema validation for `resume.yaml` (no `phone` field in the schema).
  - Files: `scripts/cv/create_cv.js` (existing, phone now sourced from `CV_PHONE` env var), `scripts/cv/to-pdf.js` (new — resolves `soffice`, spawns `--headless --convert-to pdf`), `scripts/cv/check-pdf.ts` (new, `pdf-lib`), `src/data/resume.schema.ts` or inline in `src/content.config.ts` (zod via `astro:content`), `package.json` (`cv` script — invokes `node --env-file-if-exists=.env`).
  - Verify: With LibreOffice and a local `.env`/`CV_PHONE` in place (action items #1, #10), `npm run cv` produces the `.docx`/`.pdf` locally with the phone present, and confirms 1 page (content/layout preview only, real Arial on Windows, not the shipped font). With `CV_PHONE` unset, it warns and generates without a phone instead of failing. A deliberately-bad YAML fails schema validation clearly. Full font-fidelity verification happens in CI (Task 1.5).
  - Depends on: 1.1.
  - Done (2026-10-19). Notes / deviations:
    - `cv` = `validate-resume.ts` → `create_cv.js` → `to-pdf.js` → `check-pdf.ts`, output in
      `.generated/cv/`. `create_cv.js` and `to-pdf.js` run with `--env-file-if-exists=.env` (so
      `SOFFICE_PATH` can live in `.env` too). `build` is now `npm run cv && astro build`.
    - **Page check uses `pdf-parse` (v2), not `pdf-lib`**, so one PDF library covers both the page count
      and the phone-text check in Task 1.4.
    - **Schema is `src/data/resume.schema.ts`, zod from `astro/zod`** (not `astro:content`, which only
      exists inside the Astro build), so the same file works in the `cv` script and in
      `src/content.config.ts` (Task 2.4). Objects are strict: an unknown key (e.g. `basics.phone`) fails.
    - New files not in the original list: `scripts/cv/validate-resume.ts` (runs the schema check),
      `scripts/cv/paths.js` (shared `.generated/cv` paths/file names), `scripts/cv/format.js` (date/URL
      helpers moved out of `create_cv.js` so they can be unit-tested). `create_cv.js` only changed
      where it gets paths and helpers from; its design and output are unchanged (golden test below).
    - **Tests (`npm test`, `node:test`, no new dependency)** in `tests/`: schema (real `resume.yaml`
      passes; phone field, unquoted date, missing field rejected — fixtures in `tests/fixtures/`),
      date/URL formatting, soffice resolution order, and LibreOffice integration tests (over-long
      fixture fails the 1-page check; no `CV_PHONE` warns but succeeds) that skip with a message if
      soffice isn't found. A golden test pins `create_cv.js`'s Word XML (`document.xml`, `styles.xml`)
      for a fixture resume, so any design change fails; refresh with `UPDATE_GOLDEN=1 npm test` only
      when a design change is asked for. **Task 1.4 adds `npm test` to `npm run check`, so CI runs it.**
    - `.env.example` documents the optional `SOFFICE_PATH` override.
    - **No `tsx`**: Node 22.22 runs `.ts` natively (type stripping). The `.ts` scripts are run with
      `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` because `package.json` has no `"type"` (kept
      that way for CommonJS `create_cv.js`). Relative TS imports use the `.ts` extension.
    - Deps added, all `devDependencies` (build-time only): `docx@9`, `js-yaml@4` (needed by
      `create_cv.js`; never installed before), `pdf-parse@2` (pulls `pdfjs-dist` + `@napi-rs/canvas`,
      ~90 MB in `node_modules`), `@types/js-yaml` (strict type-check).
    - `to-pdf.js` deletes any stale PDF first and fails if soffice exits 0 without writing one (happens
      when another LibreOffice window is open). LibreOffice on Windows prints a harmless
      "Could not find platform independent libraries" line.
    - Verified: phone present in the PDF with `.env` (checked, not printed); `CV_PHONE` empty → warns,
      no phone in PDF; bad YAML (extra `phone`, unquoted year, missing field, syntax error) fails with
      the path of each problem; an over-long resume fails the 1-page check; `npm run build` passes;
      phone not found in `dist/` or source.

- [x] **1.3 GitHub project fetch script** — `scripts/github/fetch-projects.ts` pulls public repos for `ShaharAshe` via native `fetch` + `GITHUB_TOKEN`, filters/sorts/maps per `.claude/rules/github-projects.md`, writes `src/data/projects.json`, fails loudly on missing descriptions or API errors.
  - Files: `scripts/github/fetch-projects.ts`, `package.json` (`projects` script).
  - Verify: Run against the real account now (empty filtered list expected); fixture-based check proves filter/sort/description logic; confirms non-zero exit on missing description or API error.
  - Depends on: 1.1. Full end-to-end correctness depends on action item #2 but isn't blocked by it.
  - Done (2026-10-20). Notes / deviations:
    - Action item #2 (descriptions + topics) was already done, so the real run returned the full
      tiers, not an empty list: featured `log-analytics-platform`; portfolio `diff-checker`,
      `scam-reporting-app`, `Cryptography_modules`; practice `LeetCode`, `NeetCode`, `project_euler`.
    - Split in two: `scripts/github/projects.ts` (filter/sort/map/validate + a small API client with
      an injectable `fetch`) and `fetch-projects.ts` (CLI: writes the JSON, sets the exit code).
    - **The GitHub username is not hardcoded**: it's parsed from the `network: GitHub` profile URL in
      `src/data/resume.yaml` (`basics.profiles`), so the resume stays the single source of truth.
      Accepts `https://github.com/<user>` with or without `www.` / trailing slash; a missing GitHub
      profile or a URL that isn't a profile URL fails the fetch with a clear message.
    - `GITHUB_TOKEN` optional: sent as `Authorization: Bearer` when set; unauthenticated otherwise.
      `npm run projects` loads `.env` if present, so a local token can go there. `GITHUB_API_URL`
      overrides the API base (tests point it at a local fake server; GitHub Actions sets it to the
      real API anyway).
    - Output shape: `{ featured: Project[], portfolio: Project[], practice: PracticeLink[] }`.
      `Project` = `name`, `title` (prettified), `description`, `url`, `homepage` (`""` → `null`),
      `languages` (from the languages endpoint, most bytes first), `topics` (minus `portfolio` and
      `portfolio-*`), `stars`, `pushedAt`. Practice entries are links only (`name`, `title`,
      `description` — optional, `url`, `pushedAt`), so no languages request for them.
    - Rules beyond `github-projects.md`: private repos excluded too (defensive); a repo with several
      tier topics goes to the highest tier only; the API response is validated with zod
      (`astro/zod`), so an unexpected shape fails loudly. Pagination follows `Link: rel="next"`.
    - Descriptions are checked right after the repo list, before the languages requests. On any
      failure nothing is written (a stale `projects.json` from an earlier run is left as is; the
      build stops anyway). Zero tagged repos → warning + empty tiers, exit 0.
    - MDX deep-dive linking (`src/content/projects/<repo>.mdx`) is not in this script — it belongs
      to Tasks 2.4/2.8.
    - Tests: `tests/github-projects.test.ts` + `tests/fixtures/github/` (no real network). Unit tests
      use a fake `fetch`; CLI tests spawn `fetch-projects.ts` against a local `node:http` server to
      prove exit codes (missing description, 503 → non-zero, nothing written; zero tagged → 0).
    - `build` is now `npm run cv && npm run projects && astro build`.

- [ ] **1.4 Site checks wired into `npm run check`** — Combine `astro check`, lint, `npm test` (added in Task 1.2), and five site checks into one real command, built before the first CI pipeline: PDF one page, phone not present in `dist/`, descriptions present, **`CV_PHONE` not committed**, and **the generated PDF actually contains `CV_PHONE`**.
  - Files: `package.json` (`check` script), `scripts/checks/no-phone-in-dist.ts` (scans only `dist/**/*.{html,js,json,xml,txt}`, never the published `.pdf`/`.docx`), `scripts/checks/no-phone-in-source.ts` (new — when `CV_PHONE` is set, runs `git ls-files`, reads each tracked file, fails if the literal `CV_PHONE` value appears anywhere; catches it being hardcoded back in by accident, e.g. into `create_cv.js`; skips with a warning if `CV_PHONE` is unset, same as `create_cv.js`'s local behavior), `scripts/checks/pdf-contains-phone.ts` (new — when `CV_PHONE` is set, extracts text from the generated PDF and fails if the value is *not* found, proving the phone really made it into the published resume; needs a text-extraction library — `pdf-lib` alone can't reliably read text out of LibreOffice's compressed PDF streams, so this likely adds `pdf-parse` as a second small PDF dependency; confirm at task time).
  - Verify: `npm run check` passes on the stub; reintroducing the phone number into a component, or hardcoding it back into `create_cv.js`, each make the respective check fail; confirms the phone-in-dist check does *not* fail on `Shahar_Asher_Resume.pdf` itself; with `CV_PHONE` set, deleting the phone from the generated PDF (or not generating it) makes `pdf-contains-phone.ts` fail.
  - Depends on: 1.2, 1.3.

- [ ] **1.5 CI/CD: GitHub Actions → Cloudflare, deployed empty** — One workflow, two paths: PRs/non-main branches run `cv` → `projects` → `astro build` → the real `check` only; pushes to `main` additionally deploy to Cloudflare Workers (static assets, no adapter yet). Runner pinned to `ubuntu-24.04`; installs `libreoffice-writer` + `fonts-liberation`; fails if `fc-match Arial` doesn't resolve to Liberation Sans.
  - Files: `.github/workflows/deploy.yml`, `wrangler.jsonc`, `public/_headers` (stub).
  - Verify: PR runs build+check (incl. font-match) but does not deploy. Push to `main` deploys; Cloudflare `*.workers.dev` URL live with `/resume.pdf` downloadable as a real 1-page PDF. One-time task: visually compare the CI-built PDF against the current real resume PDF, confirm match. Because `CV_PHONE` is only ever set in CI (action item #10) and locally via `.env`, this is also the first real run of 1.4's two new phone-safety checks — confirm both pass here (phone not in any tracked file, phone present in the published PDF).
  - Depends on: 1.2, 1.3, 1.4. Needs action items #3, #4, and #10 (`CV_PHONE` secret) first — without it, `create_cv.js` fails the CI job by design (`process.env.CI` set).

## Milestone 2 — MVP (design-doc §16 Phase 1, remainder)

- [ ] **2.1 Design tokens + global stylesheet** — `--bg/--surface/--text/--text-muted/--accent/--border` as CSS custom properties for both themes, Tailwind v4 `@theme` wired to them.
  - Files: `src/styles/global.css`.
  - Verify: Toggling `data-theme` on `<html>` swaps every token; contrast checked against §9.2.
  - Depends on: 1.1.

- [ ] **2.2 BaseLayout + no-flash theme script** — Shared layout with `<head>` inline script setting theme before paint (localStorage, try/catch), nav shell, skip link, footer placeholder.
  - Files: `src/layouts/BaseLayout.astro`.
  - Verify: Hard refresh in light mode never flashes dark first; keyboard tab order reaches skip link first.
  - Depends on: 2.1.

- [ ] **2.3 ThemeToggle island** — React island, `client:visible`, flips `data-theme` + persists choice.
  - Files: `src/components/islands/ThemeToggle.tsx`.
  - Verify: Toggle works, persists across reload, respects `prefers-reduced-motion`.
  - Depends on: 2.2.

- [ ] **2.4 Content collections for resume + projects + MDX** — `resume` as a single-entry collection (or validated module) over `resume.yaml`; `projects.json` read at build time; `projects`/`case-studies` MDX collections with schemas.
  - Files: `src/content.config.ts`.
  - Verify: `astro check` catches an intentionally broken MDX frontmatter field.
  - Depends on: 1.2, 1.3, 2.1.

- [ ] **2.5 Hero** — Name, title, one-line summary (from `basics.summary`, trimmed), CTAs (Download Resume primary, View Projects secondary), social icons. No phone.
  - Files: `src/components/Hero.astro`.
  - Verify: Download Resume links to `/resume.pdf`; phone never rendered.
  - Depends on: 2.2, 2.4.

- [ ] **2.6 Experience section** — Homepage shows `featured: true` highlights only (timeline layout), link to full `/resume`.
  - Files: `src/components/Experience.astro`.
  - Depends on: 2.4.

- [ ] **2.7 Skills section** — Categorized list from `resume.yaml`, no progress bars/percentages.
  - Files: `src/components/Skills.astro`.
  - Depends on: 2.4.

- [ ] **2.8 Projects section** — Featured wide card, "More projects" grid, "Algorithm practice" link row, per the topic tiers in `.claude/rules/github-projects.md`.
  - Files: `src/components/Projects.astro`, `src/components/ProjectCard.astro`.
  - Verify: With action item #2 done, re-run `npm run projects`, confirm the three tiers render; a repo with a missing description fails the build instead of rendering an empty card.
  - Depends on: 1.3, 2.4; needs action item #2.

- [ ] **2.9 Contact section (launch-level: no form yet)** — Email assembled client-side with Copy button (island), LinkedIn card, GitHub link.
  - Files: `src/components/Contact.astro`, `src/components/islands/CopyEmail.tsx`.
  - Verify: Email never appears as plain text in built HTML; Copy button shows "Copied ✓"; works via keyboard.
  - Depends on: 2.2.

- [ ] **2.10 Footer + homepage assembly** — Wire Hero/Experience/Projects/Skills/Contact/Footer into `index.astro`.
  - Files: `src/pages/index.astro`.
  - Depends on: 2.5–2.9.

- [ ] **2.11 `/resume` page** — Full resume in site styling, Download PDF button at top, print stylesheet. Reuses the same `CopyEmail` island as Contact (2.9) for the email — never plain text.
  - Files: `src/pages/resume.astro`.
  - Verify: Ctrl+P produces a clean printed page; phone never rendered; email not plain text on this page either (confirm `CopyEmail` island used).
  - Depends on: 2.4, 2.2, 2.9.

- [ ] **2.12 404 page**
  - Files: `src/pages/404.astro`.
  - Depends on: 2.2.

- [ ] **2.13 SEO, OG image, sitemap, JSON-LD** — Unique `<title>`/meta description per page, OG image, `sitemap.xml` (`@astrojs/sitemap`), `robots.txt`, `Person` JSON-LD from `resume.yaml` excluding `email`/`phone`.
  - Files: `src/layouts/BaseLayout.astro`, `public/og-image.*`, `astro.config.mjs`, `public/robots.txt`.
  - Depends on: 2.2, 2.4; needs action item #6.

- [ ] **2.14 Security headers** — Real CSP, `X-Content-Type-Options`, `Referrer-Policy` in `public/_headers`.
  - Files: `public/_headers`.
  - Verify: Headers present in a deployed response; CSP doesn't break islands or fonts.
  - Depends on: 1.5.

- [ ] **2.15 Cloudflare Web Analytics** — Beacon script in `BaseLayout`.
  - Files: `src/layouts/BaseLayout.astro`.
  - Depends on: action item #5.

- [ ] **2.16 MVP deploy + visual verification** — Full homepage + `/resume` live on the Cloudflare free URL.
  - Verify: Playwright screenshots at 375px/1280px, dark/light, reviewed; Lighthouse spot-check; `npm run check` and `npm run build` both green.
  - Depends on: everything above in Milestone 2.

## Milestone 3 — Depth (design-doc §16 Phase 2)

- [ ] **3.1 Log Analytics Platform project page + architecture diagram** — User drafts TL;DR/problem/decisions/trade-offs text and architecture description; Claude Code builds `ArchitectureDiagram.astro` (SVG) and the MDX/page wiring around it.
  - Files: `src/content/projects/log-analytics-platform.mdx`, `src/components/ArchitectureDiagram.astro`, `src/pages/projects/[slug].astro`.
  - Depends on: 2.4; needs action item #7.

- [ ] **3.2 Table-migration case study** — User drafts the narrative; Claude Code handles layout/MDX wiring.
  - Files: `src/content/case-studies/table-migration.mdx`, `src/pages/case-studies/[slug].astro`.
  - Verify: Content reviewed against §12 — no internal names/numbers/screenshots.
  - Depends on: 2.4; needs action item #7.

- [ ] **3.3 Contact form (server-rendered)** — Switch to `output: 'server'` on that route via `@astrojs/cloudflare` (rest of site stays prerendered), `ContactForm.tsx` island, server validation, honeypot, Turnstile, basic rate limiting, email delivery.
  - Files: `src/pages/api/contact.ts`, `src/components/islands/ContactForm.tsx`, `astro.config.mjs`, `wrangler.jsonc`.
  - Verify: Submitting works end-to-end to a real inbox; spam paths rejected correctly.
  - Depends on: 1.5, 2.9; needs action item #8.

- [ ] **3.4 Motion polish** — Section entrance (once), card hover, theme-switch transition, View Transitions, `prefers-reduced-motion` disables all of it.
  - Files: `src/styles/global.css`, relevant components, `astro.config.mjs`.
  - Depends on: 2.16.

- [ ] **3.5 Depth deploy + verification** — Same screenshot/Lighthouse pass as 2.16, plus new pages and contact form tested live.
  - Depends on: 3.1–3.4.

## Milestone 4 — Launch (design-doc §16 Phase 3)

- [ ] **4.1 Domain purchase** — Action item #9. Buy via Cloudflare Registrar.

- [ ] **4.2 Point domain at the site, update links**
  - Files: `wrangler.jsonc`/Cloudflare dashboard routes, `src/data/resume.yaml`, LinkedIn/GitHub profile links.
  - Depends on: 4.1.

- [ ] **4.3 Final QA** — Lighthouse 95+ all categories, every section at 375px, WCAG AA contrast both themes, every link resolves, full keyboard pass.
  - Depends on: 4.2.
