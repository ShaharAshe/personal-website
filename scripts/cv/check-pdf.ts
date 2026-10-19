// Fails if the resume PDF is not exactly one page.
//
// Usage: node scripts/cv/check-pdf.ts [path/to/resume.pdf]
// Default: .generated/cv/Shahar_Asher_Resume.pdf

import fs from 'node:fs';
import { PDFParse } from 'pdf-parse';
import { RESUME_PDF } from './paths.js';

const pdfPath = process.argv[2] || RESUME_PDF;

if (!fs.existsSync(pdfPath)) {
  console.error(`PDF not found: ${pdfPath}. Run create_cv.js and to-pdf.js first.`);
  process.exit(1);
}

const parser = new PDFParse({ data: fs.readFileSync(pdfPath) });
const { total: pages } = await parser.getInfo();
await parser.destroy();

if (pages !== 1) {
  console.error(`${pdfPath} has ${pages} pages; the resume must be exactly 1.`);
  console.error('Shorten the wording in src/data/resume.yaml. Do not shrink fonts or margins.');
  process.exit(1);
}

console.log(`${pdfPath} is 1 page.`);
