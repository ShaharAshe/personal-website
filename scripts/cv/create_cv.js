// Generates the resume Word file from resume.yaml.
// DESIGN lives here. CONTENT lives in resume.yaml. Don't put resume text in this file.
//
// Usage: node --env-file-if-exists=.env scripts/cv/create_cv.js [path/to/resume.yaml] [output.docx]
// Defaults: src/data/resume.yaml -> .generated/cv/Shahar_Asher_Resume.docx
//
// The phone number comes from the CV_PHONE env var, never from resume.yaml or git — this repo is
// public. In CI, CV_PHONE is required. Locally, a missing CV_PHONE just omits the phone and warns.

const { Document, Packer, Paragraph, TextRun, AlignmentType,
        ExternalHyperlink, BorderStyle, TabStopType } = require('docx');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const inputPath = process.argv[2] || path.join(__dirname, '..', '..', 'src', 'data', 'resume.yaml');
const outputPath = process.argv[3] || path.join(__dirname, '..', '..', '.generated', 'cv', 'Shahar_Asher_Resume.docx');

const resume = yaml.load(fs.readFileSync(inputPath, 'utf8'));

const phone = process.env.CV_PHONE;
if (!phone) {
  if (process.env.CI) {
    console.error('CV_PHONE environment variable is required in CI.');
    process.exit(1);
  }
  console.warn('CV_PHONE not set — generating the resume without a phone number.');
}

// ---------- helpers ----------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2025-04" -> "Apr 2025", "2021" -> "2021", missing -> "Present"
function formatDate(value) {
  if (!value) return 'Present';
  const [year, month] = String(value).split('-');
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
}

function dateRange(item) {
  return `${formatDate(item.startDate)} – ${formatDate(item.endDate)}`;
}

// "https://www.linkedin.com/in/x" -> "linkedin.com/in/x"
function displayUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

function link(url) {
  return new ExternalHyperlink({
    children: [new TextRun({ text: displayUrl(url), color: "0563C1", underline: {} })],
    link: url,
  });
}

function sectionHeader(title) {
  return new Paragraph({ style: "SectionHeader", children: [new TextRun(title)] });
}

function titleLine(title, subtitle, dates) {
  return new Paragraph({
    style: "JobTitle",
    children: [
      new TextRun(title),
      new TextRun({ text: ` | ${subtitle}`, bold: false }),
      new TextRun({ text: `\t${dates}`, bold: false, italics: true }),
    ],
  });
}

function bullet(text) {
  return new Paragraph({ style: "BulletPoint", children: [new TextRun(`• ${text}`)] });
}

// ---------- sections ----------

function header(basics, phone) {
  const contact = [];
  const plain = [phone, basics.email].filter(Boolean).join(' | ');
  contact.push(new TextRun(`${plain} | `));
  basics.profiles.forEach((profile, i) => {
    if (i > 0) contact.push(new TextRun(' | '));
    contact.push(link(profile.url));
  });

  return [
    new Paragraph({ style: "Name", children: [new TextRun(basics.name)] }),
    new Paragraph({ style: "ContactInfo", children: contact }),
    new Paragraph({ style: "Summary", children: [new TextRun(basics.summary)] }),
  ];
}

function experience(work) {
  return [
    sectionHeader("EXPERIENCE"),
    ...work.flatMap(job => [
      titleLine(job.position, job.company, dateRange(job)),
      ...job.highlights.map(h => bullet(h.text)),
    ]),
  ];
}

function projects(list) {
  return [
    sectionHeader("PROJECTS"),
    ...list.map(project => {
      const name = project.status ? `${project.name} (${project.status})` : project.name;
      const children = [
        new TextRun("• "),
        new TextRun({ text: `${name}: `, bold: true }),
        new TextRun(project.url ? `${project.description} | ` : project.description),
      ];
      if (project.url) children.push(link(project.url));
      return new Paragraph({ style: "BulletPoint", children });
    }),
  ];
}

function skills(skillList, languages) {
  const rows = skillList.map(s => [s.category, s.items.join(', ')]);
  if (languages && languages.length) {
    rows.push(["Spoken Languages", languages.map(l => `${l.language} (${l.fluency})`).join(', ')]);
  }
  return [
    sectionHeader("SKILLS"),
    ...rows.map(([category, items]) => new Paragraph({
      style: "SkillCategory",
      children: [new TextRun({ text: `${category}: `, bold: true }), new TextRun(items)],
    })),
  ];
}

function education(list) {
  return [
    sectionHeader("EDUCATION"),
    ...list.flatMap(edu => [
      titleLine(edu.degree, edu.institution, dateRange(edu)),
      ...(edu.highlights || []).map(bullet),
    ]),
  ];
}

// ---------- document (design unchanged from the original create_cv.js) ----------

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Arial", size: 22 }
      }
    },
    paragraphStyles: [
      {
        id: "Name",
        name: "Name",
        basedOn: "Normal",
        run: { size: 48, bold: true, font: "Arial" },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 80 } }
      },
      {
        id: "ContactInfo",
        name: "Contact Info",
        basedOn: "Normal",
        run: { size: 20, font: "Arial" },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 200 } }
      },
      {
        id: "SectionHeader",
        name: "Section Header",
        basedOn: "Normal",
        run: { size: 26, bold: true, font: "Arial", color: "2E5090" },
        paragraph: {
          spacing: { before: 280, after: 120 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2E5090" } }
        }
      },
      {
        id: "JobTitle",
        name: "Job Title",
        basedOn: "Normal",
        run: { size: 24, bold: true, font: "Arial" },
        paragraph: {
          spacing: { before: 120, after: 40 },
          tabStops: [{ type: TabStopType.RIGHT, position: 10800 }]
        }
      },
      {
        id: "Summary",
        name: "Summary",
        basedOn: "Normal",
        run: { size: 22, font: "Arial" },
        paragraph: { spacing: { after: 160 }, alignment: AlignmentType.BOTH }
      },
      {
        id: "BulletPoint",
        name: "Bullet Point",
        basedOn: "Normal",
        run: { size: 22, font: "Arial" },
        paragraph: { spacing: { after: 60 }, indent: { left: 360, hanging: 180 } }
      },
      {
        id: "SkillCategory",
        name: "Skill Category",
        basedOn: "Normal",
        run: { size: 22, font: "Arial" },
        paragraph: { spacing: { after: 60 }, indent: { left: 180 } }
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 720, right: 720, bottom: 720, left: 720 }
      }
    },
    children: [
      ...header(resume.basics, phone),
      ...experience(resume.work),
      ...projects(resume.projects),
      ...skills(resume.skills, resume.languages),
      ...education(resume.education),
    ]
  }]
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created ${outputPath}`);
});
