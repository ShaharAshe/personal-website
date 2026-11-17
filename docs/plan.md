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
- **Phone matching rule** (all phone checks, `scripts/checks/phone.ts`): the phone is found by the
  **last 9 digits** of `CV_PHONE`, with separators (spaces, `-`, `.`, `(`, `)`) allowed between digits.
  `CV_PHONE` is stored in international form (`+972 …`), but a leak is just as likely in the local
  Israeli form (`0XX-…`); matching the last 9 digits catches both, whichever form either side uses, and
  tolerates PDF text extracted with spaces between characters. A `CV_PHONE` with fewer than 9 digits is
  a config error. Check output never prints the value or the matching line, only `file:line`.
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
  `CopyEmail` component (`src/components/CopyEmail.astro`, an Astro component with a small script, not a
  React island; changed in 2.9) — nowhere does the email appear as plain text in built HTML.
- JSON-LD `Person` schema (Task 2.13) is built from `resume.yaml` but **excludes `email` and `phone`
  entirely** — it's for SEO rich results, not a contact-harvesting surface.
- Node version pinned via `.nvmrc` (`22`) + `package.json` `engines.node`, so CI matches local exactly.
- Milestone 3: for Tasks 3.1 (Log Analytics Platform page) and 3.2 (case study), **the user drafts the
  actual text**; Claude Code builds the layout, MDX wiring, and (for 3.1) the SVG diagram around it.
- **Theme (changed in Task 2.2, replaces "dark by default"):** a first-time visitor gets their OS setting
  (`prefers-color-scheme`, dark if none reported). Once they use the toggle (Task 2.3), their choice is
  saved in `localStorage` under the key **`theme`** (`"light"` | `"dark"`, defined in `src/lib/theme.ts`)
  and wins from then on. Any other stored value, or blocked storage, is ignored → OS setting.
- GitHub disables scheduled workflows after 60 days with no repository activity. Regular commits/PRs
  prevent that; if it does get disabled, re-enabling requires a manual click — Actions tab → select the
  workflow → "Enable workflow" banner. A `workflow_dispatch` run or a push does not auto-reinstate a
  disabled schedule.

## Things the user needs to do themselves (and when)

