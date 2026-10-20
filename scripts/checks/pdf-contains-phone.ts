// Fails if the generated resume PDF does not contain the CV_PHONE number, proving the phone really
// made it into the published resume.
//
// Usage: node scripts/checks/pdf-contains-phone.ts [path/to/resume.pdf]
// Default: .generated/cv/Shahar_Asher_Resume.pdf
// Env:   CV_PHONE  skipped with a warning if unset locally; required in CI

import fs from 'node:fs';
import { PDFParse } from 'pdf-parse';
import { RESUME_PDF } from '../cv/paths.js';
import { findPhone, phonePatternForCli } from './phone.ts';

const pdfPath = process.argv[2] || RESUME_PDF;

const pattern = phonePatternForCli('pdf-contains-phone');
if (!pattern) process.exit(0);

if (!fs.existsSync(pdfPath)) {
  console.error(`PDF not found: ${pdfPath}. Run npm run build first.`);
  process.exit(1);
}

const parser = new PDFParse({ data: fs.readFileSync(pdfPath) });
const { text } = await parser.getText();
await parser.destroy();

if (findPhone(text, pattern).length === 0) {
  console.error(`${pdfPath} does not contain the CV_PHONE number.`);
  console.error('Check that CV_PHONE was set when npm run cv generated it.');
  process.exit(1);
}

console.log(`${pdfPath} contains the phone number.`);
