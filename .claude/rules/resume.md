---
paths:
  - "src/data/resume.yaml"
  - "scripts/cv/**"
  - "src/pages/resume.astro"
---

# Resume rules

- `src/data/resume.yaml` follows the JSON Resume structure (https://jsonresume.org/schema), plus a
  `featured: true` flag on work highlights that also appear on the homepage, an optional `bold` list
  on work highlights (terms printed in bold in the PDF only; each must appear in the text), and a
  required `basics.tagline` (one line for the homepage Hero; not in the PDF). Keep that structure.
- The YAML is validated against a schema at build time. If you add a field, update the schema too.
- `scripts/cv/create_cv.js` was verified to produce a PDF pixel-identical to the original resume, and
  updated in Task 2.25 to match the 2026-11-26 CV exactly (the same Word XML except the contact line).
  Its styles, page size, margins and section order are the design. Don't touch them unless asked.
- Dates in the YAML are quoted strings: `"2025-04"` (month) or `"2021"` (year). The generator
  formats them as `Apr 2025` / `2021`, joined by a plain hyphen (`Apr 2025 - Apr 2026`, as in the
  CV); a missing `endDate` renders as `Present`.
- PDF generation: `create_cv.js` writes the `.docx`, then
  `soffice --headless --convert-to pdf` converts it. Use LibreOffice 24.2 or later in CI.
- The PDF must be exactly one page. If an edit makes it two pages, report it and suggest wording
  cuts. Never shrink fonts or margins to make it fit.
- Published file name: `Shahar_Asher_CV.pdf`, served at the stable URL `/resume.pdf`.
- The phone number is **not** a field in `resume.yaml` — this repo is public. `create_cv.js` reads it
  from the `CV_PHONE` environment variable (`.env` locally, a GitHub Actions secret in CI) and never
  writes it anywhere else. In CI, a missing `CV_PHONE` fails the build; locally it just warns and
  omits the phone from the generated PDF/DOCX. The `/resume` page and every other page must not
  render it.
- The `/resume` page renders the same content in the site's design, has a Download PDF button at the
  top, and has a print stylesheet.
