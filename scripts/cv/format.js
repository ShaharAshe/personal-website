// Text formatting helpers for create_cv.js. Kept separate so they can be unit-tested without
// generating a document.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2025-04" -> "Apr 2025", "2021" -> "2021", missing -> "Present"
function formatDate(value) {
  if (!value) return 'Present';
  const [year, month] = String(value).split('-');
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
}

// "Apr 2025 - Apr 2026": a plain hyphen, as in the CV (Task 2.25). src/lib/resume-dates.ts matches it.
function dateRange(item) {
  return `${formatDate(item.startDate)} - ${formatDate(item.endDate)}`;
}

// Splits text into [{ text, bold }] segments, bolding every occurrence of each term.
// "a 6+ b", ["6+"] -> [{ text: "a ", bold: false }, { text: "6+", bold: true }, { text: " b", bold: false }]
function boldSegments(text, terms = []) {
  if (!terms.length) return [{ text, bold: false }];
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'g');
  return text
    .split(re)
    .filter(Boolean)
    .map((part) => ({ text: part, bold: terms.includes(part) }));
}

// "https://www.linkedin.com/in/x" -> "linkedin.com/in/x"
function displayUrl(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

module.exports = { formatDate, dateRange, displayUrl, boldSegments };
