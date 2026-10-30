// Last step of npm run build: copies the generated resume PDF into dist/ so it's served at the stable
// URL /resume.pdf. public/_headers gives it the Shahar_Asher_CV.pdf file name.
//
// Usage: node scripts/cv/publish-pdf.ts [path/to/resume.pdf] [distDir]
// Default: .generated/cv/Shahar_Asher_CV.pdf → dist/resume.pdf

import fs from 'node:fs';
import path from 'node:path';
import { RESUME_PDF } from './paths.js';

const PUBLISHED_PDF = 'resume.pdf';

const pdfPath = process.argv[2] || RESUME_PDF;
const distDir = process.argv[3] || path.join(import.meta.dirname, '..', '..', 'dist');

if (!fs.existsSync(pdfPath)) {
  console.error(`PDF not found: ${pdfPath}. Run npm run cv first.`);
  process.exit(1);
}

if (!fs.existsSync(distDir)) {
  console.error(`${distDir} not found: run astro build first.`);
  process.exit(1);
}

const target = path.join(distDir, PUBLISHED_PDF);
fs.copyFileSync(pdfPath, target);
console.log(`Published ${pdfPath} → ${target}`);
