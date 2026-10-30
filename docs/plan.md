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
  `CopyEmail` island — nowhere does the email appear as plain text in built HTML.
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
| 2 | Add descriptions to `log-analytics-platform`, `NeetCode`, `project_euler`; add `portfolio-*` topics per §6.5; fix "About As"→"About Us" typo in `scam-reporting-app` README | Before Milestone 2, Task 2.8 |
| 3 | Create a free Cloudflare account | Milestone 1, Task 1.5 |
| 4 | Create a Cloudflare API token (Workers deploy scope) and the account ID; add both as GitHub Actions secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) | Milestone 1, Task 1.5 |
| 5 | Enable Cloudflare Web Analytics on the site once it has a URL, grab the beacon token | Milestone 2, Task 2.15 |
| 6 | Decide/approve the OG image design (or approve a simple generated placeholder) | Milestone 2, Task 2.13 |
| 7 | Draft the real content: Log Analytics Platform architecture + narrative, and the table-migration case study narrative (checked against §12 confidentiality) | Milestone 3, Tasks 3.1–3.2 |
| 8 | Decide contact-form email provider: Cloudflare Email Routing vs Resend; provide its secret/API key as a Cloudflare secret | Milestone 3, Task 3.3 |
| 9 | Choose and purchase the domain via Cloudflare Registrar | Milestone 4, Task 4.1 |
| 10 | Create a local `.env` (from `.env.example`) with your real `CV_PHONE`; add `CV_PHONE` as a GitHub Actions secret | Before Milestone 1, Task 1.2 (local), and Task 1.5 (CI secret) |
| 11 | Before making the repo public: delete the stale remote branch `ci/deploy`; then change the repo visibility to public | Task 2.16 (user decision in 2.5: make it public once the MVP is live; the pre-commit hook from 2.4c is already in place) |
| 12 | Right after making it public: enable secret scanning + push protection and Dependabot alerts; add branch protection on `main` (block force pushes and deletion; no required PRs, and no required status checks, since those would block direct pushes too); check that PRs from forks need approval before they run Actions (Settings → Actions → General) | Task 2.16 (right after #11) |

## New dependencies introduced by this plan

(beyond what `create_cv.js` already needs: `docx`, `js-yaml`)

`astro`, `typescript`, `tailwindcss` + `@tailwindcss/vite`, `@astrojs/react` + `react` + `react-dom`,
`@astrojs/mdx` (moved from Task 2.4 to Task 3.1, where the first MDX page is written), `@astrojs/sitemap`, `pdf-parse` (replaced `pdf-lib` in Task 1.2), `@types/js-yaml`
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
      `title`/`description` were hardcoded resume text and now come from `getResume()` (same output).
    - Visual: subtle dot grid (`--border` dots, faded edges) via a scoped `::before`. Zero JS, no motion
      (→ 3.4). Homepage JS still 0.56 KB gzipped.
    - Tests: `tests/hero.test.ts` (13: helpers, file name, built HTML: one `<h1>` = name, title and
      tagline from YAML, download href/name, the only accent-filled element, View Projects target, profile
      links + `aria-label`s, no script / no unsafe `_blank`); schema test for a missing `tagline`;
      `tests/e2e/hero.spec.ts` (7: download event file name, `/#projects`, Tab order + focus rings,
      375/1280 × dark/light no horizontal scroll and CTAs fully visible). Break-on-purpose: a wrong
      `download` value fails the hero test; a YAML without `tagline` fails `validate-resume.ts`.

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
  - Note (from 2.4): get the address only from `getEmailParts()` (`src/lib/resume.ts`). The `mailto:` link
    must be assembled in the browser too: a `mailto:user@domain` href in the HTML fails `no-email-in-dist`.
  - Note (from 2.5): add the **email icon to the Hero** here (design-doc §5.1 lists GitHub / LinkedIn /
    Email), next to the profile icons in `src/components/Hero.astro`, with its `mailto:` href assembled in
    the browser like the rest of the email. The Hero has no script today, so keep the added JS tiny.
  - Depends on: 2.2.

- [ ] **2.10 Footer + homepage assembly** — Wire Hero/Experience/Projects/Skills/Contact/Footer into `index.astro`.
  - Files: `src/pages/index.astro`.
  - Note (from 2.1): this replaces the temporary design-token swatch page currently in `index.astro`.
  - Open item (from 2.3): at 375px the nav (4 links + theme toggle) fits on one line with only ~6px
    to spare. If a home link / name is added to the header (2.4/2.5) or a link is added, it won't fit:
    the links then wrap to a second line (no overflow, but it looks crowded). Decide here whether
    that's acceptable or whether the nav needs a small-screen pattern (e.g. a disclosure/hamburger
    menu, as an Astro component with a small script).
  - Depends on: 2.5–2.9.

