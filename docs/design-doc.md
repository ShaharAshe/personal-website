# Design doc: personal portfolio site – Shahar Asher

> **Status:** decisions final; what's built and what's next is tracked in `docs/plan.md` · **Version:** 1.0 · **Date:** November 2026
> **Purpose of this document:** to collect every decision made, the reasoning and the options considered, as the basis for development with Claude Code.

---

## Table of contents

0. [Decision summary](#0-decision-summary)
1. [Goals and audience](#1-goals-and-audience)
2. [Guiding principles](#2-guiding-principles)
3. [Tech stack](#3-tech-stack)
4. [Site structure (sitemap)](#4-site-structure-sitemap)
5. [Content by page](#5-content-by-page)
6. [Dynamic projects from GitHub](#6-dynamic-projects-from-github)
7. [Resume: single source of truth](#7-resume-single-source-of-truth)
8. [Contact](#8-contact)
9. [Visual design](#9-visual-design)
10. [Animation and graphics](#10-animation-and-graphics)
11. [Performance, accessibility and SEO](#11-performance-accessibility-and-seo)
12. [Privacy, security and confidentiality](#12-privacy-security-and-confidentiality)
13. [Hosting, domain and CI/CD](#13-hosting-domain-and-cicd)
14. [Project structure](#14-project-structure)
15. [Analytics](#15-analytics)
16. [Roadmap by phase](#16-roadmap-by-phase)
17. [Working with Claude Code](#17-working-with-claude-code)
18. [Backlog: future ideas](#18-backlog-future-ideas)

---

## 0. Decision summary

| # | Topic | Decision | Details |
|---|---|---|---|
| 1 | Framework | **Astro** + TypeScript + Tailwind, with React islands | [§3](#3-tech-stack) |
| 2 | Hosting | **Cloudflare** (free). The build runs in GitHub Actions | [§13](#13-hosting-domain-and-cicd) |
| 3 | Domain | **Decided at the end of the work.** Bought through Cloudflare Registrar | [§13](#13-hosting-domain-and-cicd) |
| 4 | Accent color | **A fixed blue** `#4F9DFF` | [§9](#9-visual-design) |
| 5 | Color scheme | **Follows the system setting** on the first visit + a Dark/Light toggle (the choice is saved and wins) | [§9](#9-visual-design) |
| 6 | Resume | **`resume.yaml` as the single source** → Word + PDF (in the current design) + a `/resume` page | [§7](#7-resume-single-source-of-truth) |
| 7 | Phone | **Only in the Word/PDF**, not on the site | [§12](#12-privacy-security-and-confidentiality) |
| 8 | Contact | **Launch:** email + Copy, LinkedIn, GitHub. **Phase 2:** a form with your own function | [§8](#8-contact) |
| 9 | Blog | **Not for now** | [§18](#18-backlog-future-ideas) |
| 10 | Architecture diagram | **Static** on the project page. An animated version: maybe later | [§18](#18-backlog-future-ideas) |
| 11 | Projects | **Dynamic from GitHub** at build time, filtered by Topics | [§6](#6-dynamic-projects-from-github) |
| — | Language | **English only** | — |

---

## 1. Goals and audience

### Main goal
To get interviews with companies for **Backend / Software Engineer** roles, by showing real experience with real-time systems at high scale and the ability to think in systems.

### Audience (in order of importance)

| Audience | Time they'll spend | What they look for | What the site needs to give them |
|---|---|---|---|
| **Recruiter** | 20–60 seconds | General fit, experience, technologies | A clear Hero, a scannable Experience, a prominent resume button |
| **Hiring Manager / team lead** | 2–5 minutes | Technical depth, how you think | Project pages, diagrams, decisions and trade-offs |
| **Technical interviewer** | 5–15 minutes (before an interview) | Topics to ask about | Deep-dive pages that give "material for the conversation" |

### Success metrics
- A recruiter understands within 10 seconds who you are, what you do, and how to download the resume.
- At least one project that shows architectural depth beyond CRUD.
- Lighthouse 95+ in all categories.
- The site loads fast on mobile too.

### Non-goals
- Not a showcase of graphic design skills.
- Not an app with users or logins.
- Not a bilingual site.

---

## 2. Guiding principles

1. **Content first.** The content is the product, and the design serves it.
2. **Show, don't tell.** Instead of "Experienced with Kafka", a diagram that shows how you used it and why.
3. **Fast by default.** You come from a world of millisecond latency. A slow site hurts your credibility.
4. **Minimal motion with purpose.** Every animation should explain something or improve how the site feels to use.
5. **Single source of truth.** Every piece of information is kept in one place only: the resume in `resume.yaml`, the projects on GitHub. (This is also a natural reference to the migration you led at Taboola.)
6. **Easy to maintain.** Updating the resume = editing YAML. A new project = making a repo public and adding a topic.

---

## 3. Tech stack

### 3.1 The decision

| Layer | Choice | Reasoning |
|---|---|---|
| Framework | **Astro** | A fast static content site, zero JS by default, built-in MDX |
| Language | **TypeScript** | Type safety for the data (a schema for the YAML and the GitHub data) |
| Styling | **Tailwind CSS** | Fast to develop, consistent, Claude Code knows it well |
| Interactive islands | **React** | Only for complex interaction (the contact form). Simple interactions are Astro components with a small script: React would add 45–60KB of JS to every page for one button, and break the 30KB target. So far the interactive parts (the theme toggle, the Copy button) are Astro components with small scripts; the first React island is planned with the contact form (task 3.3) |
| Animation | **CSS**, and Motion only if needed | See [§10](#10-animation-and-graphics) |
| Content | **YAML** (resume) + **MDX** (deep-dive pages) + **GitHub API** (project cards) | |
| Hosting | **Cloudflare** | See [§13](#13-hosting-domain-and-cicd) |
| CI/CD | **GitHub Actions** | Needed because of the PDF generation ([§7](#7-resume-single-source-of-truth)) |

### 3.2 Options considered and rejected
- **Next.js:** shows React, but overkill for a static content site. More JS, more complexity.
- **Plain HTML/CSS/JS:** simple, but doesn't fit dynamic content (GitHub, YAML).
- **Spring Boot:** "Java on the site too", but it needs a paid server, and an experienced interviewer would spot the over-engineering. The Java is shown through the projects, not through the site.

---

## 4. Site structure (sitemap)

```
/                               → homepage (scrolling, 5 sections)
├── /projects/[repo-name]       → project deep-dive page (only for projects that have an MDX file) (planned, Milestone 3)
├── /case-studies/table-migration → Case study: the publishers table migration (planned, Milestone 3)
├── /resume                     → resume as HTML + a PDF download button
├── /resume.pdf                 → the file to download (a fixed URL)
└── /404                        → a designed error page, with a small game below it (F.3)
```

**Top navigation:** `Experience · Projects · Resume · Contact` + a Dark/Light toggle. On the left: the name (from `resume.yaml`) as a link to `/`, in a muted color like the rest of the chrome. It's shown from 640px (`sm`) up. At phone width there's no room for it in the row, and the page itself starts with the name. That's why `/resume` keeps the "← Back to home" link.

**Why a scrolling homepage + deep-dive pages?** A recruiter sees everything in one scroll without clicking, and whoever wants depth goes to the dedicated page. Separate pages like "About" and "Skills" usually end up shallow.

---

## 5. Content by page

### 5.1 Homepage

#### Hero
- **Name:** Shahar Asher
- **Title:** Software Engineer, Backend & Distributed Systems (from `basics.label` in `resume.yaml`; `create_cv.js` doesn't use this field, so the PDF doesn't change)
- **One sentence:** from `basics.tagline` in `resume.yaml`, a required field in the schema: one line written by hand (the first sentence of `summary` starts with "Software Engineer" and repeats the title). It doesn't appear in the PDF.
- **CTAs:** `Download Resume` (primary, blue) · `View Projects` (secondary) · GitHub / LinkedIn / Email icons
- **Visual:** a subtle background in two separate layers, no huge image, and nothing under the content that hurts contrast: dots (`--hero-dot`) in both modes, only in the margins on desktop, on both sides of the text column (at 720px wide and below they don't appear), and a soft glow in the accent color (`--hero-glow`) behind the title, in dark mode only. All the text meets 4.5:1 even at the strongest point of the glow.
- **Why no glow in light mode:** the role line in the accent color limits it to 3.5% (4.52:1, right on the edge), and at that strength it's barely visible and leaves a pale gray ellipse edge.
- **Why no dots under the text:** they were tried at a radius of 1px, 1.5px and 2px. A dot you can see drops the text below AA (accent in light mode: 3.59:1 already at 20% strength), and a solid background behind the lines cut the dots into a dashed line.

#### Experience
- **Built from `resume.yaml`**, so there's no duplication with the resume.
- A card for Taboola. The homepage shows the 3–4 strongest highlights (marked `featured: true` in the YAML), with a link to the full resume.
- A "Read the migration case study →" link (planned, task 3.2, with the case study).
- A timeline structure, so there's room for future roles.
- A role with no `featured` highlights is still shown (company, position and dates only), so there's no gap in the timeline.

#### Projects
- **Built from GitHub** ([§6](#6-dynamic-projects-from-github)).
- Featured first, then the More projects heading, and at the end the Algorithm practice row. All cards in one column, at full width.

#### Skills
- **Built from `resume.yaml`**.
- Grouped by category, as in the resume. **No** progress bars or percentages.
- On the homepage: one card for the whole section, in the same design as the Experience cards, so it looks part of the same site as Experience, Projects and Contact. Inside it each category is shown stacked: the name above the chips, at every width (no label column on the side).
- The chips are the shared technology chip (`TechChip`), identical to the language chip on the project cards ([§9.4](#94-layout)).
- On the `/resume` page the section keeps its own layout (no card, the category name to the left of the chips from `sm` width up, bigger chips), with a Spoken Languages row at the end.

#### Contact
- See [§8](#8-contact).

#### Footer
- © year (the build year) and name · GitHub and LinkedIn links from `basics.profiles` with the shared icons · a "Back to top" link (no JS; it also moves keyboard focus to the top of the page; only on pages long enough to scroll, so not on the 404 page).
- Shown on every page through `BaseLayout`. No email: the email links work only on pages that include `CopyEmail`.

### 5.2 Project deep-dive page template

A deep-dive page is created only for a project that has a `src/content/projects/<repo-name>.mdx` file. The basic data (name, languages, stars, links) comes from GitHub, and the story from the MDX.

1. **TL;DR**: what it is, in 2–3 lines
2. **The problem**: why build it, what the challenge is
3. **Architecture**: a static diagram (SVG)
4. **Key decisions & trade-offs**
5. **What I'd do differently / Next steps**
6. **Tech stack** · **GitHub link**

**Log Analytics Platform (the first to be written):**
- Why Kafka (vs. RabbitMQ or writing straight to the DB)
- Why partitioning by service (ordering per service vs. the risk of hot partitions)
- At-least-once: how duplicates are handled (idempotency)
- A link to the ADRs in the repo

**Scam Reporting App:** a card only at first. If you want a page, the interesting points are Spring Security with role-based permissions and WebSocket for real-time updates. State **"Team project · 2 developers"**.

### 5.3 Case study: publishers table migration

1. **Context**: a central table managed in several places, consistency problems
2. **Goal**: a single source of truth for 6+ subsystems, with no downtime
3. **Strategy**: backfill, a new cache, feature flags per subsystem, a gradual rollout
4. **Risk management**: how you verified correctness before each switch
5. **Outcome**: zero incidents, zero rollbacks
6. **Lessons learned**

> ⚠️ **At a conceptual level only.** No table names, internal service names, business numbers or code. See [§12](#12-privacy-security-and-confidentiality).

---

## 6. Dynamic projects from GitHub

### 6.1 The decision
The projects are pulled from GitHub automatically. A new project appears on the site as soon as the repo is public and tagged. There's no need to touch the site's code.

### 6.2 When to fetch: at build time, not in the browser

| | At build time ✅ | In the visitor's browser ❌ |
|---|---|---|
| Speed | The data is already in the page | The page loads, then the cards "jump" in |
| GitHub limits | One request per build, with a token | 60 requests per hour per IP, without a token |
| Reliability | If GitHub is down, the build fails and the old site stays | If GitHub is down, an empty section |
| SEO | Google sees the projects | Google might not see them |

**Automatic updates:** a scheduled GitHub Action rebuilds the site **once a day**. So a new project appears within a day at most. For an immediate update: run the workflow manually on GitHub (the "Run workflow" button).

### 6.3 Filtering by GitHub Topics

| Topic on the repo | Where it appears |
|---|---|
| `portfolio-featured` | The first card in the Projects section (all cards are the same width) |
| `portfolio` | A regular card in More projects |
| `portfolio-practice` | The "Algorithm practice" row (links only) |
| None of these | Doesn't appear on the site |

**Order within each group:** by the last update date (`pushed_at`), newest first.
**Never included:** forks and archived repos, even if tagged.

### 6.4 What is fetched from GitHub

| Field | Source on GitHub | Use on the site |
|---|---|---|
| Name | `name` | The card title (formatted: `log-analytics-platform` → "Log Analytics Platform") |
| Description | `description` | The description line on the card |
| Languages | `languages` | Technology tags |
| Topics | `topics` | Filtering + extra tags (without the `portfolio-*` topics) |
| Stars | `stargazers_count` | Shown only if > 0 |
| Last update | `pushed_at` | Sorting + "Updated Oct 2026" |
| Link | `html_url` | A "GitHub" link (with the GitHub icon) |
| Demo | `homepage` | A "Live demo" link (with the shared `ArrowUpRightIcon` icon), if a Website is set on the repo |

**Link to a deep-dive page:** if `src/content/projects/<repo-name>.mdx` exists, the card gets a "Read more →" link to the inner page. The MDX can also override fields (for example `status: In progress`, `team: 2 developers`, a longer description). `status` and `team` are shown on the card in a small line under the title.

**Topics on the card:** a topic that only repeats a language (for example `java` next to Java, ignoring upper/lower case) isn't shown twice.

**Links vs. tags:** the links on the card are text links in the accent color (because accent = clickable). The language tags are outlined and the topic tags have a `--border` background, and none of them is in the accent color.

### 6.5 The repos and their topics

| Repo | Description on GitHub | Topic |
|---|---|---|
| log-analytics-platform | ✅ exists | `portfolio-featured` |
| scam-reporting-app | ✅ exists | `portfolio` |
| diff-checker | ✅ exists | `portfolio` |
| Cryptography_modules | ✅ exists | `portfolio` |
| LeetCode | ✅ exists | `portfolio-practice` |
| NeetCode | ✅ exists | `portfolio-practice` |
| project_euler | ✅ exists | `portfolio-practice` |

The descriptions and topics are set on the repos. GitHub is the source; this table is the mapping as decided.

### 6.6 Build checks
- A repo with `portfolio-featured` or `portfolio` **and no description** → the build fails with a clear message. That way no empty card goes live.
- The API is down → the build fails, and the existing site stays up.

---

## 7. Resume: single source of truth

### 7.1 Before this site
Before this site, the resume was created in a claude.ai chat, by a `create_cv.js` script (the `docx` library) that generated a Word file, and a PDF from it. **The content and the design lived together in the same script**, so every update in a new chat also rewrote the design.

### 7.2 The decision
Separate the content from the design:

```
src/data/resume.yaml          ← the content, and only here
   │
   ├──▶ scripts/cv/create_cv.js  (the current design, unchanged)
   │       └──▶ Shahar_Asher_CV.docx
   │               └──▶ LibreOffice ──▶ Shahar_Asher_CV.pdf  → /resume.pdf
   │
   └──▶ Astro
           ├──▶ the /resume page  (in the site's design, Dark/Light, mobile-friendly)
           └──▶ the Experience and Skills sections on the homepage
```

- **The resume stays exactly as it is today:** the same script, the same fonts, colors and spacing. Only the text moves to the YAML.
- **Everything is generated together on every build**, so the Word file, the PDF and the site are always from the same version.

### 7.3 The new way of working
Instead of a claude.ai chat, updates are made in Claude Code inside the repo:
> "Add a bullet to the resume about Spring Security in the Scam Reporting project"

Claude Code edits `resume.yaml` and runs `npm run cv` (with the one-page check). You review and approve the diff, commit it on a branch, and it reaches `main` through a PR. The build regenerates everything. The exact steps are in CLAUDE.md ("Updating the resume").

### 7.4 The `resume.yaml` structure (draft)

An illustration of the shape. The real file is `src/data/resume.yaml`, validated by `src/data/resume.schema.ts`.

```yaml
basics:
  name: Shahar Asher
  label: Software Engineer, Backend & Distributed Systems
  email: <email from resume.yaml>
  # No phone field: the repo is public. The phone comes only from the CV_PHONE environment variable
  # (.env locally, a secret in CI), and appears only in the Word/PDF. The schema rejects a phone field.
  location: Israel
  summary: >
    Software Engineer with production experience on real-time,
    high-throughput ad-tech systems at Taboola...
  # One line for the site's Hero (a required field, not shown in the PDF)
  tagline: >-
    Production experience on real-time, high-throughput ad-tech systems at Taboola; ...
  profiles:
    - network: LinkedIn
      url: https://www.linkedin.com/in/shahar-asher30
    - network: GitHub
      url: https://github.com/ShaharAshe

work:
  - company: Taboola
    position: Software Engineer
    startDate: "2025-04"    # dates always in quotes: "YYYY-MM" or "YYYY"
    endDate: "2026-04"      # no endDate → "Present"
    highlights:
      - text: Led the migration of a core publishers table to a single source of truth...
        featured: true    # also shown on the homepage
      - text: ...

projects:
  - name: Log Analytics Platform
    status: In Progress
    description: ...
    url: https://github.com/ShaharAshe/log-analytics-platform

skills:
  - category: Languages
    items: [Java, JavaScript, SQL, C++, Python]
  - ...

education:
  - institution: Hadassah Academic College, Jerusalem
    degree: B.Sc. Computer Science
    startDate: "2021"
    endDate: "2024"
    highlights: ["GPA: 91.5/100"]
```

The structure is based on the open [JSON Resume](https://jsonresume.org/schema) standard, with an extra `featured` field. The file is validated against a schema (`src/data/resume.schema.ts`, zod from `astro/zod`) right at the start of `npm run cv`, and again in Astro through `src/lib/resume.ts` (a validated module the components read from, not a content collection), so a missing, wrong or unknown field is caught in the build. The module returns `basics` without the email; the email is available only through `getEmailParts()` (user name and domain separately), for the Copy button that assembles it in the browser (§8.3).

> **Note:** the resume's Projects section stays in the YAML and isn't pulled from GitHub. A resume is a document you curate by hand, and the projects in it are worded especially for it.

### 7.5 Build checks
- **The PDF must be one page.** Spilling onto a second page → the build fails.
- **The YAML matches the schema.**
- **The phone doesn't appear in the site's files** (`dist/**/*.{html,js,json,xml,txt}`) — an automatic check. The check
  doesn't look at `Shahar_Asher_CV.pdf`/`.docx` themselves, where the phone is supposed to appear.
- **The email doesn't appear as plain text in the site's files** (the same files, `no-email-in-dist`) — including the `%40`
  form and ignoring upper/lower case. Here too the PDF/DOCX aren't checked, and the output shows only file:line, never the address.
- **Font fidelity in the published PDF:** the published PDF is always built in CI (`ubuntu-24.04`, with
  `libreoffice-writer` and `fonts-liberation`), and it's verified that `fc-match Arial` resolves to Liberation Sans —
  otherwise the build fails. This is the only PDF ever published. A PDF generated locally (for example on Windows, with real
  Arial) is only a preview of the content and the layout, not the file that goes live.

### 7.6 The `/resume` page
- The full content, in the site's design, in the same order as the PDF: name, title (`basics.label`), contact details, summary, Experience (all the highlights), Projects (from `resume.projects`), Skills (with a Spoken Languages row at the end), Education. As in the PDF, `tagline` and `location` aren't shown. `basics.label` is the only addition compared with the PDF.
- A **← Home** link above the title, and a **Download PDF** button at the top of the page (the only accent fill on the page).
- One contact line, as in the PDF: the email address (itself the `mailto:` link) and a small icon-only copy button, then LinkedIn and GitHub, with separators. The email only through `CopyEmail` (`variant="compact"`). The phone doesn't appear, and printing doesn't mention it either.
- Each project is built like an Experience entry: name and status on the top line, a "GitHub" link instead of the dates, and the description below.
- A print stylesheet (`@media print` in `global.css`), so Ctrl+P gives a clean page: dark text on a white background even in the dark theme, no navigation, footer, buttons or Home link, the email address stays if it was revealed, and the profile links have their address printed after them. The PDF stays the official version.

### 7.7 Details
- **File name:** `Shahar_Asher_CV.pdf`
- **Fixed URL:** `/resume.pdf`, so it can go on LinkedIn and in emails.
- **The download button:** in the Hero and on the `/resume` page.

### 7.8 Options considered and rejected
- **Only a PDF to download:** no good view on the site.
- **A PDF embedded in the page:** works badly on mobile, not accessible.
- **The site extracts text from the PDF:** PDF is a display format, and extraction is fragile.
- **The site reads the Word file (by the style names):** possible, but it breaks if a future claude.ai chat changes the style names, and it needs three matching files uploaded by hand.
- **A new PDF generated from an HTML template:** changes the resume's current design.

### 7.9 Recommended content updates (optional)
- **Scam Reporting:** the resume says "Spring Boot, MySQL, responsive frontend". According to the README there's also **Spring Security with role-based permissions and WebSocket for real-time updates**, and they're worth adding.

---

## 8. Contact

### 8.1 The decision

| Channel | Role | Phase |
|---|---|---|
| **Email + Copy button** | Primary, the most prominent button in the section | Launch |
| **LinkedIn** | Primary, at the same level as the email | Launch |
| **GitHub** | A link (not a contact channel) | Launch |
| **Form** (your own function on Cloudflare) | Secondary, below the primary channels | Phase 2 |

### 8.2 Section structure
1. A "Let's talk" heading + a short sentence: "Open to backend and distributed systems roles." (The sentence can be changed once you find a job.)
2. Two cards of the same size: **Email** (with a blue Copy button) and **LinkedIn**.
3. In phase 2: "Or send a message here" and a short form. The submit button isn't filled with color, so it's clear this is a secondary option.
4. A link to GitHub at the bottom.

### 8.3 Email
- A **Copy** button that copies the address, and for about 2 seconds swaps the copy icon for a check icon and shows "Copied" (SVG, because check-mark characters can show up as a colored emoji on phones).
- `mailto:` as an extra option only (most visitors have no mail app set up). This link is assembled in the browser too.
- **Protection from bots:** the address is assembled only in the browser and doesn't appear as plain text in the HTML. Components get it only
  from `getEmailParts()` in `src/lib/resume.ts`, and the `no-email-in-dist` check fails the build if it appears in `dist/`.
- **Without JavaScript:** the address, the Copy button and the `mailto:` links (the Hero icon too) are hidden and don't take focus, and the email
  card shows a short line pointing to LinkedIn. **If copying fails** (no Clipboard API, or access was blocked): the address is selected
  and a hint to copy it by hand appears (Ctrl+C / ⌘C).

### 8.4 Form (phase 2)
- **Fields:** Name, Email, Message + a hidden field (honeypot) against bots.
- **Validation:** in the browser (user experience) **and also** in the server function (security). A maximum length for each field.
- **Spam protection:** Cloudflare Turnstile (invisible to most visitors) + honeypot + rate limit per IP.
- **Sending:** the function sends an email to your inbox, with the sender as `reply-to`, so you reply straight from Gmail. The email provider will be chosen during implementation: Cloudflare Email Routing (sending to your verified address, needs the domain to be on Cloudflare) or a service like Resend.
- **UX:** a loading state, a success message, and an error message that points to the email.
- **Secrets:** API keys only as Cloudflare secrets, never in code.

### 8.5 Options considered and rejected
- **Only `mailto:`:** doesn't work for most visitors.
- **A form through an external service (Formspree etc.):** works, but with a dependency, limits and sometimes someone else's branding. Your own function is better, and it's also one more backend piece to show.
- **Spring Boot for the form:** complete overkill.
- **A meeting-booking link (Calendly):** recruiters hardly use it, and it might look presumptuous.

---

## 9. Visual design

### 9.1 Direction
**"Minimal, technical, fast"**: close to the aesthetic of good technical documentation or a modern developer tool. Lots of whitespace, strong typography, and one accent color.

### 9.2 Colors

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#0B0D10` | `#FAFAFA` |
| `--surface` | `#14171C` | `#FFFFFF` |
| `--text` | `#E6E8EB` | `#111418` |
| `--text-muted` | `#8B93A1` | `#5B6472` |
| `--accent` | `#4F9DFF` | `#1F6FD1` (a darker shade, for contrast on white) |
| `--border` | `#23272F` | `#E5E7EB` |

**Why blue:** it's the color everyone recognizes as "link" and "button", it conveys trust and professionalism, and it doesn't compete with the content.

**Theme:**
- **On the first visit the site follows the visitor's system setting** (`prefers-color-scheme`; Dark if the browser reports no preference).
- A Dark/Light toggle. The choice is saved on the visitor's side (`localStorage`, key `theme`, values `light`/`dark`) and from then on wins over the system setting.
- The color is set **before** the page is shown (a small script in `<head>`), so there's no flash of the wrong color on load.
- All the colors are checked for WCAG AA contrast (4.5:1 for text) in both modes.

**Considered and rejected:** a random color on every visit. It hurts consistency, doubles the testing, and might cause a flash. (A manual color picker for the visitor is in the [Backlog](#18-backlog-future-ideas).)

### 9.3 Typography
- **Text:** Inter or Geist Sans
- **Mono (tags, accents):** JetBrains Mono or Geist Mono
- **Scale:** 6 sizes only (defined in `global.css`, Tailwind's default sizes are removed):

| Size | Value | Use |
|---|---|---|
| `xs` | 0.75rem | Tags, captions, dates |
| `sm` | 0.875rem | Secondary text, navigation |
| `base` | 1rem | Body text |
| `lg` | 1.25rem | Subheadings |
| `xl` | 1.75rem | Section headings |
| `display` | 2.25rem on mobile up to 3rem on desktop (`clamp()`) | The Hero title and the `<h1>` of `/resume` only |

- The fonts are hosted on the site itself (self-host), for performance and privacy.

### 9.4 Layout
- One 720px-wide column for all the sections, the navigation and the Footer, so the headings and edges line up. The project cards are in one column at every width, and each card takes the whole column.
- Mobile-first. Every section is checked at 375px width.
- Cards with a subtle border, no heavy shadows.
- **Chips:** an outlined chip means "technology" across the whole site: a project's languages and the homepage Skills, all from one component (`src/components/TechChip.astro`). A filled chip (`--border` background) is only for a repo's topics. No chip uses the accent.

### 9.5 Terminal view (an opt-in alternate style)
Sections 9.1–9.4 describe the site's one look. **Terminal view** (F.7) is a second look that the visitor turns on: it's never the default, and the same pages, content and layout stay. It's inspired by the look of old terminals and puzzle sites like Advent of Code, with nothing copied.
- **The switch:** a `>_ Terminal view` button in the Footer (a real `<button>` with `aria-pressed`), separate from the Dark/Light toggle. In terminal view it reads `>_ Terminal view [on]`, so it's clear the same button turns it off; the `[on]` isn't part of its accessible name. It's saved like the theme (`localStorage`, key `style`, values `regular`/`terminal`, in `src/lib/theme.ts`), and the same `<head>` script sets `<html data-style="terminal">` before the page is shown, so there's no flash.
- **Always dark:** while it's on, the Dark/Light toggle is hidden. The saved theme is kept and comes back when terminal view is turned off.
- **CSS and tokens only** (`src/styles/global.css`): the components keep their classes, and the 404 game and the doodles follow, because they read the tokens.
  - Green on black, with the six tokens below.
  - Monospace everywhere: the JetBrains Mono the site already loads, at weight 400 only (no faux bold, no new download).
  - A subtle glow on text (none on the topic chips' `--border` fill, where it would take the contrast below AA).
  - Text links shown like `[Resume]`; links with an icon get even space inside, `[ (icon) LinkedIn ]`. The brackets come from CSS `content` with alt text, so screen readers don't read them. Button-style and icon-only links are marked `data-no-brackets`.
  - Dashed square borders instead of cards (cards get no fill). A border that is a control's only edge (View Projects, Copy, the game) uses `--text-muted`, so it meets 3:1.
  - Mono is wider, so a few layouts adapt, still in CSS only:
    - below 640px the nav links have no brackets, so the nav stays on one row;
    - /resume reserves a wider slot for the email;
    - the Footer keeps its phone layout at every width.
- **The same rules as the regular look:**
  - WCAG AA: tested like 9.2, and also against the glow at its strongest.
  - `prefers-contrast: more` removes the glow.
  - Switching crossfades the whole page like the theme switch (10.1, opacity only, 200ms), and is instant with `prefers-reduced-motion` or in a browser without View Transitions.
  - **Print always uses the print stylesheet:** every terminal rule is inside `@media screen`.

| Token | Terminal | Contrast on `--bg` |
|---|---|---|
| `--bg` / `--surface` | `#050805` | (the same: cards have no fill) |
| `--text` | `#4FDB67` | 11.2:1 |
| `--text-muted` | `#3FB054` | 7.2:1 (5.1:1 on `--border`, the topic chips) |
| `--accent` | `#A6F5B3` | 15.7:1 (links and the focus ring, brighter than the text) |
| `--border` | `#123118` | Decorative only |

---

## 10. Animation and graphics

### 10.1 What's in

| Element | Animation | Tool |
|---|---|---|
| Moving between pages | A 200ms crossfade of the whole page (`ease-out`, opacity only) | The browser's native cross-document View Transitions, CSS only (`@view-transition`), not Astro's `<ClientRouter />` |
| Project cards | Hover: a 2px lift (`transform`, 200ms `ease-out`), only on devices that can hover | CSS |
| Section entrance | The four homepage sections after the Hero (never the Hero itself, the LCP): fade + a 12px slide, 500ms `ease-out`, **once**, the first time each scrolls into view | CSS + IntersectionObserver |
| Theme toggle | The page crossfades to the new colors (the same 200ms crossfade as between pages, through `document.startViewTransition()`); the new icon also rotates and fades in (200ms), and only after a click, not on load | CSS + a few lines in the toggle's script |
| Copy button | An instant swap to a check icon and "Copied" | CSS |
| Terminal view switch (9.5) | The same 200ms crossfade as the theme toggle | Same |

All of it was built in task 3.4. How:
- **Page transitions without a router.** Every navigation is still a full page load, so the `<head>` script, the console greeting, the game and doodle loaders and the analytics beacon run on every page as before. A browser without cross-document View Transitions just navigates. Only the root snapshots' opacity animates: the root group's own animation is turned off (its size and position never change).
- **The section entrance never hides content by itself.** The HTML has only a bare `data-reveal` marker that no CSS matches. A small script (`src/components/SectionReveal.astro`, rules in `src/lib/reveal.ts`) hides a section only if it's entirely below the screen when the page loads, and never the target of the URL's hash (`/#contact`). So without JS, in print and with reduced motion, everything is simply there. The section's children move, never the section: its box stays put, so a jump to `/#projects` lands exactly on it (a browser scrolls to an element's transformed box).
- **No blue border on card hover** (planned earlier): only `transform` and `opacity` may animate (10.3), and accent means clickable (`.claude/rules/ui.md`), while the card itself isn't a link, only the links inside it.
- **No layout shift:** only `transform` and `opacity`; the e2e tests measure zero layout shift on every page once the web fonts are in, while scrolling to the bottom. The font swap before that (a hair of shift on Linux, where the size-adjusted fallbacks' local fonts are missing) belongs to task 3.4a (font loading).

### 10.2 What's out
- ❌ Three.js / 3D / WebGL
- ❌ Particle backgrounds (a deliberate exception: the doodles' animation, which only the visitor starts, see 10.3)
- ❌ Animating every element on scroll
- ❌ Custom cursor, excessive parallax
- ❌ Loading screens and intro animations

### 10.3 Rules
- **Duration:** 150–300ms for micro-interactions, up to ~600ms for entrances.
- **Easing:** `ease-out`.
- **`prefers-reduced-motion`:** all animations are turned off. Required. That includes the page transitions (the `@view-transition` rule is inside a `prefers-reduced-motion: no-preference` query), the theme and terminal view crossfade (the script checks first), the section entrance and the card hover.
- Only `transform` and `opacity` (no layout shifts).
- **Exception: the 404 game (F.3, `src/components/LostPageGame.astro`, `src/lib/game/`).** The game is continuous motion on a `<canvas>`, and it's a deliberate exception to the two rules above:
  - **Nothing moves before the visitor presses Play** (or touches the game, or presses Space / Enter when the focus is on the page itself or on the game, like Chrome's dinosaur), for anyone. There's no autostart. A key pressed on a link, a button or a field keeps its usual job (Space on "Back to home" doesn't start a game).
  - **With `prefers-reduced-motion`** the game still runs after the visitor started it: the motion was started by them and it's the core of the content, as WCAG 2.3.3 allows. But without what only decorates the motion: no shake on a hit, no moving background (the dashes on the ground), no walking legs, and no flashing at game over (even without reduced motion there's no flashing: game over is one static change). The speed and the physics are the same. `effectsFor()` in `src/lib/game/engine.ts`.
  - **"Only `transform` and `opacity`"** is a rule about CSS on the page. Drawing on the canvas is outside it: it doesn't change layout, and the canvas itself doesn't move.
  - Don't "fix" the game to follow the general rules. The decision is documented here and in a line in CLAUDE.md.
- **Exception: the doodles (F.4, `src/components/Doodle.astro`, `src/lib/doodles/`).** On a few special days (New Year's Day, Pi Day, Alan Turing's birthday, Programmers' Day, Halloween, Hanukkah and the site's launch day) a small drawing made of dots appears in the Hero, the same size as the background dots. It's a link to the day's article on the English Wikipedia. Its animation (a burst of dots like fireworks, a spin, flickering flames) is a deliberate exception to the ban on "particle backgrounds" in 10.2:
  - **Only after a visitor action:** hover, keyboard focus or a first tap. Once, 2–3 seconds (2.4), no loop, and again only on the next hover or focus. At the end the dots go back to their place. Not a background, not on scroll, not on load.
  - Only `transform` and `opacity` (the Web Animations API, which isn't subject to the CSP's `style-src`). The opacity drops at most twice a second, far from flashing.
  - **With `prefers-reduced-motion`** nothing moves: the shape stays in place, hover and focus only show the bubble, and the animation file isn't loaded at all.
  - The color: `--text-muted` (the token the background dots are mixed from, at full strength to pass WCAG 1.4.11's 3:1), and `--text` on hover and focus, like the profile links. No accent.
  - Don't "fix" the doodles to follow the general rules.

### 10.4 Architecture diagram
- **A static diagram (SVG)** on the Log Analytics Platform page, matching the architecture in the repo exactly.
- Built as SVG in code, so it's sharp at any size and adapts its colors to Dark/Light.
- An animated version: in the [Backlog](#18-backlog-future-ideas).

---

## 11. Performance, accessibility and SEO

### Performance
| Metric | Target |
|---|---|
| Lighthouse (all categories) | 95+ |
| LCP | < 1.5s |
| CLS | < 0.05 |
| JS on the homepage | < 30KB (gzipped) |
| Images | AVIF/WebP, lazy loading, set dimensions |

### Accessibility
- Semantic HTML (`<nav>`, `<main>`, `<section>`, headings in the right order).
- Full keyboard navigation + visible focus states.
- Alt for every image, labels for every field.
- WCAG AA contrast, in terminal view too (9.5).
- `prefers-reduced-motion`.
- `prefers-contrast: more`: terminal view drops its text glow (9.5).

### SEO and sharing
- A unique `<title>` and `<meta description>` for every page. On the homepage: the title is `name – role` and the description is the tagline, both from `resume.yaml`. That way the share card (the title and description under the image) doesn't repeat the name.
- **Open Graph image:** a designed image that appears when the link is shared on LinkedIn or WhatsApp.
- `sitemap.xml` and `robots.txt`.
- JSON-LD of type `Person`, built from `resume.yaml`.

**How it's built (Task 2.13):**
- **One base URL:** `site` in `astro.config.mjs`. Every full URL (canonical, `og:url`, `og:image`, the sitemap and robots.txt) is derived from it through `src/lib/seo.ts`. Moving to a domain is a one-line change. No URL ends in `/`, except the root.
- **On every page:** canonical, Open Graph tags (`og:title`, `og:description`, `og:url`, `og:image` with dimensions and alt, `og:type`) and a `twitter:card` of type `summary_large_image`. The 404 page has `noindex`, and it has no canonical and no `og:url`.
- **sitemap.xml and robots.txt** are small endpoints in `src/pages/`, not `@astrojs/sitemap`. That way there's no new dependency, the file is called `sitemap.xml` (the integration writes `sitemap-index.xml`), and the Sitemap line in robots.txt is derived from `site`. The sitemap has only `/` and `/resume`, without `/404`. robots.txt has no Disallow at all, otherwise crawlers wouldn't see the noindex.
- **The OG image:** `public/og-image.png` at 1200×630, kept in git. It's generated by `npm run og`: an HTML template with the name, the role and the tagline from `resume.yaml`, in the dark colors and the site's fonts, rendered with the Playwright that's already installed. The text is centered, so a square crop (WhatsApp) still shows the name and the role. The file must be smaller than 300KB. A hash of the image's sources is stored inside the PNG, and `npm test` fails when it no longer matches (for example after a change to the role in the YAML).
- **The site icon (Task 2.13a):** the initials (derived from `basics.name` in `resume.yaml`, never typed) in JetBrains Mono, in the dark accent color on the dark background, in a rounded square. One version for both themes: it's dark, so it reads on a light and a dark browser. `public/favicon.ico` holds PNGs at 16, 32 and 48 (Google needs a multiple of 48), and `public/apple-touch-icon.png` is 180×180, a full, opaque square (iOS rounds it itself and fills transparent pixels with black). They're generated by the same `npm run og` and the same hash check as the OG image. Each size is rendered at its real size, so the font gets hinting for that size. **No SVG:** an SVG file can't load the site's fonts, and turning the letters into paths would need parsing woff2 (a new dependency or a lot of code). At 16px JetBrains Mono 400 has a thin stroke, so it gets a 0.4px outline (`text-stroke`). The `<link>` for both files is in `BaseLayout`, on every page. Cloudflare serves the `.ico` as `image/vnd.microsoft.icon`, so no change to `_headers` is needed.
- **JSON-LD** only on the homepage: `name`, `jobTitle`, `description`, `url`, `sameAs` (the profiles), `knowsAbout` (the skills), `alumniOf`. Never an email, phone or address.
- **noindex:** the site-wide `X-Robots-Tag: noindex` stays until the move to a domain, so Google doesn't index the workers.dev URL as a duplicate.

---

## 12. Privacy, security and confidentiality

### Personal information
- **Phone:** only in the Word/PDF. Not on the site (including an automatic check in the build).
- **Email:** shown on the site, but assembled only in the browser, to reduce harvesting by bots.
- **Location:** "Israel" only.

### Confidentiality toward Taboola
- No code, screenshots of internal systems, table names or internal service names, or unpublished business numbers.
- Describe **problems, approaches and decisions** in general terms.
- Rule of thumb: if you wouldn't say it in an interview at a competing company, it doesn't go on the site.
- It's worth checking what your confidentiality agreement says.

### Security
- **Form:** server-side validation, rate limiting, honeypot, Turnstile.
- **Secrets:** only as Cloudflare and GitHub Actions secrets.
- **Security headers** through a `_headers` file (Cloudflare applies it to every response, including the 404 page), see below.

#### Content-Security-Policy
**The policy** (one for the whole site, under `/*`):
`default-src 'self'; script-src 'self' https://static.cloudflareinsights.com/beacon.min.js <hashes>; style-src 'self' <hashes>; img-src 'self'; font-src 'self'; connect-src 'self' https://cloudflareinsights.com; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`.
No `'unsafe-inline'` and no `'unsafe-eval'`, neither for scripts nor for styles.

**The only third party: Cloudflare Web Analytics** ([§15](#15-analytics)). `script-src` has the full path of the beacon file, not the whole host (the form in Cloudflare's FAQ; it works because the URL returns 200 with no redirect), and `connect-src` has the origin it sends to (`https://cloudflareinsights.com/cdn-cgi/rum`). The token is in an attribute (`data-cf-beacon`) of a script with a `src`, not in an inline script, so no hash is needed. The console greeting (F.1, `src/lib/console-greeting.ts`) is one more inline script, whose hash the build adds like all the others (one hash, since the text is the same on every page). The CSP line is 784 of 2,000 characters (838 on a doodle day).

**How the hashes are generated:** Astro inlines a few scripts and styles into the HTML: the anti-flash script (must stay the first inline script in `<head>`), the scripts of the theme button and the copy button (smaller than Vite's inline limit), components' `<style>`, and the `@font-face` of `<Font />`. Their content changes with every code change, so the hashes aren't written by hand: a small integration (`scripts/csp/csp.mts`, registered in `astro.config.mjs`) runs at the end of every `astro build`, computes a SHA-256 for every inline `<script>` and `<style>` in every page in `dist/`, and writes the policy to `dist/_headers` in place of a placeholder line. The placeholder in `public/_headers` is `default-src 'none'`: if the step doesn't run, the site breaks visibly instead of going live without a CSP. The build fails if the HTML has something a hash can't allow (`style="..."`, `onclick=` and the like, `javascript:`), or if `_headers` goes over Cloudflare's limits (2,000 characters per line, 100 rules).

**Alternatives considered:**
- **Astro's built-in CSP (`security.csp`):** on a static site with no adapter it writes only a `<meta>`. A meta doesn't support `frame-ancestors`, doesn't apply to what comes before it in `<head>` (the anti-flash script must be first), and doesn't hash `is:inline` scripts. On top of that, a header and a meta together are two policies, and the browser enforces both. Rejected.
- **Moving the scripts out to files** (`assetsInlineLimit: 0`) so `'self'` covers them: adds requests on the render path (hurts LCP), and the anti-flash script and the font CSS are still inline, so hashes are still needed. Rejected.

**`upgrade-insecure-requests` isn't included:** all the URLs on the site are relative and same-origin, and `'self'` on an HTTPS page matches only HTTPS. It would also break the tests against `http://127.0.0.1`. There's no reporting endpoint (`report-to`), since the site is static.

#### Other headers
- **Permissions-Policy:** blocks features the site doesn't use (camera, microphone, location, payments, USB etc.). The clipboard isn't blocked (the copy button).
- **Cross-Origin-Opener-Policy: same-origin.**
- **X-Frame-Options: DENY:** duplicates `frame-ancestors 'none'`, for old browsers. It costs nothing.
- **Strict-Transport-Security: max-age=31536000:** on workers.dev it adds nothing (the whole `.dev` suffix is on the HSTS preload list), but it matters if the domain is `.com`. No `includeSubDomains` and `preload` until the domain is decided (Task 4.2).
- Kept: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Robots-Tag: noindex` until the move to a domain.
- **`X-Clue` on `/favicon.ico`:** not a security header. A clue in the CTF chain (F.2). The text comes from `src/lib/ctf.mts`, so it isn't written in `public/_headers`: a small integration (`scripts/ctf/ctf-headers.mts`) adds the rule to `dist/_headers` and runs before the CSP step, so the check of Cloudflare's limits covers it too. The `/*` rule still applies to the file. The extra line in the console greeting (clue 1) changed its hash but not the length of the CSP line (still 730 of 2,000).
- **The 404 game (F.3)** didn't change the policy: the loader and the game file are JS files in `/_astro/` (covered by `'self'`), with no inline script and no `style` attributes, and the colors are read from the tokens in JS. The line stayed at 730 of 2,000.
- **The doodles (F.4)** change the policy only on a doodle day: the loader and the animation file are JS files in `/_astro/`, and their styling is a `<style is:inline>` that appears only when the doodle is shown, so it gets one more hash in that day's build (the line is 784 of 2,000; on other days 730). The animation uses the Web Animations API, which isn't subject to `style-src`, so there are no `style` attributes.
- **Motion (task 3.4)** added one inline script, the homepage's section entrance, so one more hash: the line went from 730 to 784 of 2,000 (from 784 to 838 on a doodle day). The rest is CSS in the site's stylesheet (covered by `'self'`) and a few lines in the theme toggle's existing script. No `style` attributes: the script only sets a `data-reveal` value, and the View Transitions aren't subject to `style-src`.

#### Testing
- `tests/csp.test.ts` checks on `dist/` that every inline script and style on every page (including 404) has a hash in the policy, and that the anti-flash script's hash is recomputed from `themeInitScript`.
- The e2e tests run against `wrangler dev` and not against `astro preview`, which doesn't send `_headers`. That way all the tests run with the real CSP, and one test verifies that an injected inline script is blocked.
- **Cloudflare doesn't inject anything** right now (automatic Web Analytics, email obfuscation, Rocket Loader): checked on the live site. If one of them is turned on, the policy must allow it or it must stay off. Check again on the move to a domain (Task 4.2), since a zone can turn them on.
- **Web Analytics (Task 2.15):** the beacon is embedded by hand (not injected by Cloudflare), so it's in the HTML and the tests see it. `tests/e2e/analytics.spec.ts` verifies in the browser that the CSP allows it, and a control test verifies that without the URL in the policy it's blocked.
- **Later:** the contact form (Task 3.3) will need `form-action 'self'`, and Turnstile will need `https://challenges.cloudflare.com` in `script-src` and `frame-src`.

---

## 13. Hosting, domain and CI/CD

### 13.1 Hosting: Cloudflare

**Why Cloudflare:**
- **Everything in one place:** hosting, the form's function, Turnstile, analytics and the domain.
- **Astro's home:** Cloudflare acquired Astro in January 2026. Astro stays open source and works on every platform.
- **Unlimited bandwidth** for static files on the free plan, and commercial use is allowed.
- **Cost: ₪0.** On the free plan there are no overage charges; the service simply stops.

**Considered:** Vercel. Excellent and free too, with a very convenient interface, but it's built mainly around Next.js, and the spam protection and the analytics would have been with other providers. GitHub Pages was rejected because it doesn't support server functions (the form).

**Portability:** the build runs in GitHub Actions, and the hosting only serves the ready files. Moving to another platform in the future is a matter of an hour.

**URLs with no `/` at the end:** the canonical URL is `/resume`, so `html_handling` is set to `drop-trailing-slash` and `trailingSlash` to `'never'`, so internal links get a 200 directly, with no needless redirect to `/resume/` (Cloudflare's default).

**404 page:** `not_found_handling` is set to `404-page`, so an unknown URL gets `404.html` with status 404 (Cloudflare's default is an empty 404). The status must stay 404 and not 200, because a soft 404 hurts SEO.

### 13.2 Domain
- **The decision will be made at the end of the work.** Meanwhile the site is available at Cloudflare's free URL.
- **Candidates:** `shaharasher.dev`, `shaharasher.com`.
- **Bought through Cloudflare Registrar:** at cost, with no markup, and renewal at the same price. `.dev` costs about $10–15 a year.
- **After buying it:** update the link on LinkedIn, in the GitHub profile and in `resume.yaml`. On the site: change `site` in `astro.config.mjs` (one line), and remove `X-Robots-Tag: noindex` from `public/_headers`.

### 13.3 CI/CD (GitHub Actions)

**One workflow, four triggers:**
| Trigger | When | Why |
|---|---|---|
| `push` to `main` | On every change | A regular deploy |
| `pull_request` | On every PR | Build and checks only, no deploy |
| `schedule` | Once a day | Pulling new projects from GitHub, and picking the day's doodle (F.4) |
| `workflow_dispatch` | Manual | An immediate update |

**Build steps:**
1. Install dependencies (Node, `libreoffice-writer` + `fonts-liberation` on `ubuntu-24.04`), and verify
   that `fc-match Arial` resolves to Liberation Sans
2. Validate `resume.yaml` against the schema
3. Generate the Word file from the YAML (`create_cv.js`)
4. Convert the Word file to PDF (LibreOffice) + check that it's one page
5. Pull the project data from the GitHub API (with `GITHUB_TOKEN`) + check the descriptions
6. Astro build, at the end of which the CSP is written to `dist/_headers` ([§12](#12-privacy-security-and-confidentiality)), and the PDF is copied to `dist/resume.pdf` (`publish-pdf.ts`). `_headers` serves it
   `inline` with the file name `Shahar_Asher_CV.pdf`
7. Checks: lint, type-check, that the phone doesn't appear in the site's files
8. End-to-end tests in a real browser (Playwright, `npm run test:e2e`, headless Chromium) against the build
   itself, served by `wrangler dev` with the real headers. If they fail there's no deploy, and the report is kept as an artifact for 7 days
9. **Only on `main`** (push, schedule, manual run): Deploy to Cloudflare

**The daily build:** scheduled for 03:17 UTC, but GitHub sometimes starts it hours later (in November 2026 at about 11:00 UTC). The doodles are shown from the day before to the day after, so the delay doesn't miss them. **The 60-day rule:** on a public repo GitHub turns off scheduled workflows after 60 days with no activity in the repo, so a quiet period would silently stop the daily build (no doodles and no project updates); this will be handled before or at launch (Task 4.2b in plan.md).

**The e2e step locally on Linux (Task 2.20):** `npm run test:e2e:linux` runs step 8 in Docker (the official Playwright image at the project's version, CI's fonts, `CI=true`) against the build made on Windows, because fonts and text layout differ between the two systems and a Linux-only failure used to cost a push and a CI run. It's a local mirror, not a replacement: CI's Linux run stays the gate.

**The doodle build (F.4):** after the build, an extra step (`npm run doodle:build`) runs `astro build` alone with a forced doodle (`DOODLE=pi-day`) into the `dist-doodle/` folder, for the tests (`npm run check` and the e2e). It uses the main build's outputs and takes seconds. The deploy reads only `dist/` (`wrangler.jsonc`), and a build into `dist/` fails when `DOODLE` is set, so a forced doodle can't reach the site.

**Pull Requests:** run build and checks only (including `fc-match`), with no deploy and no preview deployment,
at this stage. A push to another branch doesn't run the workflow by itself (so a PR doesn't run twice); the PR runs it.

**Workflow:** a change reaches `main` only through a branch and a PR whose `build` check passed (squash merge), and that is up to date with `main`. A ruleset on `main` enforces this once the repo is public; until then a local hook (`.githooks/pre-push`) blocks a push to `main`.

---

## 14. Project structure

The top level only, one line per folder. File-level details are in the directory map in CLAUDE.md.

```
./
├── CLAUDE.md, README.md, astro.config.mjs, wrangler.jsonc   # instructions, setup, Astro and Cloudflare config
├── .github/workflows/       # deploy.yml: build, checks, e2e, deploy from main only
├── .githooks/               # pre-commit (phone check) + pre-push (refuses pushes to main)
├── docs/                    # this design doc + plan.md (the task list and status)
├── public/                  # _headers template, OG image, site icons
├── scripts/
│   ├── cv/                  # resume.yaml → Word → PDF + the one-page check
│   ├── github/              # GitHub fetcher → src/data/projects.json
│   ├── og/                  # OG image + site icons (npm run og)
│   ├── checks/              # site checks (phone/email not in dist/ etc.)
│   ├── csp/                 # writes the CSP with hashes into dist/_headers
│   ├── ctf/                 # adds the CTF's X-Clue rule to dist/_headers (F.2)
│   ├── doodles/             # doodle builds and screenshots, the guard on dist/ (F.4)
│   └── git/                 # hook installer + pre-push policy
├── src/
│   ├── data/                # resume.yaml ⭐ + schemas (projects.json generated, not in git)
│   ├── lib/                 # validated data for components (resume, projects, seo, theme…)
│   │   ├── game/            # the 404 game (F.3)
│   │   ├── doodles/         # the doodles (F.4)
│   │   └── ctf.mts          # the CTF chain's clues (F.2)
│   ├── components/          # .astro components
│   │   └── islands/         # React islands: ContactForm (planned, Milestone 3)
│   ├── layouts/             # BaseLayout (ArticleLayout planned, Milestone 3)
│   ├── pages/               # index, resume, 404, sitemap.xml, robots.txt, .well-known/
│   │                        #   projects/, case-studies/, api/contact (planned, Milestone 3)
│   ├── content/             # MDX deep-dive pages and case studies (planned, Milestone 3)
│   └── styles/              # global.css: design tokens
└── tests/                   # node:test (npm test); e2e/ Playwright; fixtures/, helpers/
```

---

## 15. Analytics

**The choice: Cloudflare Web Analytics.** Free, privacy-friendly, and needs no cookie banner.

**Why there's no cookie banner:** Cloudflare Web Analytics stores nothing in the browser and doesn't identify visitors. In Cloudflare's words: "does not use any client-side state, such as cookies or localStorage, to collect usage metrics" and "We also don't 'fingerprint' individuals via their IP address, User Agent string, or any other data" ([cloudflare.com/web-analytics](https://www.cloudflare.com/web-analytics/)), and also "does not collect or use your visitors' personal data" ([developers.cloudflare.com/web-analytics/about](https://developers.cloudflare.com/web-analytics/about/)). Also checked in the code of `beacon.min.js` itself (2026-11-13): it has no `document.cookie` and no `localStorage`. The site itself stores only the theme choice in `localStorage`, which is a preference the user asked for, not tracking. So there's nothing to ask consent for.

**How it's wired (Task 2.15):**
- The site is on workers.dev and not in a Cloudflare zone, so Cloudflare can't inject the beacon. The manual snippet from the dashboard is used: `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "…"}'>`, last before `</body>` in `BaseLayout`, so on every page including the 404 (visits to the 404 show which broken links people arrive from).
- `type="module"` as in the dashboard's snippet: a module script loads without blocking rendering and runs after parsing, like `defer`.
- The token is a constant in `src/lib/analytics.ts`. It isn't a secret: it appears in the source of every page.
- **Only in the production build** (`import.meta.env.PROD`): `npm run dev` doesn't load it. A local build (`wrangler dev`, `npm run preview`) does load it, but a report from `127.0.0.1` probably isn't counted, because Cloudflare compares the hostname with the site set in the dashboard (FAQ). This wasn't tested with a real request.
- **The tests don't send visits:** all the e2e tests and screenshots go through `tests/e2e/fixtures.ts`, which stops every request to `*.cloudflareinsights.com` before the network. A test in `npm test` fails if a spec doesn't use it.
- **No SRI:** Cloudflare doesn't pin versions of the beacon, so there's no stable hash.
- **The JS budget:** the beacon counts toward the 30KB gzipped budget. It's real JS that every visitor downloads. 10,274 bytes gzipped (31,853 uncompressed) when measured on 2026-11-13, and in the tests it's counted as 11KB, because the file isn't pinned and can grow. On the homepage: 1.24KB of the site + 11KB = 12.24KB.
- The data shows up in the dashboard after a few minutes.

**What's measured:**
- How many people visit, and from where (LinkedIn? search? direct?)
- **Resume downloads**: the best measure that the site works
- Visits to the deep-dive pages
- Clicks on LinkedIn and GitHub

---

## 16. Roadmap by phase

The phases and what each one means. Status, tasks and their order are tracked in `docs/plan.md` (Milestones 1–2 = Phases 0–1, Milestone 3 = Phase 2, Milestone 4 = Phase 3).

### Phase 0: Prep (before code)
The repos get their descriptions and topics ([§6.5](#65-the-repos-and-their-topics)), a Cloudflare account is opened, and the Hero sentence is written.

### Phase 1: MVP
Everything a recruiter needs, live at Cloudflare's free URL: the scaffold, design tokens and theme, `resume.yaml` driving the Word/PDF and the site, projects from GitHub, the homepage, the `/resume` page, SEO and security headers, CI/CD with the daily build, and analytics.

### Phase 2: Depth
What the hiring manager and the interviewer read: the Log Analytics Platform page with a static diagram, the migration case study, the contact form (function + Turnstile), and the subtle animations + View Transitions.

### Phase 3: Official launch
A domain is chosen and bought, the links on LinkedIn, GitHub and in `resume.yaml` are updated, and a final check (Lighthouse, mobile, contrast, all the links) is done.

---

## 17. Working with Claude Code

### 17.1 `CLAUDE.md`
A file at the project root that Claude Code reads in every session. It holds the goal and audience, the stack and commands, the directory map, the hard rules (resume content only in `resume.yaml`, the phone never on the site, Taboola confidentiality and the rest), the design and motion rules, the quality targets, how to work and the definition of done. The rules live there, not here: this doc keeps the decisions and their reasons.

### 17.2 Way of working
The flow in brief (the exact rules are in CLAUDE.md, "How to work"):

1. **One task at a time**, in the order of `docs/plan.md`.
2. **Plan mode first:** Claude Code proposes a plan, and you approve it and then every file edit.
3. **UI tests and visual checks:** behavior that needs a real browser (keyboard, focus, saving the theme, fonts)
   is tested by permanent Playwright tests in `tests/e2e/`, which also run in CI before deploy. On top of that, review
   screenshots (`npm run screenshots`) at 375px and 1280px, in both color modes, are checked by eye. There's no automatic
   screenshot comparison: font rendering differs between Windows and Linux.
4. **You commit, through a PR:** Claude Code never commits. It proposes the commit message and the commands; you commit on a branch, open a PR, and once the `build` check passes it's squash merged into `main`.
5. **Your content:** Claude Code can help with wording, but the final text should sound like you.

### 17.3 Updating the resume
See [§7.3](#73-the-new-way-of-working). The steps are in CLAUDE.md ("Updating the resume").

---

## 18. Backlog: future ideas

| Idea | Why maybe | Note |
|---|---|---|
| **Animated Kafka diagram** | Shows an understanding of rebalance, at-least-once and hot partitions instead of just claiming it. Opens a conversation in an interview | The most impressive thing, and also the longest to build |
| **Engineering Notes (blog)** | 2–3 technical posts give material for conversation in interviews | Astro's structure supports it with no changes |
| **A color picker for the visitor** | A small, playful detail: color circles the visitor can pick, saved on their side | Blue stays the default |
| **Targeted resume versions** | Tag highlights in the YAML and generate a version per type of role | Possible thanks to the YAML |
| **A live Log Analytics demo** | Java that really runs in production | Needs a paid server |
| **Lighthouse CI** | An automatic performance check on every PR | |