| # | Action | Needed by |
|---|---|---|
| 1 | Install LibreOffice locally (24.2+) | Before Milestone 1, Task 1.2 |
| 2 | Add descriptions to `log-analytics-platform`, `NeetCode`, `project_euler`; add `portfolio-*` topics per §6.5; fix "About As"→"About Us" typo in `scam-reporting-app` README | Before Milestone 2, Task 2.8. **Done**: descriptions and `portfolio-*` topics verified from `projects.json` in Task 2.8; README typo fixed (user) |
| 3 | Create a free Cloudflare account | Milestone 1, Task 1.5 |
| 4 | Create a Cloudflare API token (Workers deploy scope) and the account ID; add both as GitHub Actions secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) | Milestone 1, Task 1.5 |
| 5 | Enable Cloudflare Web Analytics on the site once it has a URL, grab the beacon token | Milestone 2, Task 2.15. **Done**: site added for the workers.dev URL (manual JS snippet); token in `src/lib/analytics.ts` |
| 6 | Decide/approve the OG image design (or approve a simple generated placeholder) | Milestone 2, Task 2.13. **Done**: name + title + tagline, generated from `resume.yaml` (approved in 2.13's plan) |
| 7 | Draft the real content: Log Analytics Platform architecture + narrative, and the table-migration case study narrative (checked against §12 confidentiality) | Milestone 3, Tasks 3.1–3.2 |
| 8 | Decide contact-form email provider: Cloudflare Email Routing vs Resend; provide its secret/API key as a Cloudflare secret | Milestone 3, Task 3.3 |
| 9 | Choose and purchase the domain via Cloudflare Registrar | Milestone 4, Task 4.1 |
| 10 | Create a local `.env` (from `.env.example`) with your real `CV_PHONE`; add `CV_PHONE` as a GitHub Actions secret | Before Milestone 1, Task 1.2 (local), and Task 1.5 (CI secret) |
| 11 | Before making the repo public: delete the stale remote branch `ci/deploy`; then change the repo visibility to public | Task 2.16 (user decision in 2.5: make it public once the MVP is live; the pre-commit hook from 2.4c is already in place). `ci/deploy` is already gone (checked in 2.16); going public waits for #13 |
| 12 | Right after making it public: enable secret scanning + push protection and Dependabot alerts; confirm the `main` ruleset from Task 2.17 now shows as enforced (created by the user in 2.17: a PR is required, the `build` check must pass, the branch must be up to date, and force pushes and deletion are blocked; this deliberately reverses the earlier "no required PRs, no required status checks" wording, since direct pushes to `main` are no longer the workflow); check that PRs from forks need approval before they run Actions (Settings → Actions → General) | Task 2.16 (right after #11) |
| 13 | Email privacy: git now uses the GitHub noreply address for new commits (set on 2026-11-02; GitHub Settings → Emails: keep email private and block command-line pushes that expose it are on). Decide whether to rewrite the existing commits' author email, and whether to switch `resume.yaml` to a `contact@<domain>` address first (see #14), before the repo goes public | Task 2.16 (before making the repo public, #11). Audit in 2.16: 23 of 37 commits (2026-10-17 to 2026-11-01) carry the personal address; it's also in `resume.yaml`'s history by design. No phone, no secrets. Once the repo is public, consider adding a repo link to the console greeting (F.1, `src/lib/console-greeting.ts`) |
| 14 | Consider a `contact@<domain>` address via Cloudflare Email Routing for `resume.yaml` and the PDF, so the personal Gmail isn't public anywhere. If wanted before the repo goes public, buy the domain (#9) before going public (#11) | Milestone 4, Task 4.2 |

## New dependencies introduced by this plan

(beyond what `create_cv.js` already needs: `docx`, `js-yaml`)

`astro`, `typescript`, `tailwindcss` + `@tailwindcss/vite`, `@astrojs/react` + `react` + `react-dom`,
`@astrojs/mdx` (moved from Task 2.4 to Task 3.1, where the first MDX page is written), ~~`@astrojs/sitemap`~~ (dropped in Task 2.13: a small `sitemap.xml` endpoint instead), `pdf-parse` (replaced `pdf-lib` in Task 1.2), `@types/js-yaml`
(dev), ~~`tsx`~~ (dropped in Task 1.2: Node 22 runs the `.ts` scripts natively), `eslint` + `typescript-eslint` +
`eslint-plugin-astro`, `prettier` + `prettier-plugin-astro` + `prettier-plugin-tailwindcss`,
`@astrojs/check` (added in Task 1.4, needed by `astro check`), `wrangler` (dev, added in Task 1.5 for the Cloudflare deploy), `@playwright/test` (dev, added in Task 2.3a for e2e tests and review screenshots). `@astrojs/cloudflare` is added
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
      for a fixture resume, so any design change fails; refresh with `npm run test:update-golden` only
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

- [x] **1.4 Site checks wired into `npm run check`** — Combine `astro check`, lint, `npm test` (added in Task 1.2), and the site checks into one real command, built before the first CI pipeline: phone not present in `dist/`, **`CV_PHONE` not committed**, and **the generated PDF actually contains `CV_PHONE`**. (PDF one page and descriptions present already run inside `npm run build`, see notes.)
  - Files: `package.json` (`check` script), `scripts/checks/no-phone-in-dist.ts` (scans only `dist/**/*.{html,js,json,xml,txt}`, never the published `.pdf`/`.docx`), `scripts/checks/no-phone-in-source.ts` (new — when `CV_PHONE` is set, runs `git ls-files`, reads each tracked file, fails if the `CV_PHONE` number appears anywhere; catches it being hardcoded back in by accident, e.g. into `create_cv.js`; skips with a warning if `CV_PHONE` is unset locally, same as `create_cv.js`), `scripts/checks/pdf-contains-phone.ts` (new — when `CV_PHONE` is set, extracts text from the generated PDF with `pdf-parse`, already installed in Task 1.2, and fails if the number is *not* found, proving the phone really made it into the published resume).
  - Verify: `npm run check` passes on the stub; reintroducing the phone number into a component, or hardcoding it back into `create_cv.js`, each make the respective check fail; confirms the phone-in-dist check does *not* fail on `Shahar_Asher_Resume.pdf` itself; with `CV_PHONE` set, deleting the phone from the generated PDF (or not generating it) makes `pdf-contains-phone.ts` fail.
  - Depends on: 1.2, 1.3.
  - Done (2026-10-20). Notes / deviations:
    - **Out-of-date text corrected:** no new PDF dependency (`pdf-parse` from Task 1.2 does the text
      extraction; `pdf-lib` was never used). "PDF is one page" (`check-pdf.ts`, in `npm run cv`) and
      "repos have descriptions" (`fetch-projects.ts`, in `npm run projects`) are **not repeated in
      `check`**: both already fail `npm run build`, which CI runs before `check`.
    - `check` = `require-build.ts` → `astro check` → `lint` (ESLint) → `npm test` → `check:site` (the three
      phone checks, `.env` loaded) → `format:check` (`prettier --check .`). It runs against an existing
      build: `require-build.ts` fails with "run npm run build first" if `dist/` or `.generated/` is
      missing. Prettier runs last so everything else still reports until the separate formatting commit.
    - Phone checks: `CV_PHONE` unset → warning + exit 0 locally, exit 1 in CI (`CI` set). Matching rule:
      last 9 digits, separators allowed (see "Decisions"). Shared logic in `scripts/checks/phone.ts`.
      `no-phone-in-source.ts` only sees tracked files, so a newly created file is covered once it's `git add`ed.
    - Also added: `lint`, `format` (`prettier --write .`), `format:check`, `check:site`, and
      `test:update-golden` (sets `UPDATE_GOLDEN=1` from inside `node -e`, so it works in cmd, PowerShell
      and bash; replaces `UPDATE_GOLDEN=1 npm test`, which is bash-only).
    - Configs: `eslint.config.mjs` (`typescript-eslint` + `eslint-plugin-astro` recommended; `scripts/cv/*.js`
      treated as CommonJS), `.prettierrc.json` (single quotes, width 120, trailing commas — matches the
      existing code; YAML keeps double quotes so `resume.yaml`'s dates are untouched; Tailwind v4
      stylesheet set), `.prettierignore` (`docs/`, `**/*.md` — Markdown here is prose and instructions,
      not code — `tests/fixtures/`, `package-lock.json`, `dist/`, `.generated/`, `.astro/`).
    - `astro check` type-checks `scripts/` and `tests/` too (tsconfig includes `**/*`): 0 errors, 4
      hints (CommonJS files in `scripts/cv/`).
    - Deps (dev): `eslint@10`, `typescript-eslint@8` (supports TS `<6.1`, fine with 6.0.3),
      `eslint-plugin-astro@3`, `prettier@3`, `prettier-plugin-astro@1`, `prettier-plugin-tailwindcss@0.8`,
      `@astrojs/check@0.9`. `astro-eslint-parser@3.2` (via `eslint-plugin-astro`) declares Node
      `^22.22.3`; local Node 22.22.2 gets an install warning but lint works. CI's `.nvmrc` `22` resolves
      to the latest 22.x.
    - Tests: `tests/site-checks.test.ts` (+ `tests/helpers/pdf.ts`, a hand-built text PDF, so no
      LibreOffice needed), made-up number only: phone in a dist HTML/JS file fails, the resume
      `.pdf`/`.docx` in dist don't; `+972` ↔ `0XX` cross-format matches; phone in a tracked file of a
      temp git repo fails, an untracked `.env` doesn't; a PDF without the phone fails, with it passes;
      unset/CI/too-short `CV_PHONE`; missing build. Every test also asserts the check's output never
      contains the number.
    - Existing files not formatted yet (separate commit, `npm run format`). Golden files unaffected:
      `tests/fixtures/` is in `.prettierignore`.

- [x] **1.5 CI/CD: GitHub Actions → Cloudflare, deployed empty** — One workflow, two paths: PRs run `cv` → `projects` → `astro build` → the real `check` only; pushes to `main` additionally deploy to Cloudflare Workers (static assets, no adapter yet). Runner pinned to `ubuntu-24.04`; installs `libreoffice-writer` + `fonts-liberation`; fails if `fc-match Arial` doesn't resolve to Liberation Sans.
  - Files: `.github/workflows/deploy.yml`, `wrangler.jsonc`, `public/_headers` (stub).
  - Verify: PR runs build+check (incl. font-match) but does not deploy. Push to `main` deploys; Cloudflare `*.workers.dev` URL live with `/resume.pdf` downloadable as a real 1-page PDF. One-time task: visually compare the CI-built PDF against the current real resume PDF, confirm match. Because `CV_PHONE` is only ever set in CI (action item #10) and locally via `.env`, this is also the first real run of 1.4's two new phone-safety checks — confirm both pass here (phone not in any tracked file, phone present in the published PDF).
  - Depends on: 1.2, 1.3, 1.4. Needs action items #3, #4, and #10 (`CV_PHONE` secret) first — without it, `create_cv.js` fails the CI job by design (`process.env.CI` set).
  - Done (2026-10-21, merged as PR #1). Notes / deviations:
    - **Gap fixed:** nothing put the PDF on the site. New `scripts/cv/publish-pdf.ts` (last step of
      `build`) copies `.generated/cv/Shahar_Asher_Resume.pdf` → `dist/resume.pdf`; fails if either is
      missing. `check:site` now runs `pdf-contains-phone.ts` on `dist/resume.pdf` (the file actually
      published). Tests: `tests/publish-pdf.test.ts` (copy, missing PDF, missing `dist/`, `_headers` rule).
    - `public/_headers` (stub): `/*` → `X-Robots-Tag: noindex` (until launch, **removed in Task 4.3**),
      `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`;
      `/resume.pdf` → `Content-Disposition: inline; filename="Shahar_Asher_Resume.pdf"` (opens in the
      browser, saves with that name; see Tasks 2.5/2.11 for the download button). CSP stays in Task 2.14.
    - `wrangler.jsonc`: worker `personal-website`, `assets.directory: ./dist`, `workers_dev: true`, no
      Worker script, no adapter. Expected URL: https://personal-website.shaharasher.workers.dev
    - `.github/workflows/deploy.yml`: triggers `push` (**`main` only**, so a PR doesn't run twice —
      CI minutes are limited on the private repo), `pull_request`, daily `schedule` (03:17 UTC),
      `workflow_dispatch`. `ubuntu-24.04`, Node from `.nvmrc` with npm cache, `apt-get update` +
      `libreoffice-writer fonts-liberation`, `fc-match Arial` must contain "Liberation Sans", `npm ci` →
      `npm run build` → upload `dist/resume.pdf` as artifact `resume-pdf` (7 days, before `check` so it
      exists even if check fails) → `npm run check` → `wrangler deploy` only when
      `ref == main` and not a PR. `permissions: contents: read`; concurrency cancels an older run of the
      same ref. Actions: `checkout@v7`, `setup-node@v7`, `upload-artifact@v7` (latest majors, checked
      2026-10-21).
    - New dev dependency: `wrangler@4` (4.151.3; pulls the `workerd` binary, ~140 MB in
      `node_modules`). Used for the deploy and for local `wrangler deploy --dry-run` / `wrangler dev`.
      `.wrangler/` added to `.gitignore` and to the ESLint ignores (`eslint.config.mjs`): ESLint doesn't
      read `.gitignore`, so the files `wrangler dev` generates there broke `npm run check` locally.
    - Verified locally: `npm run build` + `npm run check` pass, `dist/resume.pdf` exists,
      `wrangler deploy --dry-run` OK, `wrangler dev` serves the headers above and 404s `/_headers`.
  - **Verify after push (together):**
    - [x] A PR runs build + check (incl. the `fc-match Arial` step) and the deploy step is skipped.
          PR run #1: build and check passed, "Deploy to Cloudflare" skipped; `fc-match Arial` printed
          "Liberation Sans"; LibreOffice 24.2.7.2.
    - [x] A push to `main` runs the deploy step and it succeeds. (Push run after squash-merging PR #1.)
    - [x] https://personal-website.shaharasher.workers.dev is live with `X-Robots-Tag: noindex`, and
          `/resume.pdf` opens as a real 1-page PDF that saves as `Shahar_Asher_Resume.pdf`.
          `curl -I /resume.pdf`: 200, `Content-Type: application/pdf`,
          `Content-Disposition: inline; filename="Shahar_Asher_Resume.pdf"`, `x-robots-tag: noindex`.
    - [x] One-time: download the `resume-pdf` artifact from the run and compare it with the real resume.
          Pixel-identical to the original: same Liberation Sans fonts, identical text.
    - [x] Both phone-safety checks pass in the CI log ("No phone number in 57 tracked files.",
          "dist/resume.pdf contains the phone number."). The phone never appears anywhere in the log.
  - Follow-up (2026-10-26, CI robustness): a run hung 6+ minutes in the LibreOffice install step on a
    slow Ubuntu mirror (normally ~25 s; whole run ~1 min). The `build` job now has
    `timeout-minutes: 15` (default is 6 hours), and both `apt-get update` and `apt-get install` use
    `-o Acquire::Retries=3 -o Acquire::http::Timeout=30`. Nothing else in the workflow changed.

## Milestone 2 — MVP (design-doc §16 Phase 1, remainder)

- [x] **2.1 Design tokens + global stylesheet** — `--bg/--surface/--text/--text-muted/--accent/--border` as CSS custom properties for both themes, Tailwind v4 `@theme` wired to them.
  - Files: `src/styles/global.css`.
  - Verify: Toggling `data-theme` on `<html>` swaps every token; contrast checked against §9.2.
  - Depends on: 1.1.
  - Done (2026-10-25). Notes / deviations:
    - Theme resolution: `<html data-theme="dark|light">` wins; with no `data-theme`, a
      `@media (prefers-color-scheme: light)` block on `:root:not([data-theme])` applies light; otherwise
      dark. Each block also sets `color-scheme` (native scrollbars/form controls follow the theme).
      Values are the §9.2 ones unchanged; light `--accent` is `#1F6FD1` (the doc's example value).
    - Tailwind: `@theme inline` maps `--color-bg/surface/text/text-muted/accent/border` to the tokens
      (`bg-surface`, `text-text-muted`, `border-border`, ...). **The default Tailwind palette is removed**
      (`--color-*: initial`), so `bg-blue-500` and the like don't exist: components can only use tokens.
    - **Accent-filled button text** uses `text-on-accent` = `--color-on-accent: var(--bg)` (a Tailwind
      alias, not a new token): `--bg` on `--accent` is 7.04:1 dark, 4.73:1 light. White on the dark
      accent would only be 2.76:1.
    - Tailwind sources limited to `src/` (`@import 'tailwindcss' source('../')`), fixing the 1.1 issue
      of it scanning `docs/` and the rest of the repo.
    - Contrast (all ≥ 4.5:1, nothing changed): text on bg/surface 15.85/14.63 dark, 17.69/18.47 light;
      text-muted 6.29/5.80 dark, 5.73/5.98 light; accent 7.04/6.50 dark, **4.73**/4.94 light (light
      accent is the tightest pair: darkening it is the fix if it ever fails). `--border` is decorative
      (card outlines), so no text-contrast requirement applies to it.
    - Tests: `tests/design-tokens.test.ts` reads `global.css` (no new dependency): both themes define
      exactly the six tokens as hex and every value differs between them; the prefers-color-scheme
      fallback equals the light block; values match the design-doc §9.2 table; `@theme` maps each
      token; Tailwind source is `src/`; WCAG AA for every pair above in both themes.
    - **Temporary:** `src/pages/index.astro` shows a swatch of every token plus text/link/button samples
      on `--bg` and `--surface`. **Task 2.10 replaces it** with the real homepage.
    - Screenshots: Playwright isn't installed yet (`@playwright/test` is still pending, see "New
      dependencies"), so these were taken with headless Edge and a throwaway `--user-data-dir`:
      375px (in a 375px iframe, since headless Edge has a ~500px minimum window width) and 1280px,
      `data-theme` dark/light set against the opposite OS preference, plus no `data-theme` with OS
      dark/light.
    - **Fonts → Task 2.2** (they need `<head>`, which `BaseLayout` creates). Plan: Inter + JetBrains
      Mono through Astro 7's built-in Fonts API (`fonts` in `astro.config.mjs`, Fontsource provider,
      `<Font />` in `BaseLayout`'s `<head>`). No new dependency: fonts are downloaded at build time and
      served from the site itself (self-hosted), with preload and metric-matched fallbacks (keeps CLS
      low). Then `--font-sans`/`--font-mono` in `@theme` point at its CSS variables. Until then, text
      uses Tailwind's system font stack.

- [x] **2.2 BaseLayout + no-flash theme script** — Shared layout with `<head>` inline script setting theme before paint (localStorage, try/catch), nav shell, skip link, footer placeholder.
  - Files: `src/layouts/BaseLayout.astro`.
  - Verify: Hard refresh in light mode never flashes dark first; keyboard tab order reaches skip link first.
  - Depends on: 2.1.
  - Done (2026-10-26). Notes / deviations:
    - **Theme decision changed** (user): OS setting on first visit, saved toggle choice wins after (see
      "Decisions"). Updated in `CLAUDE.md` (Design), design-doc §0, §7.2, §9.2.
    - New file beyond the list: `src/lib/theme.ts`, the only place the storage key and values are
      written: `THEME_STORAGE_KEY = 'theme'`, `THEMES`, and `themeInitScript`, the inline script's text
      built at build time from those constants (inserted with `JSON.stringify`). BaseLayout renders it
      with `<script is:inline set:html={themeInitScript} />` — inline, not a module, since an import or
      `type="module"` would defer it and bring the flash back. A saved `light`/`dark` sets `<html data-theme>`; nothing saved / invalid / storage throwing sets
      nothing, so `global.css`'s `prefers-color-scheme` fallback applies (and follows OS changes live).
    - `BaseLayout.astro` props: `title`, `description` (required; Open Graph etc. in 2.13). `<head>`:
      charset, viewport, theme script (before any stylesheet), title, description, fonts. `<body>`:
      skip link → `<header><nav aria-label="Main">` (placeholder links `/#experience`, `/#projects`,
      `/resume` — 404 until 2.11 — and `/#contact`) → `<main id="main" tabindex="-1">` → footer
      placeholder. No name/resume text hardcoded (hard rule 1), so no home link until 2.4.
    - **Fonts:** Astro 7's built-in Fonts API (`fonts` in `astro.config.mjs`, Fontsource provider, no new
      dependency): Inter 400/500/600 (`--font-inter`) + JetBrains Mono 400 (`--font-jetbrains-mono`),
      latin, normal, woff2, downloaded at build time and served from `/_astro/fonts/` (4 files, ~94 KB
      total). Only Inter 400 is preloaded. Metric-matched Arial fallbacks generated (low CLS). `@theme`
      maps `--font-sans`/`--font-mono` to them. **The build now needs network access** to Fontsource
      (CI has it).
    - **Type scale (user-revised, 6 sizes, design-doc §9.3 updated):** Tailwind's default sizes removed
      (`--text-*: initial`); `xs` .75rem, `sm` .875rem, `base` 1rem, `lg` 1.25rem, `xl` 1.75rem,
      `display` `clamp(2.25rem, 1.5rem + 3.75vw, 3rem)` (Hero title only, line-height 1.1).
      `index.astro`'s `text-2xl` h1 → `text-xl`.
    - `global.css`: global `:focus-visible` outline in `--accent`; `main:focus` has no outline (it's
      only focused by the skip link).
    - `index.astro` uses BaseLayout; the swatch content is unchanged (its `<main>` became a `<div>`).
    - Tests: `tests/theme-init.test.ts` runs `themeInitScript` itself in `node:vm` with a fake document
      and storage: saved `light`/`dark` applied; invalid values, `getItem` throwing, the `localStorage`
      getter throwing and no `localStorage` all leave `data-theme` unset; nothing saved → unset (OS
      setting). `tests/base-layout.test.ts` checks `dist/index.html` (skips without a build):
      `lang="en"`, the inlined script equals `themeInitScript`, has no attributes and comes before any stylesheet, the skip link is the first focusable element and
      targets `<main id="main">`, nav links + footer, fonts self-hosted with one preload.
      `tests/design-tokens.test.ts`: font mapping and exactly the 6 sizes.
    - Skip link: `fixed` + `-translate-y-[200%]`, `focus:translate-y-0` (not `sr-only`/`not-sr-only`:
      Tailwind v4's `not-sr-only` resets padding to 0, so the focused link lost its padding).
    - Screenshots: headless Edge again (Playwright still not installed) with a temporary
      `--user-data-dir`, against a scratch copy of `dist/` plus a helper page that sets
      `localStorage.theme` and frames the page (iframe, for 375px): saved dark and saved light at 375px
      and 1280px, each against the *opposite* OS preference (saved choice wins); nothing saved with OS
      dark / OS light (follows the OS); the skip link focused (1280 dark, 375 light). Inter and
      JetBrains Mono render; the skip link is hidden until focused.

- [x] **2.3 ThemeToggle (Astro component)** — Astro component with a small script, flips `data-theme` + persists choice.
  - Files: `src/components/ThemeToggle.astro`, `src/lib/theme.ts`.
  - Verify: Toggle works, persists across reload, respects `prefers-reduced-motion`.
  - Depends on: 2.2.
  - Note (from 2.2): import `THEME_STORAGE_KEY`/`THEMES` from `src/lib/theme.ts` (never retype them; the
    no-flash script `themeInitScript` is built from the same constants). Write `"light"`/`"dark"` under
    the key (try/catch) and set `document.documentElement.dataset.theme`. With no `data-theme` yet (first visit), the current
    theme is the OS one: read it from `matchMedia('(prefers-color-scheme: light)')`.
  - Done (2026-10-27). Notes / deviations:
    - **Not a React island** (user decision): React would ship ~45–60KB of JS on every page for one
      button, which breaks "homepage JS < 30KB gzipped". It's `src/components/ThemeToggle.astro` with a
      processed `<script>`. Updated: design-doc §3.1 and §14 (tree), and `.claude/rules/ui.md` (that
      bullet replaced with the user's principle: an Astro component + small script for simple
      interactions, React islands only for complex ones like the contact form).
    - **Homepage JS: 0.56 KB gzipped in total** (the inline no-flash script + the toggle script). No
      React runtime ships, since the page has no islands.
    - Logic lives in `src/lib/theme.ts` as pure functions: `isTheme`, `currentTheme(dataTheme,
      osPrefersLight)`, `nextTheme`, `toggleLabel` ("Switch to light/dark theme"), and
      `saveTheme(theme, getStorage)` (try/catch around both the `localStorage` getter and `setItem`).
      The component only wires them to the DOM: it sets the label on load, on click (sets `data-theme`,
      saves, updates the label) and on OS `change` (while nothing is saved, the page follows the OS live).
    - **Icon = the target theme** (user choice): sun in dark, moon in light. Both SVGs are in the
      markup, and the component's scoped CSS picks one with the same resolution as the tokens
      (`data-theme`, else `prefers-color-scheme`), so the icon is right before any JS runs (checked with
      JS disabled). The build-time `aria-label` is a neutral "Switch color theme", replaced by the exact
      one when the script runs.
    - **Motion** (user choice, design-doc §10.1 updated: it said "smooth color transition", which
      clashes with the transform/opacity-only rule): colors switch instantly. Only the new icon
      rotates and fades in (200ms, ease-out). It's gated by `data-animate`, which is set on the first
      click, so nothing plays on load, and it's defined only inside
      `@media (prefers-reduced-motion: no-preference)`.
    - **Nav at 375px** (added on approval): the toggle sits inside `<nav aria-label="Main">` after the
      links (last Tab stop in the header), `size-10 shrink-0` (40×40). With the 2.2 gaps, "Contact"
      wrapped to a second line at 375px, so the gaps are now `gap-4`/`gap-x-4` below `sm` and
      `gap-6`/`gap-x-6` from `sm` up. Everything fits on one line at 375px, with no horizontal scroll.
      `min-w-0` + `flex-wrap` on the `<ul>` keep anything narrower wrapping instead of overflowing. No
      hamburger menu needed now (see the open item in 2.10).
    - Tests: `tests/theme-toggle.test.ts`. Pure logic: data-theme wins over the OS; no or invalid
      data-theme → the OS theme; next theme from light/dark and from the OS light/dark; labels;
      `saveTheme` writes under the key and doesn't throw when `setItem` or the storage getter throws.
      On `dist/index.html`: a `<button type="button" data-theme-toggle aria-label="…">` inside the main
      nav; both icons present with `aria-hidden`; the icon animation is only under
      `prefers-reduced-motion: no-preference`; **homepage JS < 30KB gzipped** (prints the size).
    - Browser check: headless Edge (temporary `--user-data-dir`, CDP, no Playwright), against
      `astro preview`. Verified: first visit follows the OS (icon + label, including a live OS change);
      click flips, saves, and updates icon and label; reload keeps the saved choice over the opposite OS
      setting, with no animation on load; with JS disabled, CSS alone shows the right icon; Tab ×6
      (skip link, 4 links) reaches the toggle, and Enter and Space both switch it; under reduced motion
      `animation-name` is `none`; at 375 and 1280 in both themes: no horizontal scroll and a 40×40
      button. Screenshots: 375/1280 × dark/light, plus the toggle focused (1280 dark, 1280 light, 375
      light).

- [x] **2.3a Playwright end-to-end tests** — Turn the one-off browser checks of 2.2/2.3 into permanent
  Playwright tests, run them in CI before deploy, and add a repeatable review-screenshot command.
  **From now on, every UI task includes e2e tests** for whatever needs a real browser.
  - Files: `playwright.config.ts`, `tests/e2e/{theme-toggle,base-layout}.spec.ts`, `tests/e2e/helpers.ts`,
    `tests/e2e/review-screenshots.ts`, `package.json`, `.gitignore`, `.prettierignore`,
    `eslint.config.mjs`, `tsconfig.json`, `.github/workflows/deploy.yml`, `CLAUDE.md`, design-doc
    §13.3/§14/§17.2.
  - Depends on: 2.3.
  - Done (2026-10-27). Notes / deviations:
    - Dependency: `@playwright/test` `^1.64.1` (lockfile: 1.64.1; pulls `playwright` + `playwright-core`,
      ~19 MB unpacked). Locally the tests use the installed Edge (`channel: 'msedge'`), so nothing is
      downloaded; CI runs `npx playwright install --with-deps --only-shell chromium`.
    - Scripts: `test:e2e` (project `e2e`, `tests/e2e/*.spec.ts`) and `screenshots` (project `screenshots`,
      `review-screenshots.ts` → `screenshots/{375,1280}-{dark,light}[-toggle-focused].png`, gitignored,
      no pixel comparisons). Neither is part of `npm run check` (needs a browser); CI runs `test:e2e`
      as its own step. `npm test`'s glob (`*.test.ts`) doesn't match `*.spec.ts`.
    - Server: `require-build.ts && astro preview --port 4322`, reused locally if already running.
      **Port 4322, not 4321**, so a running `npm run dev` is never mistaken for the build. A missing
      `dist/` fails with "dist/ not found: run npm run build first."
    - **`workers: 1`**: measured locally, 1 worker runs the suite in ~11–16 s, 4 workers in ~31 s
      (parallel Edge instances slow each other). Retries 0.
    - **Finding (test-side, not a bug):** under parallel load, a headless page sometimes got no rendering
      update after `emulateMedia`, so the matchMedia `change` event (dispatched during "update the
      rendering") never reached the toggle; the CSS still followed the OS. Probes showed the event always
      arrives once the page renders a frame. `changeOsTheme()` in `tests/e2e/helpers.ts` waits for one
      animation frame after the media change (an event, not a sleep). Stable: 12/12 alone, 57/57 over 3
      parallel full runs.
    - 19 tests. Theme toggle: first visit follows the OS (×2); live OS change; click switches + saves
      under `THEME_STORAGE_KEY` + icon/label (×2); reload keeps the saved theme over the opposite OS,
      with `data-theme` already set when `<body>` is inserted (no flash) and no animation on load (×2);
      keyboard (Tab order skip link → 4 links → toggle, Enter and Space, focus ring); reduced motion
      (`animation-name: none`) + a no-preference control; 375/1280 × dark/light: no horizontal scroll,
      toggle 40×40. BaseLayout: skip link (off-screen until focused, first Tab stop, Enter focuses
      `<main>`); nav link focus rings; each self-hosted font (family read from `--font-inter` /
      `--font-jetbrains-mono`, loaded with `document.fonts.load`, status `loaded`, independent of page
      content); `/resume.pdf` 200 `application/pdf`.
    - Break-on-purpose check: with `saveTheme(...)` commented out in `ThemeToggle.astro`, 4 tests failed
      (both "click saves" and both "reload keeps" tests: storage `null`); restored, all pass.
    - CI: after `npm run check`: apt retry config (`/etc/apt/apt.conf.d/80-retries`, same values as the
      LibreOffice step) → install the headless shell → `npm run test:e2e` → on failure upload
      `playwright-report/` (7 days). Deploy only after it passes. Expected extra time ~35–60 s.
    - `tsconfig.json` excludes `playwright-report`/`test-results` (Astro's tsconfig has `allowJs`).
  - **Verify after push:** the CI run passes the e2e step and logs its time; the deploy still runs.

- [x] **2.4 Data layer: resume, projects, project-page frontmatter** — validated `resume` module over `resume.yaml`; `projects.json` read and validated at build time; `projects` collection with a frontmatter schema.
  - Files: `src/lib/resume.ts`, `src/lib/projects.ts`, `src/lib/project-pages-loader.ts`,
    `src/data/project-page.schema.ts`, `src/content.config.ts`, `scripts/checks/no-email-in-dist.ts`,
    `scripts/checks/email.ts`, `scripts/checks/dist-files.ts`; tests `tests/resume-data.test.ts`,
    `tests/projects-data.test.ts`, `tests/project-page-schema.test.ts`, `tests/project-pages-loader.test.ts`
    (+ email-check tests in `tests/site-checks.test.ts`).
  - Verify: `astro check` catches an intentionally broken frontmatter field.
  - Depends on: 1.2, 1.3, 2.1.
  - **Done — notes / deviations:**
    - **Resume is a validated module, not a single-entry collection.** `src/lib/resume.ts` reads
      `resume.yaml` with `js-yaml`, validates it with the existing `resumeSchema`, and fails the build
      with `z.prettifyError` output naming the field (e.g. `→ at work[0].position`). A plain module gives
      typed data with no `getEntry()`/id plumbing, and node:test can import it. Exports: `getResume()`,
      `getEmailParts()`, `RESUME_YAML`, `ResumeDataError`, types `PublicResume`, `ResumeBasics`, `EmailParts`.
    - **Email rule:** `getResume()` returns `basics` **without** `email` (removed from the object, not only
      the type). The only way to the address is `getEmailParts()` → `{ user, domain }`, for the CopyEmail
      button (2.9/2.11) to assemble in the browser. New hard rule 8 in CLAUDE.md; `.claude/rules/ui.md`
      now says the `mailto:` link is assembled in the browser too.
    - **New site check `no-email-in-dist`** (in `npm run check:site`): the resume email must not appear in
      `dist/**/*.{html,js,json,xml,txt}` (case-insensitive, also the `%40` form); PDF/DOCX not read;
      prints only `file:line`. Shares `listSiteFiles`/`SITE_EXTENSIONS` (`scripts/checks/dist-files.ts`)
      with `no-phone-in-dist`.
    - **`scripts/cv/paths.js` can't be imported from `src/`**: tried it, `astro build` failed with
      `__dirname is not defined in ES module scope` (Vite treats source files as ESM; the file is CommonJS for
      `create_cv.js`). So `src/lib/resume.ts` and `src/lib/projects.ts` resolve their files from
      `process.cwd()` (the project root for npm scripts and Astro; `import.meta.url` points at the bundled
      chunk in a build), and a test asserts the resume path equals `RESUME_YAML`.
    - **Projects:** `src/lib/projects.ts` holds `projectsDataSchema` (strict; non-empty description on
      featured/portfolio) and the `Project`/`PracticeLink`/`ProjectsData` types derived from it.
      `scripts/github/projects.ts` imports those types instead of its own interfaces. Missing file →
      `run npm run projects first`; bad JSON or shape → `stale? run npm run projects again` + the field.
      A test checks `fetchProjects` output parses with the schema.
    - **`projects` collection only.** Frontmatter schema `src/data/project-page.schema.ts` (strict, all
      optional): `title`, `description` (longer than GitHub's), `status`, `team`. No `resume` and no
      `case-studies` collection (→ 3.2); no `@astrojs/mdx` (→ 3.1).
    - **Astro 7.4 can't read `.mdx` without `@astrojs/mdx`**: `glob()` logs "No entry type found" and skips
      the file, so its frontmatter isn't checked. The collection matches `**/*.{md,mdx}`; `.md` works now.
    - **Quiet glob wrapper:** `glob()` warns on every build when the folder is missing (git keeps no empty
      folders) or empty. The `projects` loader calls `projectPagesAction()` (`src/lib/project-pages-loader.ts`,
      unit-tested): no pages → empty collection, no warning; pages → `glob()`; a `.mdx` page while `.mdx`
      isn't registered → fails with "Add the @astrojs/mdx integration (task 3.1)". With no pages, `astro dev`
      sees a newly created first page only after a restart. Build output has no new warnings vs. before.
    - **Broken-frontmatter check** (temporary `src/content/projects/zz-broken-frontmatter.md`, deleted after):
      `status: 123` → `astro check` exit 1, `InvalidContentEntryDataError … status: Expected type "string",
      received "number"` with the file path; an unknown `stars:` field → `Unrecognized key: "stars"`; a
      temporary `.mdx` → the "Add the @astrojs/mdx integration" error.
    - No e2e tests: no UI in this task. `index.astro` (swatch page) unchanged.

- [x] **2.4b Project README** — `README.md` for two readers: a hiring manager opening the repo from the
  site (once public) and the user setting the project up on a new machine. A summary that links to the
  design doc, not a copy of it.
  - Files: `README.md`, `CLAUDE.md`, `tests/readme.test.ts`.
  - Depends on: 2.4.
  - Done (2026-10-28). Notes:
    - Sections: title + live link + work-in-progress line → Notable decisions (first, so a hiring manager
      sees them on the first screen) → Stack → How it works (Mermaid flow + the three build steps) →
      Running locally → Scripts (every npm script, one row each) → Testing and CI → Project docs → Roadmap.
    - Every claim checked against the code, not the docs. E.g. without `CV_PHONE` locally, `build` warns
      and omits the phone and `check`'s phone checks warn and skip (in CI both fail); setting `CV_PHONE`
      after such a build fails `pdf-contains-phone` until the next build. No live numbers that go stale
      (the JS budget is stated, not the current size).
    - Staleness guards: `CLAUDE.md` "How to work" rule (a task changing commands, setup, prerequisites or
      architecture updates the README) + a "Definition of done" item. `tests/readme.test.ts`: every
      `package.json` script appears as `npm run <name>` (or `npm <name>`), and every `npm run <name>` in
      the README is a real script; failures name the scripts.
    - Break-on-purpose: with the `test:update-golden` row removed, the test failed with "README.md doesn't
      mention these npm scripts: test:update-golden"; restored, both pass.
    - No email, phone or secret values in the README (checked by script, nothing printed).

- [x] **2.4c Pre-commit hook: block commits containing the phone** — before the repo goes public, catch
  the phone on the user's machine instead of in CI after the push (once pushed to a public repo it's
  exposed even if CI fails).
  - Files: `.githooks/pre-commit`, `scripts/checks/no-phone-in-staged.ts` + `staged.ts` (pure logic),
    `scripts/git/install-hooks.ts` + `hooks.ts` (pure logic), `package.json`,
    `tests/no-phone-in-staged.test.ts`, `README.md`, `CLAUDE.md`.
  - Depends on: 2.4b.
  - Done (2026-10-29). Notes:
    - The hook is POSIX sh (`#!/bin/sh`, LF; `* text=auto eol=lf` already covers it) and runs
      `node --env-file-if-exists=.env scripts/checks/no-phone-in-staged.ts`. Works with Git for
      Windows' bundled sh, macOS and Linux (executable bit set via `git add --chmod=+x`).
    - Checks the index, not the disk: `git diff --cached --name-status -z --no-renames`, then
      `git cat-file blob :<path>` for every non-deleted file. Binary files (a NUL in the first 8000
      bytes) are skipped. Reuses `readPhone` / `phonePattern` / `findPhone` from `phone.ts`. Prints only
      `file:line`, plus what to do and "never --no-verify". A path containing the number is reported
      without printing the path.
    - Fails closed: no `CV_PHONE` (no `.env`) blocks the commit with "create .env from .env.example";
      a git failure or missing `node` blocks too. `npm run check`'s warn-and-skip is unchanged.
    - Installed by `"prepare"` (runs on `npm install` / `npm ci`): sets local
      `core.hooksPath=.githooks`. Always exits 0. Skips when `CI` is set (GitHub Actions prints one line
      and moves on; `no-phone-in-source` still runs there), when git is missing, or outside a git
      checkout; if `core.hooksPath` is already set to another folder it warns and leaves it.
    - `npm run check:staged` runs the same check by hand; not part of `npm run check`.
    - Tests: 17 (pure functions, installer decisions, the hook file, and a real temp git repo —
      including "staged has it, working tree doesn't → still fails" and missing `CV_PHONE` → fails).
    - Real-repo verification with a made-up number: a staged scratch file → exit 1 naming
      `hook-scratch.txt:2`; unstaged and deleted afterwards, index left empty as found.
    - Branch protection and "make the repo public" moved here from 4.3 as user actions #11–#12.

- [x] **2.5 Hero** — Name, title, one-line summary (from `basics.summary`, trimmed), CTAs (Download Resume primary, View Projects secondary), social icons. No phone.
  - Files: `src/components/Hero.astro`.
  - Verify: Download Resume links to `/resume.pdf`; phone never rendered.
  - Note (from 1.5): the button is `<a href="/resume.pdf" download="Shahar_Asher_CV.pdf">`, so it
    downloads, while a direct link to `/resume.pdf` opens in the browser (`_headers` serves it `inline`).
  - Depends on: 2.2, 2.4.
  - Done (2026-10-30). Notes / deviations:
    - Files: `src/components/Hero.astro`; new `src/lib/hero.ts` (`heroContent`, `socialIcon`) and
      `src/lib/resume-pdf.ts` (`RESUME_PDF_URL`, `RESUME_PDF_FILENAME`); `src/pages/index.astro`;
      `src/data/resume.yaml` + `resume.schema.ts`; the 5 `tests/fixtures/resume-*.yaml`;
      `scripts/cv/paths.js`, `public/_headers` and file-name comments in `check-pdf.ts`,
      `pdf-contains-phone.ts`, `publish-pdf.ts`, `to-pdf.js`, `create_cv.js` (line 5 comment only, user
      approved); tests `tests/hero.test.ts`, `tests/e2e/hero.spec.ts`, `tests/resume-schema.test.ts`,
      `tests/site-checks.test.ts`; `README.md` (one sentence); `.claude/rules/resume.md`; design-doc §5.1,
      §7.2, §7.4, §7.5, §7.7, §13.3.
    - **Title (user decision):** `basics.label` → "Software Engineer, Backend & Distributed Systems".
      `create_cv.js` never reads `label`, so the PDF is unchanged.
    - **One line (user decision):** new **required** field `basics.tagline` (schema), so
      `validate-resume.ts` fails first with `→ at basics.tagline`. Not used by `create_cv.js`: the golden
      Word XML test passes unchanged (no `test:update-golden`). The first sentence of `summary` was not
      used because it starts with "Software Engineer", repeating the title.
    - **PDF file name renamed (user decision): `Shahar_Asher_Resume` → `Shahar_Asher_CV`**
      (`RESUME_BASENAME` in `paths.js`). Generated files are now `.generated/cv/Shahar_Asher_CV.{docx,pdf}`;
      the download and `Content-Disposition` name is `Shahar_Asher_CV.pdf`. URL `/resume.pdf` and the
      button text are unchanged. The 1.4/1.5 notes above still say `Shahar_Asher_Resume`: they record
      what was true then. Old `.generated/cv/Shahar_Asher_Resume.*` files are left behind locally
      (gitignored, harmless).
    - **No drifting copy:** `src/` can't import the CommonJS `paths.js`, so `RESUME_PDF_FILENAME` is a
      copy; `tests/hero.test.ts` checks it (and the built `download` attribute) against
      `RESUME_BASENAME`, and `tests/publish-pdf.test.ts` checks `_headers` against it.
    - Profile links come from `basics.profiles` (LinkedIn, GitHub), open in the same tab (no
      `target="_blank"`), `aria-label` = the network name, inline-SVG icons. An unknown network fails
      the build. No email icon yet (→ 2.9).
    - `index.astro`: Hero on top; the swatch heading is now an `<h2>` (one `<h1>` per page); the page
      `title`/`description` were hardcoded resume text and now come from `getResume()` (same output). Changed in
      2.13: title `` `${name} – ${label}` ``, description `basics.tagline`.
    - Visual: subtle dot grid (`--border` dots, faded edges) via a scoped `::before`. Zero JS, no motion
      (→ 3.4). Homepage JS still 0.56 KB gzipped.
    - Tests: `tests/hero.test.ts` (13: helpers, file name, built HTML: one `<h1>` = name, title and
      tagline from YAML, download href/name, the only accent-filled element, View Projects target, profile
      links + `aria-label`s, no script / no unsafe `_blank`); schema test for a missing `tagline`;
      `tests/e2e/hero.spec.ts` (7: download event file name, `/#projects`, Tab order + focus rings,
      375/1280 × dark/light no horizontal scroll and CTAs fully visible). Break-on-purpose: a wrong
      `download` value fails the hero test; a YAML without `tagline` fails `validate-resume.ts`.

- [x] **2.6 Experience section** — Homepage shows `featured: true` highlights only (timeline layout), link to full `/resume`.
  - Files: `src/components/Experience.astro`.
  - Depends on: 2.4.
  - Done (2026-11-01). Notes / deviations:
    - Files: `src/components/Experience.astro`; new `src/lib/experience.ts` (`experienceContent`) and
      `src/lib/resume-dates.ts` (`formatDate`, `dateRange`, `dateParts`, `PRESENT`); `src/pages/index.astro`
      (Experience right after the Hero, swatches still below); tests `tests/experience.test.ts`,
      `tests/e2e/experience.spec.ts`; design-doc §5.1 (one line).
    - Content: 4 featured highlights, all from the one role (Taboola), in YAML order. A test enforces the
      §5.1 rule (3–4 featured in total), not the exact set: changing the flags needs no test edit.
    - **A role with no featured highlights is still shown** (company, position, dates only), so the timeline
      has no gaps.
    - **Dates:** `scripts/cv/format.js` is CommonJS, which `src/` can't import, so `src/lib/resume-dates.ts` is
      a copy. `tests/experience.test.ts` runs both on the same inputs (all 12 months, year-only, missing end,
      every work/education item in the real YAML and the fixture). Break-on-purpose: "Apr" → "April" in the
      copy failed 3 tests; restored. Rendered as `<time datetime="2025-04">Apr 2025</time> – …`; an open
      end is the text `Present` (no `<time>`).
    - Layout: `<section id="experience">` + `<h2>`, an `<ol>` timeline (left border line + a dot per role),
      each role a bordered `bg-surface` card; dates sit right of the company from `sm:` up, stacked on mobile.
      No accent-filled element; zero JS (homepage JS still 0.56 KB gzipped); no motion (→ 3.4).
    - **Full-resume link → `/resume`** ("View full resume →", plain accent text link), like the nav's Resume
      link: a 404 until 2.11 (see the note there).
    - No case study link yet (→ 3.2, see the note there).
    - Tests: `tests/experience.test.ts` (12: date formatting + parity with the PDF, featured filtering, the
      §5.1 count rule, built HTML: id/`<h2>`, featured shown / non-featured absent from the page, company/
      position/dates + `datetime` per role, `/resume` href, one `<h1>`, no script, no `bg-accent`);
      `tests/e2e/experience.spec.ts` (6: nav link → `#experience` in view, Tab from the last Hero profile link
      to the full-resume link with a focus ring, 375/1280 × dark/light no horizontal scroll).

- [x] **2.7 Skills section** — Categorized list from `resume.yaml`, no progress bars/percentages.
  - Files: `src/components/Skills.astro`.
  - Depends on: 2.4.
  - Done (2026-11-01). Notes / deviations:
    - Files: `src/components/Skills.astro`; new `src/lib/skills.ts` (`skillsContent`: every category and item,
      copied, in YAML order); `src/pages/index.astro` (Skills right after Experience, swatches still below; the
      final order is set in 2.10); tests `tests/skills.test.ts`, `tests/e2e/skills.spec.ts`. Design doc
      unchanged (matches §5.1).
    - Content: 5 categories, 26 items (Languages 5, Frameworks & Architecture 6, Databases 4, DevOps & Tools
      9, AI Tools 2). Longest item "Kusto (Azure Data Explorer)" fits at 375px.
    - **Spoken languages (`resume.languages`) are not in Skills** (user decision): they go on `/resume`
      (see the note on 2.11). The "Languages" category name stays (no ambiguity without spoken languages,
      and renaming it would change the PDF).
    - Layout: `<section id="skills" aria-labelledby>` + `<h2>`; per category an `<h3>` (muted, small) and a
      `<ul role="list">` of outline chips (`--border` 1px, mono `text-sm`, no fill). Category left of its chips
      from `sm:` up (13rem column), stacked on mobile. Chips wrap (`flex-wrap`), and a long name wraps inside
      its chip (`max-w-full`, `overflow-wrap: anywhere`). `role="list"` because Safari/VoiceOver drops list
      semantics for `list-style: none`. 720px text width. No accent, no levels, zero JS (homepage JS still
      0.56 KB gzipped), no motion (→ 3.4). No nav link (see the 2.10 nav note).
    - Tests: `tests/skills.test.ts` (9: helper on the fixture and the real resume, returns copies; built HTML:
      id/`aria-labelledby`/`<h2>`, every category as `<h3>` and every item in YAML order in a `role="list"`,
      no `%`/`<progress>`/`<meter>`/progressbar/`aria-value*`/inline `style`/`n/n`/stars, no spoken languages,
      one `<h1>`, no script, no `bg-accent`); `tests/e2e/skills.spec.ts` (4: 375/1280 × dark/light no horizontal
      scroll, every chip visible and inside the viewport width; the count comes from the resume, so editing
      skills needs no test change). Break-on-purpose: dropping the first item per category in the helper failed
      both helper tests; restored.

- [x] **2.8 Projects section** — Featured wide card, "More projects" grid, "Algorithm practice" link row, per the topic tiers in `.claude/rules/github-projects.md`.
  - Files: `src/components/Projects.astro`, `src/components/ProjectCard.astro`.
  - Verify: With action item #2 done, re-run `npm run projects`, confirm the three tiers render; a repo with a missing description fails the build instead of rendering an empty card.
  - Depends on: 1.3, 2.4; needs action item #2.
  - Done (2026-11-02). Notes / deviations:
    - Files: `src/components/Projects.astro`, `src/components/ProjectCard.astro`; new `src/lib/projects-section.ts`
      (pure: `projectsSection`, `projectCard`, `practiceLink`, `updatedLabel`, `githubProfileUrl`); new
      `src/components/GitHubIcon.astro` (the one copy of the GitHub mark's SVG, `aria-hidden`; the Hero's
      profile link now uses it too); `src/pages/index.astro` (Projects between Experience and Skills, swatches
      still below); tests `tests/projects-section.test.ts`, `tests/e2e/projects.spec.ts`, and a text-muted on
      `--border` pair in `tests/design-tokens.test.ts`. Design doc §6.4/§6.5 updated (see below);
      `.claude/rules/ui.md` gained the accent-means-clickable rule.
    - Data at build time (projects.json, pushed_at order): featured `log-analytics-platform`; portfolio
      `scam-reporting-app`, `diff-checker` (Live demo), `Cryptography_modules` (2★); practice `LeetCode`,
      `NeetCode`, `project_euler`. All read through `getProjects()`; nothing hardcoded, no browser fetch.
    - Layout: `<section id="projects" aria-labelledby>` + `<h2>`, 1100px wide. Featured: full-width card(s),
      title `<h3>`, no group heading. "More projects" `<h3>` + `<ul role="list">` grid (1 col, 2 from `sm:`,
      3 from `lg:`), card titles `<h4>` (user decision: nested headings over a flat all-`<h3>` outline).
      "Algorithm practice" `<h3>`, one muted line "Solutions on GitHub" (`text-sm text-text-muted`, not a link,
      no icon: says once for the group where the links go), then a wrapping row of accent text links, each
      "<title> ↗" (no GitHub icon: ui.md "Link markers", no logo repeated on every item). An empty tier renders nothing (no heading); if all three are empty the section keeps its `<h2>` (Hero/nav
      link to it) with one line linking to the GitHub profile from `resume.yaml` (also with the icon).
    - Card (`<article>`, 1px `--border`, `--surface`, no shadow): title, status · team (page only),
      description, language chips (outline, `border-border`), topic chips (no border, `bg-border` fill,
      `text-text-muted` — 4.8:1 in both themes — mono `text-xs`, wrapping; a topic that only repeats a
      language, ignoring case, is dropped), `★ n` only if > 0 (spoken "n stars"), `Updated <time
      datetime="YYYY-MM">Mon YYYY</time>` (UTC month, never relative), then the links.
    - Links: accent means "clickable", chips are never accent. Card links and practice links are accent text
      links (`text-accent`, medium, underline on hover, global focus ring, 40px tap height, 24px apart): "GitHub"
      with the shared `GitHubIcon` in front, "Live demo ↗" (only for an http(s) `homepage`), "Read more →"
      (only with a project page); practice links "<title> ↗". Icons and arrows are `aria-hidden`. Links open in the same tab; each
      `aria-label` names the project and contains the visible text ("Log Analytics Platform on GitHub", "Live
      demo of …", "Read more about …", "LeetCode on GitHub"). No whole-card link, no nested links, no accent
      fill, zero JS (homepage JS still 0.56 KB gzipped), no motion (→ 3.4).
    - Project pages: `projectsSection(data, pages)` matches a `projects` collection entry to a repo by id vs.
      repo name, ignoring case (Astro's glob loader lowercases ids). Frontmatter title/description override
      GitHub, status/team are added, and the card links to `/projects/<entry id>`. Not applied to practice
      links. No pages exist yet, so no card links to `/projects/`; the merge is unit-tested with made-up
      entries. `Projects.astro` only calls `getCollection('projects')` once a page file exists
      (`listProjectPageFiles`), because it warns on every build while the collection is empty.
    - Missing descriptions: not re-implemented. Already proven by `tests/github-projects.test.ts`
      (`findMissingDescriptions…`, `fetchProjects: missing description throws…`, `CLI: missing description
      exits non-zero…`) and `tests/projects-data.test.ts` (`an empty description on a featured/portfolio
      project fails`).
    - Tests: `tests/projects-section.test.ts` (29: helpers on made-up data — tier order, empty tiers /
      `isEmpty`, stars 0 vs > 0, Live demo only for http(s), month/year + UTC + `datetime`, topic dedupe,
      page overrides + case-insensitive match + no link without a page, practice ignores pages, GitHub
      profile URL; built HTML — id/`aria-labelledby`/`<h2>`, between Experience and Skills, every card in
      order with title/description/repo href/demo/stars from `getProjects()`, practice links, link names
      include the title and no `target`, no nested links, `<time>` values and no relative text, no
      `/projects/` href without page files, one `<h1>`, no script, no `bg-accent`; each language and topic its
      own `<li>` in a `role="list"`; card and practice links are accent text links (no chip classes), chips
      never accent, `aria-hidden` GitHub icon / ↗ / →; the GitHub SVG path exists only in `GitHubIcon.astro`,
      and the icon appears only on the Hero GitHub link, each card's "GitHub" link and the all-empty fallback;
      practice links end in an `aria-hidden` ↗ with no icon, under a muted "Solutions on GitHub" line). `tests/design-tokens.test.ts`: text-muted on
      `--border` ≥ 4.5:1 in both themes (accent on surface was already covered). Repos with a page file are
      exempt from the title/description checks, so 3.1 needs no test change. `tests/e2e/projects.spec.ts` (7:
      Hero "View Projects" and nav "Projects" → `#projects` in view; Tab from "View full resume" through every
      section link with a focus ring, count from `projectsSection(getProjects(), <existing page files>)`;
      375/1280 × dark/light no horizontal scroll, every card and practice link inside the viewport).
      Break-on-purpose: showing stars at 0 failed the stars test; restored.

- [x] **2.9 Contact section (launch-level: no form yet)** — Email assembled client-side with Copy button (Astro component + small script), LinkedIn card, GitHub link.
  - Files: `src/components/Contact.astro`, `src/components/CopyEmail.astro` (was `islands/CopyEmail.tsx`, see below).
  - Verify: Email never appears as plain text in built HTML; Copy button shows "Copied ✓"; works via keyboard.
  - Note (from 2.4): get the address only from `getEmailParts()` (`src/lib/resume.ts`). The `mailto:` link
    must be assembled in the browser too: a `mailto:user@domain` href in the HTML fails `no-email-in-dist`.
  - Note (from 2.5): add the **email icon to the Hero** here (design-doc §5.1 lists GitHub / LinkedIn /
    Email), next to the profile icons in `src/components/Hero.astro`, with its `mailto:` href assembled in
    the browser like the rest of the email. The Hero has no script today, so keep the added JS tiny.
  - Depends on: 2.2.
  - Done (2026-11-03). Notes / deviations:
    - **Astro component, not a React island** (per `.claude/rules/ui.md` since 2.3): `CopyEmail.astro` with a
      small script. React would add ~45-60KB for one button. Homepage JS 0.56 → 1.24 KB gzipped.
    - Files: new `src/components/Contact.astro`, `CopyEmail.astro`, `EmailLink.astro`, `LinkedInIcon.astro`
      (the LinkedIn SVG, moved out of `Hero.astro`), `MailIcon.astro`; new `src/lib/email-client.ts` (pure:
      `joinEmail`, `mailtoHref`, `readEmailParts`, `copyText`, `COPY_FEEDBACK_MS`) and `src/lib/contact.ts`
      (`contactContent`: LinkedIn + GitHub URLs from `basics.profiles`, a missing one fails the build);
      `Hero.astro` (email icon), `index.astro` (Contact after Skills, swatches still below).
    - **How the email reaches the browser:** `getEmailParts()` → `data-email-user` / `data-email-domain` as two
      separate attributes on each email element. The script (no address in it) joins them, sets the
      `mailto:` href (none in the HTML) and the shown address, then removes `hidden` from each
      `[data-email-reveal]` container. `no-email-in-dist` still passes.
    - **One script for the page, in `CopyEmail.astro`:** Astro renders a component's script where the component
      is first used, and the Hero must stay script-free (`tests/hero.test.ts`), so the script renders inside
      Contact and wires every email element on the page, including the Hero icon. A page that uses `EmailLink`
      must also render `CopyEmail` (2.11 does); without it the link just stays hidden.
    - **No JS:** the email row and the Hero icon stay `hidden` (not shown, not focusable); the Email card shows a
      `<noscript>` line pointing to LinkedIn. **Clipboard fails** (no API / denied): the address is selected and
      a muted hint says "press Ctrl+C (⌘C on Mac)", also announced; the label stays "Copy".
    - Copy: `<button type="button">`, the section's one accent fill, name "Copy email address". "Copy" and
      "Copied ✓" share one grid cell (no width change), swapped instantly for 2s (no animation). A
      `role="status" aria-live="polite"` region announces "Email address copied".
    - Layout (§8.2): `<section id="contact" aria-labelledby>` + `<h2>` "Let's talk" + "Open to backend and
      distributed systems roles." (user decision: "I usually reply within a day." dropped, design-doc §8.2
      updated). Two equal cards (1 column, 2 from `sm:`): Email (address, Copy, "Open in mail app" with the mail
      icon) and LinkedIn ("View my LinkedIn profile" with the LinkedIn icon); then "Code and projects on
      GitHub" (GitHub icon). 720px, same-tab links. Link markers: ui.md gained a line for LinkedIn and mailto.
    - Hero: email icon last in the profile row (`aria-label="Email"`, same 40px hit area), so revealing it
      shifts nothing.
    - Docs: ui.md (link markers, interactivity line), design-doc §8.2/§8.3/§14, this file (2.11 and "Decisions
      locked in": `CopyEmail` component, not island).
    - Tests: `tests/email-client.test.ts` (10, made-up addresses), `tests/contact.test.ts` (15: helper; built
      HTML: id/`<h2>`, intro, order, parts as separate attributes equal to `getEmailParts()` (true/false only),
      no `mailto:` href in any built file, no href on email links, hidden row, Copy is the only accent-filled
      `<button>`, live region, profile hrefs/icons/no `target`, LinkedIn path in one src file, `<noscript>`,
      one `<h1>`), a Hero email-icon test in `tests/hero.test.ts`, the page GitHub-icon count in
      `tests/projects-section.test.ts` (+1 for Contact). `npm test`: 269. E2E `tests/e2e/contact.spec.ts` (11:
      nav → `#contact`, mailto links + address after load, click Copy → clipboard + "Copied ✓" gone after 2s
      (`page.clock`), Tab + Enter/Space, clipboard denied, no clipboard API, JS off (fallback, no email Tab
      stop), 375/1280 × dark/light layout); Hero and Experience Tab-order tests now include the email icon;
      a `contact-copied` review screenshot. `npm run test:e2e`: 54.

- [x] **2.10 Footer + homepage assembly** — Wire Hero/Experience/Projects/Skills/Contact/Footer into `index.astro`.
  - Files: `src/pages/index.astro`, `src/components/Footer.astro`, `ArrowUpRightIcon.astro`, `ArrowUpIcon.astro`,
    `src/layouts/BaseLayout.astro`, `src/styles/global.css`, the section components, `MailIcon.astro`.
  - Note (from 2.1): the swatch content is gone; `index.astro` is the real homepage.
  - Closed (from 2.3), nav at 375px: no change, no hamburger. No links were added and it fits on one line.
  - Closed (from 2.7), long page: a "Back to top" link in the footer, zero JS, and no sticky header or floating
    button. It targets `<div id="top" tabindex="-1">`, the first child of `<body>`, so it also moves keyboard
    focus (the next Tab reaches the skip link). In-page links scroll smoothly only under
    `prefers-reduced-motion: no-preference`.
  - Visual polish (from 2.5/2.6), done:
    - Hero profile list `-ml-2.5`: the icons line up with the text, and the hit area stays 40px.
    - Experience at 375px: `pl-4`, card `p-4`, dot offset to match (16px more text width); unchanged from `sm:`.
    - One section gap, `--section-gap` in `global.css`: 64px, 96px from `sm:` (was a doubled 128px). Sections pad
      only their top, Contact also its bottom before the footer. The Hero keeps its top padding (80/112px).
  - Closed (from 2.8), width: one 720px column for every section, including Projects. "More projects" is one column
    at every width, each card spanning the column like the featured card. The 2-column grid was tried first and
    dropped after the screenshots: cards were about 330px wide, so descriptions wrapped into tall cards (Cryptography
    Modules almost 500px), and 3 cards left an empty cell. ui.md updated. All project cards now use the same padding (`p-5`, dropping the featured card's `sm:p-6`), so their text lines up.
  - Deviations from the original task text:
    - The nav moved into the 720px column too, so its right edge lines up at 1280px.
    - ui.md now states that site chrome links are muted, and links inside content use accent.
    - `↗` became the shared `ArrowUpRightIcon` (it can render as a colored emoji on phones), and Back to top uses
      `ArrowUpIcon`; → stays text. A test keeps `↗` and `↑` out of link text.
    - Footer contents replace design-doc §5.1's ("Built with Astro" and the source link are dropped).
    - `Hero.astro` lost `overflow-hidden`: with no bottom padding it would clip the icons' focus ring.
    - `Contact.astro` reserves the email row's height (`min-h-20 sm:min-h-33`): without it, revealing the row
      pushed everything below it down by 80px at 375px and 132px at 1280px.
    - Hero background is now two independent layers, with nothing under the text. Each is one class on the Hero's
      `<section>` (remove it to turn the layer off):
      - `hero-dots`: `--hero-dot` (`--text-muted` at 35%, about 1.7:1 on `--bg`, 2px radius, 24px spacing), masked
        transparent across the 720px column, so dots show only in the margins and not at all at 720px or less.
      - `hero-glow`: `--hero-glow` (`--accent` at 10% via `color-mix()`), a soft radial gradient behind the heading, in
        dark only; light sets it to `transparent`. Light was tried at 3.5%, the most the accent role line allows (4.52:1,
        from 4.73:1 on `--bg`), but it was barely visible, showed a faint gray ellipse edge, and left the role line right
        at the limit. So at 375px, where no dots show, the light Hero is plain `--bg`.
    - What was tried first: dots under the text at 1px, 1.5px and 2px radius. A dot strong enough to see drops the
      text below AA (light accent is 3.59:1 even at 20%), so the role and tagline needed a solid `--bg`, and that
      cut the dots into a dashed line under the text. Moving the dots off the text removed the whole trade-off.
  - Tests: new `tests/homepage.test.ts` (10) and `tests/e2e/homepage.spec.ts` (39); `tests/projects-section.test.ts`
    updated (footer GitHub icon, arrow icons); Hero layer checks added to `tests/design-tokens.test.ts` and
    `tests/hero.test.ts`. `npm test`: 288. `npm run test:e2e`: 93.
  - Left open:
    - Design-doc §4 still lists GitHub/LinkedIn icons in the top nav, and §6 still says "Live demo ↗".
    - The arrow icons still need a look on a real phone, and `#top` focus a look in Safari/Firefox (e2e is Chromium only).
  - Depends on: 2.5–2.9.

- [x] **2.11 `/resume` page** — Full resume in site styling, Download PDF button at top, print stylesheet. Reuses the same `CopyEmail` component (`src/components/CopyEmail.astro`) as Contact (2.9) for the email — never plain text.
  - Files: `src/pages/resume.astro`.
  - Verify: Ctrl+P produces a clean printed page; phone never rendered; email not plain text on this page either (confirm the `CopyEmail` component is used).
  - Note (from 1.5): the Download PDF button is `<a href="/resume.pdf" download="Shahar_Asher_CV.pdf">`,
    so it downloads, while a direct link to `/resume.pdf` opens in the browser. (2.5) Use
    `RESUME_PDF_URL` / `RESUME_PDF_FILENAME` from `src/lib/resume-pdf.ts`, never retype them.
  - Note (from 2.6): the homepage Experience section's "View full resume →" links to `/resume` (404 until
    this task). Confirm it resolves once the page exists (e.g. an e2e test that follows it). Format dates
    with `src/lib/resume-dates.ts` (same output as the PDF, parity-tested), for work and education.
  - Note (from 2.7): spoken languages (`resume.languages`, e.g. Hebrew – Native) are shown here, not in
    the homepage Skills section (user decision in 2.7).
  - Depends on: 2.4, 2.2, 2.9.
  - Done (2026-11-06). Notes / deviations:
    - **Files beyond the task text:** new `src/lib/resume-page.ts` (`resumePageContent`, `displayUrl`),
      `src/components/DateRange.astro`, `ResumeSection.astro`, `ResumeEntry.astro`; changed `experience.ts`,
      `CopyEmail.astro`, `Contact.astro`, `Skills.astro`, `Experience.astro`, `BaseLayout.astro`, `global.css`.
    - **Content (user decisions):** the PDF's Projects section is included, and the order is the PDF's: header, Experience,
      Projects, Skills (Spoken Languages as the last row, `Hebrew (Native)` as in the PDF), Education. `basics.label` is
      shown although the PDF doesn't print it; `tagline` and `location` aren't shown, as in the PDF.
    - **Header and Projects, reworked after the first review (user request):**
      - One contact line, like the PDF's: address as the mailto link, an icon-only copy button (new `CopyIcon.astro`),
        LinkedIn, GitHub, with muted aria-hidden separators. It's `CopyEmail variant="compact"`, on the same script.
        Contact is unchanged.
      - "Copied" floats above the button instead of sitting beside the icon: beside it, it would push LinkedIn along
        and could wrap the line on a phone. Nothing moves when it shows.
      - Reserved space: `min-h-10` and, from `sm:`, `min-w-60` (240px), since the email shares a line with the profile
        links there. The row is 228px with the site's fonts; the first value, 228px, had no headroom and failed with a
        wider fallback font. Fixed headroom instead of `ch`: `ch` needs the address length in an inline style, which the
        CSP (2.14) would have to allow. On phones the email has its own line, so no line starts or ends with a
        separator. A test fails if a longer address outgrows the width.
      - Copy feedback (both variants): new `CheckIcon.astro` replaces `CopyIcon` for about 2 seconds, same color and
        same button size, with "Copied" text. The ✓ character is gone, and a test keeps ✓ and ✔ out of every built
        page. Contact's Copy button gained the copy icon (it had none to swap), so it's slightly wider.
      - Each project is laid out like an Experience entry, with the link where the dates are. The status uses the YAML's
        wording ("In Progress"). A non-GitHub URL would show its short URL with `ArrowUpRightIcon`, not "GitHub".
    - **Reused:** `Skills.astro` gets an optional `categories` prop. `CopyEmail` gets `variant="compact"`, so Download PDF
      is the page's one accent fill. Its `<noscript>` line moved in from `Contact.astro`. `experienceContent()` gets
      `{ highlights: 'all' }`; the homepage default is unchanged. Experience's date markup became `DateRange.astro`.
    - **Added by the user during planning:** "← Home" above the `<h1>`, the `←` as text (no emoji form, like `→`), hidden
      in print; ui.md's link-marker rule updated.
    - **`text-display`** is now "the Hero title and the `/resume` `<h1>`" (`global.css`, design-doc §9.3): at any other size
      the `<h1>` would be no larger than the `<h2>`s.
    - **Print** (`@media print` at the end of `global.css`): tokens become black/white/gray in every theme state; nav, footer,
      skip link, toggle, buttons, mail link and Home are hidden; the address stays if revealed; profile links print their URL.
      The token and chrome rules are site-wide, so the homepage prints cleaner too. The page doesn't mention the phone.
    - **Docs:** design-doc §4, §6, §7.6, §7.7 (no download button in the nav), §9.3; ui.md; github-projects.md; README.
    - Tests: new `tests/resume-page.test.ts` and `tests/e2e/resume.spec.ts`; `tests/experience.test.ts` extended. `npm test`:
      316. `npm run test:e2e`: 137. `npm run screenshots` also writes `print-preview-resume.pdf`, to check the page breaks.
    - /resume JS: 1.24 KB gzipped, the same scripts as the homepage.
  - Resolved (2026-11-06): the live site answered `/resume` with a 307 to `/resume/` (Cloudflare's default
    `auto-trailing-slash`). Now `html_handling: "drop-trailing-slash"` in `wrangler.jsonc` and `trailingSlash: 'never'`
    in `astro.config.mjs`, with `build.format` unchanged; see design-doc §13.1. `tests/trailing-slash.test.ts` checks
    both settings and that no internal href in the built HTML ends in a slash.

- [x] **2.12 404 page**
  - Files: `src/pages/404.astro`.
  - Depends on: 2.2.
  - Done (2026-11-06). Notes / deviations:
    - **Files beyond the task text:** `BaseLayout.astro` gets an optional `noindex` prop for the robots tag (only this
      page sets it); `wrangler.jsonc` sets `not_found_handling: "404-page"` (design-doc §13.1); README roadmap line.
    - **Content:** `<h1>` "Page not found", one line of text, and "← Back to home" as the page's one accent-filled
      button. No link to `/resume`: the nav's Resume link is directly above it.
    - **`text-xl` for the `<h1>`:** design-doc §9.3 keeps `text-display` for the Hero and the `/resume` `<h1>` only, and
      this page has no `<h2>` to outrank.
    - **`wrangler dev`:** `/no-such-page`, `/no/such/page`, `/no-such-page/` and `/_headers` → 404 with the page's HTML;
      `/`, `/resume`, `/resume.pdf` → 200; `/resume/` → 307 to `/resume`; `/404.html` → 307 to `/404`.
    - **Known and accepted:** `/404` itself answers 200 with this page, because asset routing maps it to `404.html`. Only
      that exact URL is affected. Nothing links to it and it's `noindex`, so no workaround was added.
    - `astro preview` also returns a real 404 for unknown paths, so the e2e status checks are genuine. For
      `/no-such-page/` it answers with Astro's own template instead (`trailingSlash: 'never'`), so only `wrangler dev`
      covers that URL.
    - The no-phone and no-email checks needed no change: `listSiteFiles` scans `dist/` recursively, and a test asserts
      `404.html` is in its list.
    - **Back to top (user request):** the footer's link only shows on pages long enough to scroll. New optional
      `backToTop` prop (default true) on `BaseLayout` and `Footer`; this page sets it to false, so `tests/homepage.test.ts`
      now requires the link on every page except this one. Design-doc §5 Footer updated.
    - Tests: new `tests/not-found-page.test.ts` and `tests/e2e/not-found.spec.ts`; `tests/e2e/resume.spec.ts` extended.
      `npm test`: 330. `npm run test:e2e`: 146.
    - 404 JS: 0.56 KB gzipped (the theme script and the toggle's script only).

- [x] **2.13 SEO, OG image, sitemap, JSON-LD** — Unique `<title>`/meta description per page, OG image, `sitemap.xml` (`@astrojs/sitemap`), `robots.txt`, `Person` JSON-LD from `resume.yaml` excluding `email`/`phone`.
  - Files: `src/layouts/BaseLayout.astro`, `public/og-image.*`, `astro.config.mjs`, `public/robots.txt`.
  - Note (from 2.5): `index.astro`'s `title`/`description` now come from `getResume()` (`name`,
    `` `${name} – ${label}.` ``) instead of hardcoded text; keep it that way for the full SEO tags. Changed in 2.13
    (user request): the title is `` `${name} – ${label}` `` and the description is `basics.tagline` (143 characters),
    so a share card (title and description under the image) doesn't repeat the name.
  - Note (from 2.12): confirm `/404` isn't in the sitemap. It answers 200 at that exact URL and is `noindex`. Keep the
    `noindex` prop working when the SEO tags are added to `BaseLayout`.
  - Open item (from 2.11): Header home link: consider the name on the left of the header as a link to /, on every
    page. It fills the empty left side at 1280px. At 375px the nav has about 6px to spare, so decide whether it's
    hidden or shortened there.
  - Depends on: 2.2, 2.4; needs action item #6.
  - Done (2026-11-08). Notes / deviations:
    - **One base URL:** `site: 'https://personal-website.shaharasher.workers.dev'` in `astro.config.mjs`. Canonical,
      og:url, og:image, the sitemap and robots.txt all come from it through `absoluteUrl()` (`src/lib/seo.ts`); a test
      fails if the host appears anywhere in `src/` or `public/`. No trailing slash except the root.
    - **Head (BaseLayout):** canonical (not on noindex pages), `og:type` website, `og:site_name`, `og:title`,
      `og:description`, `og:url` (with the canonical only), `og:image` + width/height/type/alt, `twitter:card`
      `summary_large_image`, and a `head` slot. The 404 page keeps `noindex`, and has no canonical and no og:url.
    - **Sitemap: an endpoint, not `@astrojs/sitemap`** (user-approved): `src/pages/sitemap.xml.ts` writes
      `dist/sitemap.xml` from `SITEMAP_PATHS` (`/`, `/resume`). No new dependency, and the file is `sitemap.xml` (the
      integration writes `sitemap-index.xml`). A dist test fails if a built page without noindex is missing from it,
      so 3.1/3.2 must add their pages to `SITEMAP_PATHS`.
    - **robots.txt** is an endpoint too (`src/pages/robots.txt.ts`), so the Sitemap line uses `site`: `Allow: /`, no
      Disallow.
    - **OG image:** `public/og-image.png`, committed, made by the new `npm run og` (`scripts/og/`): an HTML template
      (name, title, tagline from `heroContent()`; dark tokens from `global.css`; the Hero's dots and glow; the site's
      fonts from `dist/`) rendered with the installed Playwright (Edge locally, Chromium in CI). The script refuses
      to write if the name or title leaves the center 630×630 square (WhatsApp's crop), the tagline is over 2 lines,
      or the PNG is 300 KB or more. Result: 191 KB, tagline 2 lines. **Stale check:** a PNG `tEXt` chunk holds the
      sha256 of the template HTML (line endings normalized, no paths, so Windows and Linux agree);
      `tests/og-image.test.ts` recomputes it. Refresh: `npm run build` → `npm run og` → `npm run build`, commit.
    - **JSON-LD** (homepage only, in `<head>`): `Person` with `name`, `jobTitle`, `description` (summary), `url`,
      `sameAs` (profiles), `knowsAbout` (skills), `alumniOf` (education). No email, telephone or address, and no
      `worksFor` (it would go stale between roles). `<` is escaped. 940 bytes (600 gzipped). It's data the browser
      never runs, so the JS budget tests skip `application/ld+json`.
    - **Header home link:** the name (from `resume.yaml`) first in the nav, linking to `/`, muted chrome. Hidden below
      `sm` (640px) where the nav has no room (user decision); at 640px the whole nav fits on one row (e2e test).
      /resume keeps its link, renamed "← Back to home" to match the 404 page, because phones have no other one.
    - The no-phone and no-email checks needed no change: `listSiteFiles` already scans `.xml` and `.txt`, and the
      JSON-LD is inside `index.html`.
    - **noindex:** the site-wide `X-Robots-Tag: noindex` in `public/_headers` stays until the custom domain (see 4.2).
    - Tests: new `tests/seo.test.ts`, `tests/seo-dist.test.ts`, `tests/og-image.test.ts`, `tests/e2e/seo.spec.ts`;
      updated base-layout, resume-page, theme-toggle, not-found-page, and the e2e base-layout, resume and theme-toggle
      specs (the Tab order now has the home link). `review-screenshots.ts` adds header clips (375/640/1280) and the OG
      image at full size, 500px and as a square. `npm test`: 364. `npm run test:e2e`: 185.
    - JS unchanged: homepage 1.24 KB gzipped, /resume 1.24 KB, 404 0.56 KB.

- [x] **2.13a Site icon (favicon)**: the initials in JetBrains Mono, in the dark accent on the dark background, in a
  rounded square. Added before 2.14 (user request): without it every browser asked for `/favicon.ico` and got the
  404 page.
  - Files: `public/favicon.ico`, `public/apple-touch-icon.png`, `scripts/og/` (new `icon-html.ts`, `ico.ts`,
    `render-icons.ts`, `fonts.ts`), `src/lib/seo.ts` (`SITE_ICONS`, `iconSizesAttr`), `src/layouts/BaseLayout.astro`,
    `package.json`.
  - Depends on: 2.13 (the OG flow).
  - Done (2026-11-11). Notes / deviations:
    - **The initials come from `basics.name`** (`initialsOf`: the first letters of the first and last words), never
      typed. One version for both themes (`--accent` on `--bg` from the dark block).
    - **PNG/ICO only, no SVG** (approved in the plan). An SVG can't load the site's fonts, and outlining the glyphs
      would need a woff2 parser (a new dependency or a lot of code). The ICO holds the PNGs directly (no
      dependency): 16, 32 and 48 px, rounded with transparent corners. `apple-touch-icon.png` is 180×180, a full
      opaque square (iOS rounds it itself). It stays Playwright's PNG as it is: what iOS needs is no transparent
      pixels, not a missing alpha channel (user correction), and an e2e test draws it on a canvas and checks every
      alpha is 255.
    - **`npm run og` extended, not renamed**: it now runs `render-og-image.ts` and then `render-icons.ts`. A rename
      would have moved `scripts/og/`. The refresh is the same: `npm run build` → `npm run og` → `npm run build`. The
      shared font loading moved to `scripts/og/fonts.ts`, and `og-image.png` came out byte-identical.
    - Each size is rendered at its real pixel size (glyphs hinted for it), with `--disable-lcd-text` (LCD
      antialiasing left colored fringes). At 16px, JetBrains Mono 400 was thin and dim in the 8× review, so that
      size gets `-webkit-text-stroke: 0.4px` in the accent. The script refuses to write if JetBrains Mono didn't load
      or the initials leave the padding.
    - **Stale check:** every PNG (each ICO entry and the apple icon) carries `icon-source-sha256`, the hash of all
      the size templates (LF-normalized), checked by `tests/site-icons.test.ts`.
    - `<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">` and
      `<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">` on every page (BaseLayout).
    - `wrangler dev`: `/favicon.ico` 200 `image/vnd.microsoft.icon`, `/apple-touch-icon.png` 200 `image/png`, so no
      `_headers` change. Sizes: `favicon.ico` 3,755 bytes, `apple-touch-icon.png` 4,260 bytes.
    - Tests: new `tests/site-icons.test.ts` (12). `tests/seo-dist.test.ts` +3 (the links and sizes on every page, and
      dist equals public). `tests/e2e/seo.spec.ts` +6 (200 with an image type, no failed icon request on `/`,
      `/resume` and `/no-such-page`, the apple icon is opaque). `review-screenshots.ts` writes `screenshots/icons.png`
      (1× and 8× on light and dark strips). `npm test`: 380. `npm run test:e2e`: 191.

- [x] **2.13b Skills as a card**: the homepage Skills section restyled to match the rest of the page. Added before
  2.14 (user request): Experience, Projects and Contact all use cards, and Skills was the only section without one
  and the only one with its labels in a side column.
  - Files: new `src/components/TechChip.astro`; `src/components/Skills.astro`, `src/components/ProjectCard.astro`,
    `src/pages/resume.astro`; tests (`tests/skills.test.ts`, `tests/resume-page.test.ts`,
    `tests/e2e/skills.spec.ts`, `tests/e2e/review-screenshots.ts`); design-doc §5.1 and §9.4, `.claude/rules/ui.md`.
  - Done (2026-11-11). Notes / deviations:
    - **Homepage:** one card with the Experience card's classes; each category's name (muted `text-sm`) above its
      chips at every width. The chips are the shared `TechChip`, the project card's outlined language chip.
      Outlined = a technology everywhere; filled = a repo topic.
    - **`TechChip`** holds the language chip's exact classes. `[overflow-wrap:anywhere]` stays on the container
      (the project card, the Skills card), as before, so a long item wraps inside its chip. A bare flag
      (`data-skill`) would render as `data-skill="true"` through the spread, so the component passes it as an empty
      string and the markup stays `<li data-skill …>`.
    - **`/resume` unchanged:** `Skills layout="columns"` keeps the old markup. Built before and after and diffed
      `dist/resume/index.html` (with the CSS bundle hash normalized): identical. The homepage outside Skills
      (including every project card) is identical too.
    - The real items all fit on one line at 375px in `text-xs`, so the e2e wrap test makes the longest item (and
      one 80-character word) longer than the card.
    - Tests: `tests/skills.test.ts` +3 (one card with the Experience card's classes; every category and item inside
      it, stacked; skill chips and language chips share one class list), `tests/resume-page.test.ts` +1 (/resume
      keeps its layout and chips). `tests/e2e/skills.spec.ts` now covers / and /resume at 375, 640 and 1280px in both
      themes, plus the long-item wrap. `review-screenshots.ts` writes `*-skills.png` and `*-resume-skills.png`.
      `npm test`: 384. `npm run test:e2e`: 200.

- [x] **2.14 Security headers** — Real CSP, `X-Content-Type-Options`, `Referrer-Policy` in `public/_headers`.
  - Files: `public/_headers`.
  - Verify: Headers present in a deployed response; CSP doesn't break islands or fonts.
  - Depends on: 1.5.
  - Note (from 2.12): the CSP must also cover `404.html`, and the check should include a 404 response, not only 200s.
  - Note (from 2.2): every page has the **inline no-flash theme script** (`themeInitScript` in
    `src/lib/theme.ts`, inlined by BaseLayout), so `script-src` needs its `'sha256-…'` hash, computed
    from the script text exactly as it appears in the built HTML (a test can recompute it from
    `themeInitScript`, so changing the script or the constants without updating the CSP fails). Astro's `<Font />` also emits **inline `<style>`** blocks (`@font-face`)
    → `style-src` needs their hashes or `'unsafe-inline'`; same for any small CSS Astro inlines. Fonts
    are self-hosted, so `font-src 'self'` is enough.
  - Note (from 2.3): Astro **inlines** the theme toggle's processed script into the HTML as
    `<script type="module">…</script>` (it's below Vite's 4KB inline limit), not as a `/_astro/*.js`
    file. So `script-src` needs a hash for it too, and that hash changes with every edit to
    `ThemeToggle.astro`'s script or `src/lib/theme.ts`. Options: compute the hashes from `dist/` at
    build time, or set `vite.build.assetsInlineLimit: 0` (or similar) so the script is an external
    file covered by `'self'`. Pick one here.
  - Note (from 2.13): the homepage's JSON-LD (`<script type="application/ld+json">`) needs nothing in the CSP: it's a
    data block the browser never runs, so `script-src` doesn't apply to it. No hash and no `'unsafe-inline'` for it.
    `sitemap.xml`, `robots.txt` and `og-image.png` are plain static files.
  - Note (from 2.13a): `favicon.ico` and `apple-touch-icon.png` are plain same-origin static files too:
    `img-src 'self'` covers them.
  - **Done.** Design-doc §12 (new CSP and headers subsections) has the policy and the reasoning.
    - **Approach: hash `dist/` after the build** (option b). A small Astro integration, `cspHeaders()` in
      `scripts/csp/csp.mts` (registered in `astro.config.mjs`), runs in `astro:build:done`. It hashes every inline
      `<script>` (except JSON-LD) and `<style>` on every built page, and writes one site-wide policy under `/*` into
      `dist/_headers`. Rejected alternatives:
      - Astro's own `security.csp` only writes a `<meta>` tag on a static site. A meta tag can't carry
        `frame-ancestors`, doesn't apply to the no-flash script above it, and doesn't hash `is:inline`.
      - External scripts (`assetsInlineLimit: 0`) cost render-path requests and still leave the theme script and
        `<Font />` CSS inline.
    - `.mts`, not `.ts`, because the config loads it without the npm scripts' `--disable-warning` flag (package.json
      has no `"type"`). As a `.mts` file it builds with no warning.
    - **Fail-closed template:** `public/_headers` has `Content-Security-Policy: default-src 'none'`, which the
      integration replaces. If the step doesn't run, the site breaks visibly instead of shipping without a CSP.
    - **The build fails** on any of these:
      - the template line is missing or repeated;
      - a `style=` attribute, an `on*=` handler, or a `javascript:` value in `href`/`src`/`action`/`formaction`;
      - a `dist/_headers` line over 2,000 characters (it names the line and its length);
      - more than 100 rules.
    - **Found in the built HTML:**
      - Inline scripts:
        - on every page, the theme script and the ThemeToggle module;
        - on `/` and `/resume`, also the CopyEmail module.
      - Inline styles:
        - on every page, two `<Font />` blocks;
        - on `/` and `/resume`, also CopyEmail's `<style>`.
      - Totals: 3 script hashes and 4 style hashes.
      - No `style=`, inline handlers or `javascript:` URLs, so nothing needed an exception.
      - The CSP line is 593 of 2,000 characters.
    - **Policy:** `default-src 'self'; script-src 'self' <3 hashes>; style-src 'self' <4 hashes>; img-src 'self';
      font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none';
      frame-ancestors 'none'`.
      - `upgrade-insecure-requests` is dropped: every URL is relative, and it would break testing on `http://127.0.0.1`.
      - No `report-to`: the site is static and has nowhere to receive reports.
    - **Other headers on `/*`:**
      - `Permissions-Policy` denies 11 unused features; the clipboard stays allowed.
        - Follow-up fix: `browsing-topics` was removed. The Topics API was retired and current Chrome/Edge logged
          "Unrecognized feature: 'browsing-topics'" on every live page. The local Edge (157) still knew the name, so
          the e2e suite never saw it. The csp.spec.ts watcher now also reads the browser's own log entries (CDP `Log`)
          and fails on any header error. A new test proves it catches an unknown feature name.
      - `Cross-Origin-Opener-Policy: same-origin`.
      - `X-Frame-Options: DENY`, for old browsers.
      - `Strict-Transport-Security: max-age=31536000`, without `includeSubDomains` or `preload` (see 4.2).
      - `nosniff`, `Referrer-Policy` and `X-Robots-Tag` are kept.
    - **Cloudflare injection:** none on the live workers.dev site (checked with curl): no Web Analytics beacon, no
      email-decode, no Rocket Loader.
    - **E2E now runs on `wrangler dev`** (playwright.config.ts, `127.0.0.1:4322`), not `astro preview`, which ignores
      `_headers`. So every e2e test and every screenshot runs with the real headers, `not_found_handling` and
      `html_handling`. I chose it over injecting headers with page.route, which would only test my own copy of
      Cloudflare's rules. The real CSP immediately caught two existing tests doing things the policy blocks, which
      `astro preview` had hidden. Both are fixed in the tests, not the policy:
      - `homepage.spec.ts` decoded a screenshot from a `data:` image, which `img-src 'self'` blocks. It now uses
        `createImageBitmap(blob)`, which fetches nothing.
      - `resume.spec.ts` used `page.addStyleTag` (an inline style). It now uses a constructed stylesheet
        (`adoptedStyleSheets`), and asserts that it applied.
      - Lesson for later tests: on site pages, don't inject inline `<style>`/`<script>` or load `data:` images.
    - Manual check with `wrangler dev` in Chrome: `/`, `/resume`, the 404, the theme toggle and Copy all showed no CSP
      console messages. `/resume.pdf` opens in the built-in PDF viewer with the CSP on it, so it needs no exception.
    - Tests:
      - `tests/csp.test.ts` (26):
        - unit tests on fixtures (hashing against the CSP spec's own example, extraction, finding unhashable markup,
          applying the template, parsing `_headers`, both limits, the build failing);
        - over `dist/`: every inline block on every page (404 included) is hashed in the CSP, the theme hash is
          recomputed from `themeInitScript`, every security header is on `/*` and no other rule overrides or removes
          one, and the file is within the limits.
      - `tests/e2e/csp.spec.ts` (7): on `/`, `/resume` and `/no-such-page` with both saved themes:
        - the CSP header is present, with no violation events and no CSP console messages;
        - the saved theme is applied before `<body>`; the toggle, Copy and every font file work.
      - The same spec has one test with an inline script and a `style=` attribute injected into the HTML: both are
        blocked.
      - Removing one hash from `dist/_headers` by hand failed 3 node tests and all 7 e2e tests.
      - `npm test`: 410 (was 384). `npm run test:e2e`: 207 (was 200). `npm run screenshots`: 45.

- [x] **2.15 Cloudflare Web Analytics** — Beacon script in `BaseLayout`.
  - Files: `src/layouts/BaseLayout.astro`.
  - Depends on: action item #5.
  - Note (from 2.14): the CSP blocks the beacon until `buildPolicy()` in `scripts/csp/csp.mts` adds
    `https://static.cloudflareinsights.com` to `script-src` and `https://cloudflareinsights.com` to `connect-src`. Prefer
    the manual snippet over dashboard auto-injection, so it's in the built HTML and the tests see it. If the snippet
    has inline JSON config (`data-cf-beacon` is an attribute, fine), check `tests/e2e/csp.spec.ts` still passes.
  - **Done.** Design-doc §15 (wiring, no consent banner, budget) and §12 (the policy) have the reasoning.
    - **The tag:** the dashboard's manual snippet, last before `</body>` in `BaseLayout`, so it's on every page,
      the 404 included: `<script is:inline type="module" src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon='{"token":"…"}'>`.
      - `type="module"`, not `defer` (user decision): it's the dashboard's current form, and module scripts are
        deferred anyway.
      - The beacon reads its config from `document.currentScript`, falling back to `[data-cf-beacon]`. The CDN sends
        `Access-Control-Allow-Origin: *`, so the module's CORS fetch works.
    - **Gate:** `analyticsBeacon(import.meta.env.PROD)` in `src/lib/analytics.ts` returns `null` in the dev server.
      The token is a constant there: it's public, in every page's source.
    - **CSP:** `buildPolicy()` adds two sources and nothing else.
      - `script-src` gets the beacon's full path, `https://static.cloudflareinsights.com/beacon.min.js`. That is
        Cloudflare's FAQ form and stricter than the bare host (user decision). It returns 200 with no redirect, so
        the path matches.
      - `connect-src` gets `https://cloudflareinsights.com` (reports go to `/cdn-cgi/rum`).
      - `data-cf-beacon` is an attribute on a `src` script: no hash.
      - The CSP line is 676 of 2,000 characters (was 593).
      - The URL is repeated in `csp.mts`, which can't import project `.ts`; a test keeps the two equal.
    - **No analytics from tests:**
      - Every e2e spec and `review-screenshots.ts` take `test` from `tests/e2e/fixtures.ts`. Its `page` stops every
        request to `*.cloudflareinsights.com` with CDP request interception limited to those URL patterns.
      - `tests/e2e-fixtures.test.ts` fails on a spec that imports Playwright's own `test` or opens another
        page or context.
      - Two other approaches were tried and dropped:
        - `context.route`: any Playwright route made Chromium fail the page's own `fetch('/favicon.ico')`, which
          broke 3 tests in `seo.spec.ts`.
        - `Network.setBlockedURLs`: it blocks before the CSP check, so it couldn't show the CSP allowed the beacon.
          Found by removing the beacon from `dist/_headers` by hand: the tests still passed.
      - Interception runs after the CSP check. So `analyticsRequests` listing the beacon proves the CSP allowed it.
        A control test serves `/` with the beacon removed from the CSP and expects a violation and no request.
      - One e2e run during development, with the block switched off to isolate the favicon problem, let the real
        beacon load once from `127.0.0.1`. That run most likely wasn't counted (hostname mismatch).
    - **JS budget: the beacon counts.** It's JS every visitor downloads.
      - Measured 10,274 bytes gzipped (31,853 raw) on 2026-11-13. The tests count it as 11KB
        (`tests/helpers/page-js.ts`), since Cloudflare doesn't version-pin it.
      - Any other external script fails the budget tests until it's budgeted.
      - Homepage: 12.24KB (1.24KB site + 11KB beacon); `/resume` 12.24KB; 404 11.56KB.
      - The three budget tests now share the helper (before, they'd have crashed reading an `https://` src from
        `dist/`).
    - **Local runs:** `npm run dev` has no beacon. `npm run preview` / `npx wrangler dev` serve the production build,
      so a manual browser visit loads it. Its report from `127.0.0.1` most likely fails Cloudflare's hostname check
      (FAQ: suffix match, CORS error) and isn't counted. Unverified.
    - **Privacy:** no cookies, no localStorage and no fingerprinting (Cloudflare's docs, and a grep of
      `beacon.min.js`), so no consent banner (design-doc §15).
    - Tests:
      - `tests/analytics.test.ts` (9): the gate, the token format, BaseLayout using the gate, and the URL matching
        the CSP's. On every built page: one beacon tag (module type, URL, decoded token), last before `</body>`.
      - `tests/csp.test.ts` (+1): `script-src` is `'self'`, the beacon path and hashes only; `connect-src` is
        exactly `'self' https://cloudflareinsights.com`; every other directive is unchanged.
      - `tests/e2e-fixtures.test.ts` (16): the import guard per spec, and the blocked patterns.
      - `tests/e2e/analytics.spec.ts` (5):
        - on `/`, `/resume` and `/no-such-page`: the tag, the request stopped by the test after the CSP allowed it,
          no violations, no header console errors;
        - a POST to `/cdn-cgi/rum` allowed by `connect-src` and stopped by the test;
        - the control.
      - Removing the beacon from `dist/_headers` by hand failed all 5.
      - `npm test`: 436 (was 410). `npm run test:e2e`: 213 (was 207). `npm run screenshots`: 45, unchanged (the
        beacon has no visible part).

- [x] **2.16 MVP deploy + visual verification** — Full homepage + `/resume` live on the Cloudflare free URL.
  - Verify: Playwright screenshots at 375px/1280px, dark/light, reviewed; Lighthouse spot-check; `npm run check` and `npm run build` both green.
  - Note (from 2.13): the site-wide `X-Robots-Tag: noindex` stays on the workers.dev URL, so Google doesn't index it
    as a duplicate of the future domain. It's removed at the domain switch (4.2), not here. Lighthouse's SEO score
    will flag it; that's expected.
  - Depends on: everything above in Milestone 2.
  - Done (2026-11-13). A closing task: nothing new was built except the live smoke run. Notes / deviations:
    - **Live smoke run** (`npm run test:live`; `npm run screenshots:live` for screenshots):
      - New `playwright.live.config.ts`. It is `playwright.config.ts` with the base URL set to astro's `site`, and no
        local server. Its own output folders are `test-results/live` and `playwright-report/live`.
      - It reuses 6 specs unchanged: `csp`, `analytics`, `seo`, `not-found`, `hero` and `resume`. All are read-only,
        and the fixture blocks analytics as in every run.
      - No env vars, so it works in cmd. `tests/e2e-fixtures.test.ts` (+1) checks the config: no webServer, the base
        URL equals `site`, and every spec it runs is a guarded file.
    - **New header checks in `csp.spec.ts`** (+4). They run locally under `wrangler dev` and live:
      - On `/`, `/resume` and the 404, every header of the `/*` rule in `public/_headers` is sent with its exact value
        (CSP excepted, which keeps its own regex). The rule is parsed with `parseHeaders()`.
      - `/resume.pdf` is `application/pdf` with its rule's `Content-Disposition`.
      - Before this, the headers were checked only in `dist/_headers` and under `wrangler dev`. A deployed response
        is now checked too, which closes 2.14's "headers present in a deployed response".
    - **Live result:** 120/120 passed against the workers.dev URL on 2026-11-13, at commit b2a8aff (deploy run
      43402181154: every step green, including Playwright e2e, which closes 2.3a's "verify after push").
    - **Screenshots:** `review-screenshots.ts` now takes full-page shots at 375, 640 and 1280px (was 375 and 1280).
      - Count: 57 (was 45).
      - Live vs local: all 77 PNGs from `npm run screenshots:live` are byte-identical to the local build's, so the live
        site is this build.
      - Reviewed `/`, `/resume` and the 404 at all three widths in both themes, plus the print preview. Nothing wrong
        found. The print preview is 2 A4 pages, breaking cleanly before Projects, with the link URLs printed.
      - One local screenshot run had one failure (`375px light › page`, the first test). Two reruns passed 57/57. The
        error wasn't captured; most likely a cold `wrangler dev` start. Recheck if it happens again.
    - **Open Milestone 2 items, all assigned:**
      - Closed:
        - 2.3a: the CI e2e step was verified, as above.
        - 2.14: headers in a deployed response, as above.
        - 2.11: Ctrl+P (print preview reviewed; a real Ctrl+P is on the user's list below).
        - 2.6→2.11: `resume.spec.ts` follows "View full resume".
        - 2.12→2.13: `/404` is not in the sitemap (`SITEMAP_PATHS`).
        - 2.10: the design-doc §4/§6 mismatch (fixed in 2.11).
        - Action #11's first half: `ci/deploy` no longer exists on the remote.
      - Moved:
        - 2.13 "new pages join `SITEMAP_PATHS`" → a note in 3.1 and 3.2.
        - LinkedIn card → 4.2 (Post Inspector can't reach workers.dev).
        - Zone Analytics next to Web Analytics → 4.2.
        - Lighthouse CI → the new optional 4.2a.
        - Action #14 → stays at 4.2 (its "before 2.16" clause reworded).
      - User checks by hand, now; anything found goes to 4.3:
        - Lighthouse (PageSpeed Insights) on the three pages.
        - Real-phone arrows, Copy, Download and theme.
        - `#top` focus in Safari/Firefox (from 2.10).
        - A real Ctrl+P.
        - The Web Analytics dashboard: whether a `127.0.0.1` visit was ever counted (2.15's "unverified").
      - Unchanged, already in later tasks: HSTS, noindex, zone injection, the workers.dev redirect (4.2/4.3); mdx,
        case studies, `form-action`/Turnstile (3.1–3.3); actions #12 and #13 (user, before/after going public).
    - **Pre-public audit (read-only):** run once from a scratchpad script, using the existing matchers. Nothing was
      changed, and no value was printed.
      - Of 37 commits, 23 (2026-10-17 to 2026-11-01) have the personal address as author/committer. That's from
        before the noreply switch; one of them is also committed by GitHub's own web-flow address.
      - The address is also in the history of `src/data/resume.yaml` (by design: it's the PDF's source) and in an
        old version of `docs/design-doc.md` (not in the current one).
      - The phone is in no commit.
      - No secret was found: no token patterns or private keys, and `.env` was never committed.
      - Decision for action #13: the user's.
    - **README:** what the MVP contains, `test:live`/`screenshots:live` (Scripts and Testing), screenshot widths.
    - **Fix from the user's Lighthouse run:** /resume failed "Identical links have the same purpose". The
      project's "GitHub" link went to the repo, and the profile's "GitHub" links went to the profile.
      - The fix: the project link now has `aria-label="<project> on GitHub"`, the same as the homepage cards
        (`ResumeProjectLink.label` in `src/lib/resume-page.ts`). The visible text and icon are unchanged, and the
        screenshots are byte-identical.
      - New `tests/link-names.test.ts` (5): on `/`, `/resume` and the 404 in `dist/`, no two links share an accessible
        name while pointing to different URLs (aria-label, else text without aria-hidden icons). Run on the old build,
        it failed /resume with exactly the Lighthouse finding.
      - `CLAUDE.md`'s Commands list adds `test:live` and `screenshots:live`.
    - Tests: `npm test` 442 (was 436). `npm run test:e2e` 217 (was 213). `npm run test:live` 120.
      `npm run screenshots` 57.

- [x] **2.17 PR workflow and protected main** — Goal: no change reaches `main` or the live site without passing
  every check.
  - CI on every pull request: `npm run build`, `npm run check` and `npm run test:e2e`, with no deploy.
    (`deploy.yml` already has a `pull_request` trigger, runs e2e, and gates the deploy step on `main` and a
    non-PR event; confirm it covers all three and that the job is usable as a required check.)
  - `main` protected:
    - no direct pushes
    - changes only through a PR
    - the PR's checks must pass
    - the branch must be up to date with `main` before merging, so what was tested is exactly what lands
  - Deploy stays as today: only from `main`, and only if CI passes again after the merge.
  - The daily scheduled build and deploy on `main` must keep working (a scheduled run isn't a push, so
    protection must not block it).
  - Optional: a Cloudflare preview URL per PR (Workers preview versions), so the change can be seen live
    before merging. Note: design-doc §13 currently says "no preview deployment at this stage"; if this part
    is done, update §13 in the same task. A PR preview must not run for fork PRs (secrets).
  - Update `CLAUDE.md`'s git rules so Claude Code proposes branch + PR commands (cmd-compatible, e.g.
    `git switch -c <branch>`, `git push -u origin <branch>`, `gh pr create ...`), never a push to `main`.
    README's contributing/deploy notes too, if they describe pushing to `main`.
  - Note for planning: check whether branch protection / rulesets work on a private repo on the GitHub Free
    plan. If they need a public repo or Pro, the workflow is prepared now and the enforcement is switched on
    when the repo goes public (action item #12).
  - Linked to action item #12, which already lists branch protection. Its current wording ("no required PRs,
    and no required status checks, since those would block direct pushes too") was written for a direct-push
    workflow; this task reverses that on purpose, and #12's wording is updated to match.
  - Depends on: 2.16. Enforcement may wait on action items #11–#12.
  - **Done (2026-11-13).** Delivered through the first branch + PR (`task/2-17-pr-workflow`), not a push
    to `main`.
    - **Free-plan finding (checked by the user):** rulesets on a private Free-plan repo are created but not
      enforced. So the ruleset is created now by the user, and enforced automatically when the repo goes
      public (#12). Until then a local pre-push hook stands in. Claude Code changes no GitHub settings.
    - **Pre-push hook:**
      - `.githooks/pre-push` (sh; blocks if node is missing) runs `scripts/git/pre-push.ts`; the pure
        logic is in `scripts/git/push-policy.ts`.
      - It refuses any update or deletion of `refs/heads/main` on any remote (also `HEAD:main`) and prints
        the branch + PR steps and the squash-merge cleanup.
      - It allows other branches, tags, deletions of other branches, and an empty push.
      - It resolves its script from its own folder, so the test runs the real hook from a temp repo.
      - It's installed by the existing `prepare` script (the whole `.githooks/` folder). The warning in
        `scripts/git/hooks.ts` now names both hooks.
    - **CI findings:**
      - `deploy.yml` already did everything needed, so there's no behavior change.
      - One job, id `build`, no `name:`, so the status check is **`build`** (confirmed on a commit's
        check-runs).
      - On `pull_request` it runs `npm run build`, `npm run check` and `npm run test:e2e` unconditionally.
      - The only deploy step is gated `github.ref == 'refs/heads/main' && github.event_name !=
        'pull_request'`.
      - Schedule and manual runs are unchanged (they aren't pushes, so neither the hook nor the ruleset
        applies).
      - Edits: a comment that the job id is the required check name, and the timeout comment's run time
        (3–5 minutes, not "about a minute").
      - Recent main/schedule runs took 3m18s to 4m51s.
    - **Ruleset (`protect-main`, created by the user):**
      - Target: the default branch.
      - Restrict deletions; block force pushes.
      - Require a PR: 0 approvals, squash only.
      - Require status check `build` (GitHub Actions), with "up to date before merging".
      - Bypass: Repository admin, "For pull requests only".
    - **Merge method: squash.** One Conventional Commit per task on `main`, as before, so the PR title
      must be a Conventional Commit. Repo settings:
      - Squash only, with the PR title and description as the default message.
      - "Always suggest updating pull request branches".
      - "Automatically delete head branches".
      - After a merge locally: `git switch main`, `git pull`, `git fetch --prune`, `git branch -D <branch>`.
        It's `-D`, since a squash merge leaves the branch's commits off `main`.
    - **Docs:**
      - `CLAUDE.md` git rules: the branch + PR flow, branch naming, the PR title rule, and the after-merge
        steps. Claude Code still never runs `git add`/`commit`/`push`.
      - README: Git hooks, and the new "Contributing and deploy flow".
      - design-doc §13.3: one line on the flow.
      - Action #12 reworded.
    - **New `tests/git-workflow.test.ts` (18):**
      - Push policy and CLI.
      - The real hook run by git against a temp bare remote: main and `HEAD:main` refused, a branch pushed
        and deleted.
      - Hook file format.
      - Every `.githooks/` file is mode 100755 in the index. It skips for a file not staged yet; strict
        in CI.
      - `prepare` installs the folder.
      - deploy.yml (js-yaml): triggers, job name, the three check steps with no `if`, and every deploy step
        gated and after e2e.
    - Tests: `npm test` 460 (was 442; 1 skipped until `.githooks/pre-push` is staged). `npm run test:e2e`
      217.

- [ ] **2.17a (optional, later) Per-PR Cloudflare preview** — a Workers preview version per PR, so a change can
  be seen live before merging.
  - Must not run for fork PRs (no secrets there).
  - Needs design-doc §13.3 updated in the same task, since it currently says "no preview deployments".
  - Depends on: 2.17.

## Fun (after MVP)

Small extras for curious visitors, added after the MVP is live (2.16) and before Milestone 3. None of them
is part of the recruiter path: the homepage, `/resume` and the PDF work exactly the same without them. Each
one is its own task (one at a time, plan first, tests + e2e + screenshots as usual). Decided on 2026-11-12.

- [x] **F.1 Console greeting** — A friendly message for people who open DevTools: an ASCII "SA", an "Open to
  work" line with a link to LinkedIn, and a line with a link to the GitHub profile (the repo is still private, so
  no repo link yet; see action item #13).
  - Decided: no red "self-XSS" warning. The site has no accounts or sessions to steal, and the audience is
    engineers, so a warning would only be noise.
  - Depends on: 2.16.
  - Done:
    - `src/lib/console-greeting.ts`: pure functions. `consoleGreeting()` builds the text from the resume's
      LinkedIn and GitHub profiles, and the build fails if either is missing. `consoleGreetingScript()` turns it
      into one `console.log` call with `%c` styling.
      - Every `<` in the script is written as the JS escape `<`, so the text can never close the
        `<script>` element.
      - No email (`getResume()` doesn't have it) and no phone.
    - **The flag:** `OPEN_TO_WORK` in `src/lib/site.ts`, a new file (no site-constants module existed; `seo.ts`
      holds only SEO constants). `false` drops only the "Open to work" line.
    - BaseLayout inlines the script last in `<body>`, behind a new `consoleGreeting` prop (default `true`).
      `/resume` passes `consoleGreeting={false}`, its only change. It runs in dev and production (no `PROD`
      gate, unlike the beacon) and logs once per page load.
    - **Colour (deviation from "green text"):** no single text colour reaches 4.5:1 on both a white and a
      #282828 console (the best possible is about 3.84:1 on each). So "Open to work" is a badge: white text on
      `#1a7f37`.
      - Text contrast: 5.08:1 in either DevTools theme.
      - The badge itself against the console background: 5.08:1 on #ffffff, 2.90:1 on #282828.
      - The `%c` style uses only `background`, `color`, `padding`, `border-radius` and `font-weight`, all
        supported by Firefox's console too.
      - The hex values live in console-greeting.ts, not global.css: the console can't read CSS variables.
    - **CSP:** the script is inline, so `cspHeaders()` hashes it. It adds one hash (the same text on `/` and the
      404 page): the CSP line went from 676 to 730/2000 characters.
    - **JS budget:** the homepage went from 12.24 to 12.47 KB gzipped.
    - The WCAG contrast helpers moved to `tests/helpers/contrast.ts`, shared by the design-token and greeting
      tests.
    - The e2e console watcher (`watchSecurityErrors`) matches CSP/header text only, so a `console.log` can't trip
      it. No change was needed.
    - The greeting spec's warning/error check goes through `unexpectedConsoleProblems()`
      (`tests/e2e/console-problems.ts`). It ignores only two "Failed to load resource" lines, matched by their
      location URL: the beacon the fixture blocks (`isBlockedUrl`, now shared with `tests/e2e-fixtures.test.ts`
      from `blocked-hosts.ts`), and on the 404 test only, the page's own URL. Any other failed request still fails
      the test. The proof is unit tests (`tests/console-problems.test.ts`) plus an e2e test where a missing
      `/_astro/` image is reported.
    - The live run (`npm run test:live`) includes `console-greeting.spec.ts`, now 7 specs. Like every live spec it
      uses the same blocking fixture (`tests/e2e/fixtures.ts`), so no analytics visit is sent.
    - Tests: `npm test` 483 (was 460). `npm run test:e2e` 221 (was 217).
      - Unit (`tests/console-greeting.test.ts`): the text in both flag states, the URLs, no email or phone, the
        contrast, the escape, and one greeting on `/` and the 404 page with none on `/resume` (dist/).
      - `tests/csp.test.ts`: the greeting's hash is in the policy.
      - e2e (`tests/e2e/console-greeting.spec.ts`): exactly one log message and no CSP violation on `/` and the
        404 page; none on `/resume`.

- [x] **F.2 CTF chain** — A chain of clues that lead from one to the next, ending in a final answer.
  - Static steps (this task):
    - 0: an HTML comment (found with View Source).
    - 1: the console greeting from F.1, with a base64 string (DevTools). Moved here from F.1: F.2 adds the base64
      string to the greeting (`src/lib/console-greeting.ts`), since the step it points to doesn't exist until
      this task.
    - 2: an `X-Clue` header on `/favicon.ico` (`curl -I` or the Network tab).
    - 3: a `tEXt` chunk in `og-image.png` (`exiftool` or `strings`).
    - 4: a file under `/.well-known/` holding ROT13 or hex (`curl`).
  - Later steps (separate tasks, once their phase exists):
    - 5: a DNS TXT record (`dig`), after the custom domain (4.1–4.2).
    - 6: a special `Accept` header answered by a Worker (`curl -H`), with the Worker phase (3.3).
  - Ending: no prize. A final message: "If you'd like to get in touch, mention the final answer."
  - Decided:
    - The CTF lives in git, in the open. The site is static, so every clue is public anyway, and reading the
      source is a valid way to solve it. Light obfuscation only: the final answer isn't written out in any
      file; the build assembles it from the clues' parts.
    - The resume is never touched: not `resume.yaml`, not `create_cv.js`, not the PDF file, not the
      `/resume.pdf` headers, not the `/resume` page.
    - No clues in hidden text on the page (that's SEO cloaking). Clues live only in HTML comments, HTTP
      headers, separate files and image metadata.
    - No fake vulnerabilities or fake admin paths. A welcoming tone ("nice, you found one", not "caught you").
    - A test per clue, so a build change or the CSP can't break the chain silently.
  - Notes for planning: the `tEXt` chunk must come from the `npm run og` generator, so the committed PNG and
    its stale check stay in sync. Check that Cloudflare static assets serve `/.well-known/` and that the HTML
    comment survives the build (Astro may strip comments).
  - Depends on: F.1.
  - Done:
    - **One source of truth:** `src/lib/ctf.mts`. `CTF_STEPS` is an ordered list of `{ part, foundAt }`, and
      `ctfClue(i)` builds every text from it. Each clue says "Part i" and "Next: <the next step's foundAt>", and the
      last one gives the assembly instructions plus the ending. The parts are `dig`, `deeper`, `than`, `the`, `dom`,
      joined with hyphens. The joined answer is never written in any file, only computed by `ctfAnswer()`.
      - `.mts` because astro.config.mjs loads it (through the integration) under plain Node, like `csp.mts`. It
        imports nothing.
      - Guards at import fail the build: printable ASCII only, one-line header value, no `--` inside the comment.
    - **Where each clue lives:**
      - 0: `<Fragment set:html={CTF_COMMENT_HTML} />` in `src/pages/index.astro`. compressHTML only collapses
        template whitespace and doesn't touch a `set:html` string. Proven by a dist test: the exact comment is in
        `dist/index.html`, and absent from `/resume` and the 404 page.
      - 1: `consoleGreeting()` takes a required `clue` line (BaseLayout passes `CTF_CONSOLE_LINE`). It's printed after
        a blank line, with `OPEN_TO_WORK` on or off. Like the rest of the greeting it's on `/` and the 404 page, never
        on `/resume`.
      - 2: `scripts/ctf/ctf-headers.mts`, a `ctfHeaders()` integration. It appends a `/favicon.ico` rule with
        `X-Clue` to `dist/_headers`, registered before `cspHeaders()` so the Cloudflare-limits check covers it. It
        fails if `public/_headers` ever gets its own `/favicon.ico` rule. `/*` still applies to the icon.
      - 3: `npm run og` writes a second `tEXt` chunk (keyword `Comment`, which exiftool shows) next to the hash.
        The pixels are byte-identical to the previous commit (the decompressed IDAT was compared). Only the metadata
        changed: 195,430 → 195,530 bytes.
      - 4: `src/pages/.well-known/ctf.txt.ts`, an endpoint like robots.txt (`text/plain; charset=utf-8`).
        - Astro routes `.well-known` (the one dot folder its router doesn't skip).
        - wrangler's asset upload ignores only `.assetsignore`, `_headers` and `_redirects`.
        - Served 200 `text/plain` under `wrangler dev`. Production is checked by the live run.
    - **Stale check:** `ogStaleProblems()` (`scripts/og/og-image-html.ts`) checks the hash and the clue chunk. A test
      on a copy of the PNG proves that an edited clue 3 (or a missing chunk) fails it.
    - **Adding step 5 (DNS TXT, after 4.2) or 6 (Worker `Accept`, after 3.3):**
      - Append one `{ part, foundAt }` entry to `CTF_STEPS`, and deliver `ctfClue(5)` there (the TXT record by hand,
        or from the Worker importing the module).
      - Clue 4 (the .well-known file, rebuilt every build) then says "Next: ..." instead of ending, and the ending
        moves to the new last step. No other clue or file changes, and the OG image doesn't need a refresh.
      - A new part also changes the answer. If that's unwanted, give the new step no part (a small change to
        `ctfClueLines`).
      - Add the new step to the solver spec.
    - Not in the sitemap, and nothing links to a clue (tested). No hidden page text. Resume files and `/resume`
      untouched.
    - **CSP:** the greeting's hash changed. The CSP line stays 730/2000 (a hash is the same length).
    - **JS budget:** the homepage went from 12.47 to 12.60 KB gzipped (the longer greeting).
    - **Tests:**
      - `npm test`: 502 (was 483).
      - `npm run test:e2e`: 223 (was 221).
      - `tests/ctf.test.ts`:
        - the exact texts, and each clue naming the next step;
        - base64 and ROT13 decoding back to the module's text;
        - guards, and adding a step moving the ending;
        - the joined parts appearing in no tracked file and no `dist/` file;
        - the dist placements, and `listSiteFiles()` covering `.well-known/`, so no-phone and no-email scan it.
      - `tests/e2e/ctf.spec.ts`: a solver that reads each next location from the clue text, using only the page
        source, the console, the headers, `strings` on the PNG bytes and the .well-known file. It ends with the
        assembled answer equal to `ctfAnswer()`. It's in LIVE_SPECS (now 8).

- [x] **F.3 404 game** — A small original character that runs and jumps (the Chrome dino is a reference for
  the feel, not for the art).
  - One button (Space or tap), instant start, gradually faster, short rounds, a high score in `localStorage`
    (try/catch, like the theme).
  - For every audience: no developer jargon.
  - Loaded only on the 404 page, small, works with keyboard and touch. Respects `prefers-reduced-motion`
    (no autostart).
  - Depends on: 2.16.
  - Done:
    - **The character:** "the lost page", a sheet of paper with a folded corner, two lines of writing and two
      legs, running home. It jumps over ink blots (low, narrow), puddles (low, wide) and staplers (tall).
      - Colors: body `--text`; fold `--text-muted`, set apart by its shape and a crease line; obstacles
        `--text-muted`; ground `--border`. No accent in the game: ui.md stays strict (accent means clickable).
    - **Where:** `src/components/LostPageGame.astro`, below Back to home on the 404 page.
      - Order: an `<h2>` "While you're here", one line, a Play button (outline) with the score line, the canvas,
        the controls line ("Press Space or tap to play and jump. Press Enter to play again."), and the game-over
        line.
      - Reading and Tab order: heading, text, Back to home, Play, the game. The page still answers 404.
      - Spacing: the 404 page's top padding is `pt-12 sm:pt-16` (was the 64/96px section gap), and the game's top
        margin is `mt-12`. At 1280×800 the whole game box is on screen (bottom about 700px). At 375×667 the box is
        too (top about 480px). The canvas keeps its size.
    - **Controls** (pure rules in `src/lib/game/controls.ts`, shared by the loader and the game): keys are heard on
      the whole document, but only with focus on the page itself (`<body>`) or the canvas, never shortcuts.
      - Space / ArrowUp: start when idle, jump when running, go on when paused, play again when over (after 400 ms).
        A press just before landing jumps on landing.
      - Enter: start when idle or over, go on when paused.
      - `preventDefault` only for keys the game handles, so Space never scrolls the page. A start from the page moves
        focus to the canvas.
      - A tap does what Space does.
      - The button says what a click does: Play / Restart / Continue / Play again. Its action is read on
        `pointerdown`, so it does what its label said when it was pressed.
    - **Pause:** only when the tab is hidden (`visibilitychange`) or the window loses focus. Focus moving within the
      page never pauses. The button then reads "Continue".
    - **Accessibility:**
      - The canvas: `role="application"`, `aria-label="Lost page game"`, `aria-describedby` = the visible controls
        line, `tabindex="0"`.
      - The score line updates only when its text changes and isn't live. The game-over line (`aria-live="polite"`)
        is written only at game over.
    - **Rules:** `src/lib/game/engine.ts`, a pure module with a seedable random (mulberry32). Imports nothing.
      - Physics: gravity 1290, jump 387 (peak about 58 units, 1.8 times the character; 0.6 s in the air).
      - Speed: 186 units/s, plus 4.3 per second, up to 371 (about 370 to 740 px/s on a 229 px tall box).
      - Gaps: always at least 0.85 s at the speed they were made; the longest gap shrinks as the speed rises.
      - Score: one point per 18 units (about 10 a second at the start).
      - Frame-rate independence: fixed 1/240 s slices, frames capped at 100 ms.
      - The first obstacle reaches a character that never jumps within `FIRST_HIT_MAX_MS` (3 s) for any seed.
      - World: 114 units tall, the character 32 (about 28% of the box). Width from the box's aspect: about 228 at 2:1
        (below `sm`), 342 at 3:1, clamped to 216–360.
      - Always jumpable: proven by an autopilot test that survives 90 s (past top speed) for 200 seeds at both
        widths.
    - **Other modules:**
      - Best score: `src/lib/game/best-score.ts`, key `lost-page-best`, storage passed as a getter like `saveTheme`.
      - Words: `src/lib/game/hud.ts`.
      - Drawing: `src/lib/game/draw.ts`, shapes only, colors read from the tokens at start and on a `data-theme`
        or OS theme change.
      - Browser glue: `src/lib/game/play.ts` (rAF with delta time, input, pause, resize). The test hooks
        `data-game-state`, `data-player-y` and `data-motion` change nothing for visitors.
    - **Loading:** the component's small script is the only game code on the 404 page. On the first Play, Space or
      tap it imports `play.ts` (its own `/_astro/` file).
      - The still picture before Play is inline SVG matching the first frame (nothing to download).
      - `/` and `/resume` have no game markup and request neither file (dist test + e2e).
    - **Reduced motion:** nothing moves before Play for anyone, and nothing flashes for anyone.
      - With `prefers-reduced-motion` the game runs once started, without the hit shake, the sliding ground dashes
        and the stepping legs (`effectsFor()`).
      - Recorded as an exception in design-doc §10.3, with a pointer in CLAUDE.md's Motion section.
    - **Deviations from the plan:**
      - The paused state shows in the button ("Continue"), not in the score line: a longer line wrapped at 375px and
        pushed the game down.
      - The world was zoomed in twice after screenshot reviews (200 → 160 → 114 units tall), so the character went
        from about 16% to 28% of the box's height. Speeds in units were scaled down with the second zoom, so the
        on-screen speed and the time to see an obstacle coming stayed the same. The jump couldn't grow the full ×1.4
        and stay inside the box: its peak went from 75 to 58 units (about ×1.08 on screen), with the same 0.6 s
        airtime.
      - A thin bar at the box's right edge was a drawing artifact, not an obstacle. The box is about 3.02:1, so a strip
        about 2 units wide past the clamped world width was never repainted and kept old frames. Now every frame paints
        the whole canvas, and the world's width follows the box (clamp 216–360).
      - Review round: page-level keys, and pause only on a hidden tab or window blur (no pause on canvas blur).
        Pausing on canvas blur broke Restart in Safari and Firefox on macOS: a clicked button isn't focused there,
        so the click found the game paused and continued.
      - With focus on the game's own button, Space and Enter press the button the normal way (its click does what
        its label says) instead of going through the game's key rules. A keyboard user on "Restart" gets a restart,
        as a button should.
    - **JS:**
      - The 404 page: 11.91 → 13.18 KB gzipped up front (beacon included). The loader is 1.27 KB, about 0.8 KB of
        it Vite's preload helper.
      - The game: 3.06 KB gzipped, loaded on Play (limit 8 KB, tested).
      - The homepage is unchanged (12.60 KB).
    - **CSP:** unchanged, 730/2000. Both files are `/_astro/` scripts (`'self'`). No inline script, no style
      attributes.
    - **Tests:**
      - `npm test`: 542 (was 502).
      - `npm run test:e2e`: 248 (was 223).
      - Unit (`tests/game-engine.test.ts`, `tests/game-best-score.test.ts`, `tests/game-controls.test.ts`):
        - jump arc and gravity, the jump buffer, collisions with the forgiving inset;
        - speed over time and its cap, score from distance;
        - the same seed giving the same obstacles, every kind showing up, minimum gaps;
        - the first-hit bound over 1,000 seeds at both widths;
        - the autopilot surviving 90 s for 200 seeds at both widths, and the jump's peak staying inside the box;
        - 60 Hz / 144 Hz / uneven frames giving the same state, the frame cap;
        - `effectsFor`, the words, `changedOnly`, and the best score with failing storage;
        - every key, tap and button action per phase, and keys heard only with focus on the page or the canvas.
      - dist (`tests/not-found-page.test.ts`):
        - the game after Back to home, the canvas's name and description;
        - an outline Play button, no accent, only the game-over line live;
        - the size limit, and no game on `/` and `/resume`.
      - e2e (`tests/e2e/game.spec.ts`):
        - 404 status and Tab order;
        - nothing moves and nothing loads before Play;
        - Play, Space and a tap start it; a jump changes the height;
        - game over within the bound, announced once, Enter restarts, best saved;
        - Restart in the Safari order (pointerdown, the canvas blurred with no relatedTarget, then click) starts a new
          round, and Continue goes on;
        - pause on a hidden tab, and no pause when the canvas loses focus;
        - Space on the page starts the game and jumps without scrolling; Enter on the page plays again after game
          over; Space on "Back to home" doesn't start it, and Enter there still follows the link;
        - the game's bottom edge on screen at 1280×800, its top edge at 375×667;
        - colors following the toggle;
        - reduced motion;
        - no console problems or CSP violations;
        - no game on `/` and `/resume`;
        - 375/1280 × light/dark with no horizontal scroll and the game inside the column.
        - In LIVE_SPECS (now 9).
      - Review screenshots: a new `*-404-game.png` (paused about a second into a round) next to `*-404.png`.
    - **Left open:** the ~0.8 KB preload helper in the loader could go with `vite.build.modulePreload: false` (a
      site-wide config change, not worth it for 0.8 KB now).

- [x] **F.4 Doodles** — On a few special days, a small doodle drawn with the Hero's dots.
  - Chosen by the daily CI build, so there is no JS on other days. Shown from a day before to a day after
    the date (time zones).
  - Days: Jan 1 New Year; Mar 14 Pi Day; Jun 23 Alan Turing's birthday; Programmers' Day (the 256th day of
    the year); Oct 31 Halloween; the site's launch date; Hanukkah.
  - Never: the owner's birthday (privacy, it reveals age) or national days.
  - Interaction (changed at planning, see Deviations): a link to the day's English Wikipedia article. Hover/focus
    shows a speech bubble explaining the day and plays a 2–3 s animation once (`transform`/`opacity` only); a click
    or Enter opens the article; on touch the first tap shows the bubble and animates, the second opens the article.
    No sound in v1 (if added later: on click only, short, quiet, `media-src 'self'`). `prefers-reduced-motion`
    shows the bubble only. The doodle never covers the Hero's name, buttons or links.
  - Includes: a note in design-doc §10 that this user-triggered animation is a deliberate exception to the
    no-particles rule.
  - Depends on: 2.16 (and the launch date, 4.2, for that day).
  - Done:
    - **The doodles** (`src/lib/doodles/doodles.ts`, pure data; the array order is the overlap priority):
      | id | Dates (±1 day) | Shape | Motion | Wikipedia |
      |---|---|---|---|---|
      | `launch` | `LAUNCH_DATE`, every year (empty → off) | rocket | lifts off, returns from below | `"Hello, World!" program` |
      | `new-year` | Jan 1 | firework | dots burst out and return | `New Year's Day` |
      | `pi-day` | Mar 14 | π | one full turn | `Pi Day` |
      | `turing` | Jun 23 | Turing-machine tape and head | the marks step one cell left, twice | `Alan Turing` |
      | `programmers-day` | the 256th day (Sep 13; Sep 12 in leap years) | `</>` | fades, types back in | `Day of the Programmer` |
      | `halloween` | Oct 31 | ghost | bobs twice, half see-through | `Halloween` |
      | `hanukkah` | 25 Kislev + 7 (8 days) | hanukkiah, 8 candles + shamash | flames flicker | `Hanukkah` |
      - **Priority:** launch, then the one-day doodles, then Hanukkah (the 8-day one still shows on its other days).
        The real overlap: New Year beats a Hanukkah that runs into January (Dec 31 – Jan 2 in 2024/25 and 2027/28).
      - **Hanukkah** from `Intl.DateTimeFormat('en-u-ca-hebrew')`, no dependency. Tested for 2021–2027.
      - **Window:** the build's UTC date in [day − 1, last day + 1] (`src/lib/doodles/dates.ts`). The schedule is
        03:17 UTC, but GitHub started the November 2026 runs around 10:30–11:40 UTC. Either way the doodle is live
        from about day − 1 to day + 2 in UTC, which covers every time zone.
      - **`LAUNCH_DATE`** in `src/lib/site.ts`, empty for now (an invalid value fails the build). Set at 4.2 (noted
        there).
      - **The doodles depend on the daily scheduled build.** If it stops (see 4.2b, GitHub's 60-day rule for public
        repos), the doodle of the last build stays up and new ones never come.
    - **Where:** `src/components/Doodle.astro`, at the right end of the Hero's profile-icon row at every width (`ml-auto`
      plus at least 24px from the icons). The bubble opens below it, right-aligned, under the Hero.
      - Dots: the Hero grid's 2px radius on a 6px pitch, `--text-muted` (the token `--hero-dot` is mixed from, at full
        strength for WCAG 1.4.11's 3:1; `--hero-dot` itself is about 1.9:1), `--text` on hover and focus. No accent.
      - Boxes 66–114px wide and 60–78px tall (the shape plus 6px padding), so the touch target is over 44×44.
      - The link: `aria-label` "<day>, read about it on Wikipedia", `aria-describedby` = the bubble text, same tab.
        The bubble ends with "Read more on Wikipedia" and `ArrowUpRightIcon` (ui.md); on touch "Tap again to read more
        on Wikipedia".
    - **Behavior:** a pure reducer (`src/lib/doodles/interaction.ts`).
      - The bubble opens on hover or focus, and the animation plays only when it opens: once, never while it's
        open, never in a loop.
      - WCAG 1.4.13: the wrapper holds the link and the bubble, with a transparent bridge between them. Esc closes it
        without moving focus.
      - Touch: the first tap arms (cancels the navigation), the second follows the link, and a tap elsewhere disarms.
      - **Reduced motion:** the shape never moves, the bubble's 150 ms fade is off, and the animation file is never
        requested. Hover, focus, the taps and the click work the same.
    - **Animation:** `src/lib/doodles/motion.ts` (keyframes, pure) and `play.ts` (Web Animations, `element.animate()`,
      which the CSP's `style-src` doesn't cover, so no style attribute).
      - 2.4 s, transform and opacity only, starting and ending in place.
      - Opacity dips at most twice a second.
      - Test hooks: `data-doodle-state`, `data-doodle-plays`.
    - **Zero cost on other days:** Hero renders the Doodle only on a doodle day.
      - Its CSS is `<style is:inline>`, not a scoped `<style>`. Deviation found by the dist test: Astro added the
        scoped style to the homepage even on a day with no doodle. The layout rules no other component uses moved
        there from Tailwind classes, so Tailwind doesn't generate them every day.
      - Vite still writes the two doodle script files to `dist/_astro/` (Hero imports the component), but no page
        references them, so nobody downloads them (tested).
    - **Preview:** `DOODLE=<id>` (or `none`) forces a doodle (`src/lib/doodles/select.ts`; an unknown id fails the
      build).
      - `npm run doodle:build -- <id>` runs `astro build` alone into `dist-doodle/`, reusing the main build's outputs:
        about 6 s locally.
      - `npm run doodle -- <id>` also serves it at http://127.0.0.1:4323.
      - `npm run screenshots:doodles` photographs every doodle, closed, with the bubble open, and four
        mid-animation frames.
      - **Visitors can never reach it:**
        - `doodleGuard()` (`scripts/doodles/doodle-guard.mts`, in astro.config.mjs) fails any build into `dist/` while
          `DOODLE` is set;
        - the deploy reads `./dist` only;
        - a test pins wrangler.jsonc, the deploy step (`npx wrangler deploy`) and no `DOODLE:` in the workflow.
    - **CI:** a new step after Build, `npm run doodle:build` (pi-day), so `npm run check` and the e2e tests have
      `dist-doodle/`. Playwright starts a second `wrangler dev --assets dist-doodle` on port 4323, never reused. CI
      time before: PR 4m07s, push 4m35s, schedule 4m19s (the F.3 runs).
    - **JS (homepage, gzipped, beacon included):**
      - Normal day: unchanged, 12.60 KB.
      - Doodle day: 13.39 KB. The loader is 0.79 KB, plus Vite's preload helper (about 0.9 KB) on this page.
      - The animation is 0.96 KB, loaded on the first interaction (limits tested: loader 2.5 KB, animation 3 KB).
    - **CSP:** a normal day's line is unchanged, 730/2000. A doodle day's build is 784/2000: one more style hash
      for the inline style.
    - **Tests:**
      - `npm test`: 583 (was 542).
      - `npm run test:e2e`: 264 (was 248).
      - Unit (`tests/doodles.test.ts`):
        - every date with its day before and after, and the UTC edges;
        - day 256 in leap and non-leap years (2100 too);
        - Hanukkah 2021–2027 with its 10-day window;
        - the overlaps;
        - the 2026 total;
        - `LAUNCH_DATE` empty, set and invalid;
        - `DOODLE` force, none and unknown;
        - the guard;
        - the URLs, labels and shapes;
        - every keyframe list;
        - the reducer for hover, focus, Esc, mouse, keyboard and touch.
      - Dist (`tests/doodles-dist.test.ts`):
        - dist/: no doodle markup, style or loaded code on any page (or only the day's doodle, on the homepage);
        - dist-doodle/: the doodle on `/` only, with its link, name, description and dots;
        - nothing unhashable, every inline block hashed;
        - the sizes;
        - deploy safety.
        - It skips without `dist-doodle/` locally and fails without it in CI.
      - e2e (`tests/e2e/doodle.spec.ts`, against dist-doodle with the real CSP, checked in the spec):
        - the link and its name;
        - nothing loads or moves before the first hover;
        - hover plays once, with no replay while on it, and staying open over the bubble;
        - Esc;
        - focus, Tab away, Enter;
        - click;
        - the Hero's name, buttons and links not overlapped and on top;
        - no console problems or CSP violations;
        - touch: first and second tap, a tap on the bubble, a tap elsewhere;
        - reduced motion, with mouse and with touch;
        - 375/1280 × light/dark: no horizontal scroll, inside the column, ≥ 44px, ≥ 24px from the icons.
        - Wikipedia is never loaded: a window click listener records whether the click was cancelled, then cancels
          it.
    - **Deviations:**
      - A link and hover-to-play, instead of a `<button>` and click-to-play (decided at planning).
      - `--text-muted` instead of `--hero-dot` for contrast (approved).
      - The inline style (above).
      - The launch doodle links to the "Hello, World!" article: there's no article for the site's own day.
    - **Left open:**
      - Not in the live run (`LIVE_SPECS`): the live site has a doodle only on doodle days.
      - The bubble's tail sits at a fixed 40px from the right, centered under the 13-column doodles and a little
        right of center under the wider hanukkiah.

- [ ] **F.5 curl easter egg** — `curl` on the site gets a plain-text resume (User-Agent / `Accept`
  negotiation).
  - Reads `resume.yaml` at build time. Never includes the phone or the email.
  - `wget` on the site root gets a minimal HTML page: the plain-text resume inside `<pre>`, with a first
    line `Full PDF: wget https://<site>/resume.pdf`. Reason: by default wget names the saved file after
    the requested URL (`index.html`), not after `Content-Disposition` or a redirect, so serving the PDF
    itself would save a PDF named `index.html`. The HTML version opens cleanly in a browser.
  - Notes: User-Agent detection (`Wget/…`) needs the Worker, like curl. Only the root path behaves
    differently; `wget -r` mirroring of the site won't work past the root (accepted for an easter egg).
    The PDF itself is never changed, and the text never includes the phone or the email.
  - Depends on: the Worker phase (3.3).

- [ ] **F.6 `/.well-known/security.txt`**
  - Note for planning: `Contact:` can't be the email in plain text (hard rule 8; `no-email-in-dist` scans
    `.txt` files in `dist/`). Options: a URL (e.g. the Contact section), or a `contact@<domain>` address if
    action item #14 happens and the rule is updated. `Expires:` is required; the daily build can keep it
    current.
  - Depends on: 2.16.

- [ ] **F.7 Terminal view** — A second visual style for the whole site, switched by a click and remembered,
  like light/dark. Same pages, same content, same layout; only the look changes.
  - A separate switch from the light/dark toggle: style = `regular` | `terminal`. Terminal is always dark.
  - CSS and design tokens only, with no component or layout changes:
    - monospace everywhere
    - green or amber on black, with a subtle text glow
    - links shown like `[Resume]`
    - dashed borders instead of cards
  - Saved in `localStorage` (try/catch; key and values next to the theme's in `src/lib/theme.ts` or a sibling)
    and applied before first paint by the inline head script, like the theme (no flash). The CSP hash updates
    automatically on build.
  - Placement: decide when planning. Recommended: a footer link (e.g. `>_ Terminal view`), which works at every
    width; the header has about 6px to spare at 375px.
  - Must meet the same rules as the regular style:
    - WCAG AA contrast and visible focus
    - `prefers-reduced-motion`
    - print still uses the print stylesheet (never prints terminal style)
  - Tests and review screenshots run in terminal style too.
  - Inspired by adventofcode.com's look; nothing copied.
  - Note for planning: design-doc §9 describes one look (one accent color); add a short note there that
    terminal view is an opt-in alternate style.
  - Note from F.3: the 404 game reads its palette from the tokens (`readPalette()` in `src/lib/game/draw.ts`), so it
    follows terminal view if F.7 defines that through the tokens.
    - The game repaints on a `data-theme` change. If F.7 switches with another attribute, the game must observe that
      attribute too.
    - Whether the character gets its own terminal look (e.g. ASCII) is decided in F.7.
  - Depends on: 2.16.

- [ ] **F.8 Game v2 (after launch, after 4.3)** — More to the 404 game (F.3), once the site is live on its domain.
  - More variety in rhythm: obstacle combos (pairs, a long gap then a quick run), not just random gaps.
  - More obstacles: ordinary objects, for every audience.
  - Maybe airborne obstacles with a duck move, but only if it stays easy on touch. Decide then: a second control
    breaks "one button".
  - Difficulty that rises by itself in stages (speed, new obstacles, maybe day/night by score), not a difficulty
    menu.
  - Keep: lazy-loaded on Play, under 8 KB gzipped, tokens only, the reduced-motion exception rules (design-doc
    §10.3).
  - Depends on: F.3, 4.3.

## Milestone 3 — Depth (design-doc §16 Phase 2)

- [ ] **3.1 Log Analytics Platform project page + architecture diagram** — User drafts TL;DR/problem/decisions/trade-offs text and architecture description; Claude Code builds `ArchitectureDiagram.astro` (SVG) and the MDX/page wiring around it.
  - Files: `src/content/projects/log-analytics-platform.mdx`, `src/components/ArchitectureDiagram.astro`, `src/pages/projects/[slug].astro`, `astro.config.mjs` + `package.json` (`@astrojs/mdx`).
  - Note (from 2.4): add `@astrojs/mdx` here (moved from 2.4) and confirm the `projects` collection now
    reads `.mdx` and validates its frontmatter. Then check whether the quiet glob wrapper
    (`src/lib/project-pages-loader.ts`) is still needed once the first project page exists; if not,
    replace it with plain `glob()` in `src/content.config.ts`.
  - Note (from 2.8): the homepage cards are already wired. Once `src/content/projects/<repo-name>.mdx`
    exists, its card gets a "Read more" link to `/projects/<entry id>` (matched to the repo name ignoring
    case; the route must use the same entry id), and its frontmatter title/description/status/team override
    the GitHub data (`src/lib/projects-section.ts`). `Projects.astro` calls `getCollection('projects')` only
    when a page file exists; if the glob wrapper goes, that guard can go too. No test edit is needed.
  - Note (from 2.13, re-homed in 2.16): add the new page to `SITEMAP_PATHS` (`src/lib/seo.ts`).
  - Depends on: 2.4; needs action item #7.

- [ ] **3.2 Table-migration case study** — User drafts the narrative; Claude Code handles layout/MDX wiring.
  - Files: `src/content/case-studies/table-migration.mdx`, `src/pages/case-studies/[slug].astro`, `src/content.config.ts`.
  - Note (from 2.4): the `case-studies` collection (with its frontmatter schema) is added here, not in 2.4.
  - Note (from 2.6): add the "Read the migration case study →" link (design-doc §5.1) to the homepage
    Experience section (`src/components/Experience.astro`), with a test for its href.
  - Verify: Content reviewed against §12 — no internal names/numbers/screenshots.
  - Note (from 2.13, re-homed in 2.16): add the new page to `SITEMAP_PATHS` (`src/lib/seo.ts`).
  - Depends on: 2.4; needs action item #7.

- [ ] **3.3 Contact form (server-rendered)** — Switch to `output: 'server'` on that route via `@astrojs/cloudflare` (rest of site stays prerendered), `ContactForm.tsx` island, server validation, honeypot, Turnstile, basic rate limiting, email delivery.
  - Files: `src/pages/api/contact.ts`, `src/components/islands/ContactForm.tsx`, `astro.config.mjs`, `wrangler.jsonc`.
  - Note (from 2.14): the CSP (`buildPolicy()` in `scripts/csp/csp.mts`) has `form-action 'none'`. Change it to
    `'self'`, and add `https://challenges.cloudflare.com` to `script-src` and a `frame-src` for Turnstile. A server route
    responds through the Worker, which doesn't apply `_headers`, so the function must set its own headers (or the
    page must stay static). Check that the React island's inline bits, if any, are still covered by the build-time
    hashes.
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
  - Note (from 2.13): change `site` in `astro.config.mjs` (one line; every absolute URL derives from it, and the OG
    image doesn't show the URL, so it needs no regenerating). Then remove `X-Robots-Tag: noindex` from
    `public/_headers` (keep robots.txt without any Disallow), and submit `https://<domain>/sitemap.xml` in Google
    Search Console. Consider a redirect from the workers.dev URL to the domain.
  - Note (from 2.14): a zone can inject scripts the CSP blocks. On the new domain, recheck that Web Analytics
    auto-injection, Email Address Obfuscation and Rocket Loader are off, or allowed by the policy. Check with
    `curl -s https://<domain>/ | grep -iE "cloudflareinsights|email-decode|rocket"` and the browser console. Decide
    HSTS: on a `.com`, consider `includeSubDomains` (and `preload` only on purpose, since it's hard to undo). On a
    `.dev`, the TLD is preloaded already. Run securityheaders.com on the domain.
  - Note (from 2.16): after the domain switch, check the zone's Analytics alongside Web Analytics: the beacon misses
    visitors with blockers (e.g. Brave), and server-side counts include bots. Read them together.
  - Note (from 2.16): recheck the LinkedIn share card with Post Inspector (https://www.linkedin.com/post-inspector/)
    on the domain. It couldn't connect to workers.dev.
  - Note (from 2.16): `npm run test:live` follows `site` automatically; run it after the switch.
  - Note (from F.4): set `LAUNCH_DATE` in `src/lib/site.ts` (YYYY-MM-DD) to the launch day, which turns on the
    launch-day doodle on that date every year.

- [ ] **4.2b Keep the daily build alive** — Once the repo is public (action item #11), GitHub disables scheduled
  workflows after 60 days without repository activity. A quiet period would then stop the daily build silently: no
  doodles (F.4) and no project refresh. Handle it before or at launch: a check, a reminder or a keepalive, decided
  then (from F.4).
  - Depends on: the repo going public (#11).

- [ ] **4.2a (optional) Lighthouse CI** — `@lhci/cli` in GitHub Actions with score thresholds, so a regression fails
  the build.
  - Not now: it's a heavy new dependency, scores vary between runs on shared CI machines, and SEO fails on workers.dev
    because of the noindex (gone after 4.2).
  - Needs the user's approval of the dependency (CLAUDE.md rule 5) when we get there.
  - Depends on: 4.2.

- [ ] **4.3 Final QA** — Lighthouse 95+ all categories, every section at 375px, WCAG AA contrast both themes, every link resolves, full keyboard pass.
  - Check the `X-Robots-Tag: noindex` is gone from live responses (removed in 4.2, see its note).
  - README (from 2.4b): add a screenshot of the site and the custom-domain link; replace the
    `workers.dev` link and the work-in-progress line.
  - Making the repo public and branch protection on `main` moved out of this task (in 2.4c) to
    "Things the user needs to do" #11–#12, done at Task 2.16 once the MVP is live (decided in 2.5). The earlier
    "require the `build` check before merging" was dropped: a required status check blocks direct pushes
    to `main`, which amounts to required PRs; the deploy is already gated by CI.
  - Depends on: 4.2.
