// Text formatting helpers for create_cv.js. Kept separate so they can be unit-tested without
// generating a document.

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
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

module.exports = { formatDate, dateRange, displayUrl };