- [ ] **2.11 `/resume` page** — Full resume in site styling, Download PDF button at top, print stylesheet. Reuses the same `CopyEmail` island as Contact (2.9) for the email — never plain text.
  - Files: `src/pages/resume.astro`.
  - Verify: Ctrl+P produces a clean printed page; phone never rendered; email not plain text on this page either (confirm `CopyEmail` island used).
  - Note (from 1.5): the Download PDF button is `<a href="/resume.pdf" download="Shahar_Asher_CV.pdf">`,
    so it downloads, while a direct link to `/resume.pdf` opens in the browser. (2.5) Use
    `RESUME_PDF_URL` / `RESUME_PDF_FILENAME` from `src/lib/resume-pdf.ts`, never retype them.
  - Depends on: 2.4, 2.2, 2.9.

- [ ] **2.12 404 page**
  - Files: `src/pages/404.astro`.
  - Depends on: 2.2.

- [ ] **2.13 SEO, OG image, sitemap, JSON-LD** — Unique `<title>`/meta description per page, OG image, `sitemap.xml` (`@astrojs/sitemap`), `robots.txt`, `Person` JSON-LD from `resume.yaml` excluding `email`/`phone`.
  - Files: `src/layouts/BaseLayout.astro`, `public/og-image.*`, `astro.config.mjs`, `public/robots.txt`.
  - Note (from 2.5): `index.astro`'s `title`/`description` now come from `getResume()` (`name`,
    `` `${name} – ${label}.` ``) instead of hardcoded text; keep it that way for the full SEO tags.
  - Depends on: 2.2, 2.4; needs action item #6.

- [ ] **2.14 Security headers** — Real CSP, `X-Content-Type-Options`, `Referrer-Policy` in `public/_headers`.
  - Files: `public/_headers`.
  - Verify: Headers present in a deployed response; CSP doesn't break islands or fonts.
  - Depends on: 1.5.
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

- [ ] **2.15 Cloudflare Web Analytics** — Beacon script in `BaseLayout`.
  - Files: `src/layouts/BaseLayout.astro`.
  - Depends on: action item #5.

- [ ] **2.16 MVP deploy + visual verification** — Full homepage + `/resume` live on the Cloudflare free URL.
  - Verify: Playwright screenshots at 375px/1280px, dark/light, reviewed; Lighthouse spot-check; `npm run check` and `npm run build` both green.
  - Depends on: everything above in Milestone 2.

## Milestone 3 — Depth (design-doc §16 Phase 2)

- [ ] **3.1 Log Analytics Platform project page + architecture diagram** — User drafts TL;DR/problem/decisions/trade-offs text and architecture description; Claude Code builds `ArchitectureDiagram.astro` (SVG) and the MDX/page wiring around it.
  - Files: `src/content/projects/log-analytics-platform.mdx`, `src/components/ArchitectureDiagram.astro`, `src/pages/projects/[slug].astro`, `astro.config.mjs` + `package.json` (`@astrojs/mdx`).
  - Note (from 2.4): add `@astrojs/mdx` here (moved from 2.4) and confirm the `projects` collection now
    reads `.mdx` and validates its frontmatter. Then check whether the quiet glob wrapper
    (`src/lib/project-pages-loader.ts`) is still needed once the first project page exists; if not,
    replace it with plain `glob()` in `src/content.config.ts`.
  - Depends on: 2.4; needs action item #7.

- [ ] **3.2 Table-migration case study** — User drafts the narrative; Claude Code handles layout/MDX wiring.
  - Files: `src/content/case-studies/table-migration.mdx`, `src/pages/case-studies/[slug].astro`, `src/content.config.ts`.
  - Note (from 2.4): the `case-studies` collection (with its frontmatter schema) is added here, not in 2.4.
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
  - Before launch: remove `X-Robots-Tag: noindex` from `public/_headers` (added in 1.5).
  - README (from 2.4b): add a screenshot of the site and the custom-domain link; replace the
    `workers.dev` link and the work-in-progress line.
  - Making the repo public and branch protection on `main` moved out of this task (in 2.4c) to
    "Things the user needs to do" #11–#12, done at Task 2.16 once the MVP is live (decided in 2.5). The earlier
    "require the `build` check before merging" was dropped: a required status check blocks direct pushes
    to `main`, which amounts to required PRs; the deploy is already gated by CI.
  - Depends on: 4.2.
