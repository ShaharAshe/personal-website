// Shared input/output paths for the resume scripts (create_cv.js, to-pdf.js, check-pdf.ts,
// validate-resume.ts). CommonJS so create_cv.js can require it.

const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const RESUME_YAML = path.join(ROOT, 'src', 'data', 'resume.yaml');
const OUTPUT_DIR = path.join(ROOT, '.generated', 'cv');
const RESUME_BASENAME = 'Shahar_Asher_CV';
const RESUME_DOCX = path.join(OUTPUT_DIR, `${RESUME_BASENAME}.docx`);
const RESUME_PDF = path.join(OUTPUT_DIR, `${RESUME_BASENAME}.pdf`);

module.exports = { ROOT, RESUME_YAML, OUTPUT_DIR, RESUME_BASENAME, RESUME_DOCX, RESUME_PDF };
