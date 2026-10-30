// Where the resume PDF is served and the name it downloads as, for the "Download Resume" buttons.
//
// The file name is RESUME_BASENAME + ".pdf" from scripts/cv/paths.js, which is CommonJS and can't be
// loaded from src/ (Vite treats it as ESM). tests/hero.test.ts checks this copy matches it, and
// tests/publish-pdf.test.ts checks public/_headers against it, so the three can't drift.

export const RESUME_PDF_URL = '/resume.pdf';
export const RESUME_PDF_FILENAME = 'Shahar_Asher_CV.pdf';
