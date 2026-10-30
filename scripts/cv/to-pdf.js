// Converts the generated resume .docx to PDF with LibreOffice.
//
// Usage: node scripts/cv/to-pdf.js [input.docx]
// Default: .generated/cv/Shahar_Asher_CV.docx -> .generated/cv/Shahar_Asher_CV.pdf
//
// soffice is resolved in this order: SOFFICE_PATH env var -> the default Windows install path ->
// plain `soffice` on PATH (what CI uses).

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { RESUME_DOCX } = require('./paths');

const WINDOWS_DEFAULT = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';

// Arguments are injectable for tests. Throws if SOFFICE_PATH points at a missing file.
function resolveSoffice({ env = process.env, platform = process.platform, exists = fs.existsSync } = {}) {
  if (env.SOFFICE_PATH) {
    if (!exists(env.SOFFICE_PATH)) throw new Error(`SOFFICE_PATH is set but does not exist: ${env.SOFFICE_PATH}`);
    return env.SOFFICE_PATH;
  }
  if (platform === 'win32' && exists(WINDOWS_DEFAULT)) return WINDOWS_DEFAULT;
  return 'soffice';
}

function main() {
  const inputPath = path.resolve(process.argv[2] || RESUME_DOCX);
  const outDir = path.dirname(inputPath);
  const outputPath = path.join(outDir, `${path.parse(inputPath).name}.pdf`);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}. Run create_cv.js first.`);
    process.exit(1);
  }

  // Remove a stale PDF so a silent LibreOffice failure can't pass for success.
  fs.rmSync(outputPath, { force: true });

  let soffice;
  try {
    soffice = resolveSoffice();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const result = spawnSync(soffice, ['--headless', '--convert-to', 'pdf', '--outdir', outDir, inputPath], {
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`Could not run soffice (${soffice}): ${result.error.message}`);
    console.error('Install LibreOffice 24.2+ or set SOFFICE_PATH to soffice(.exe).');
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`soffice exited with code ${result.status}.`);
    process.exit(1);
  }
  if (!fs.existsSync(outputPath)) {
    console.error(`soffice finished but ${outputPath} was not created.`);
    console.error('If LibreOffice is open, close it and try again.');
    process.exit(1);
  }

  console.log(`Created ${outputPath}`);
}

if (require.main === module) main();

module.exports = { resolveSoffice, WINDOWS_DEFAULT };
