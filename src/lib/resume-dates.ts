// Resume dates for the site, formatted exactly like the PDF. This is a copy of formatDate/dateRange in
// scripts/cv/format.js: that module is CommonJS, which Vite can't load from src/ (same as paths.js).
// tests/experience.test.ts runs both on the same inputs, so the two can't drift apart.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface DatedItem {
  startDate: string;
  endDate?: string;
}

// A date as shown (label) plus its machine-readable value for <time datetime="...">.
export interface DatePart {
  datetime: string;
  label: string;
}

// end is null when there's no endDate: the item is ongoing and renders as "Present".
export interface DateParts {
  start: DatePart;
  end: DatePart | null;
}

export const PRESENT = 'Present';

// "2025-04" -> "Apr 2025", "2021" -> "2021", missing -> "Present"
export function formatDate(value?: string): string {
  if (!value) return PRESENT;
  const [year, month] = String(value).split('-');
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
}

export function dateRange(item: DatedItem): string {
  return `${formatDate(item.startDate)} – ${formatDate(item.endDate)}`;
}

// The schema's "YYYY-MM" / "YYYY" values are already valid <time datetime> strings.
export function dateParts(item: DatedItem): DateParts {
  return {
    start: { datetime: item.startDate, label: formatDate(item.startDate) },
    end: item.endDate ? { datetime: item.endDate, label: formatDate(item.endDate) } : null,
  };
}
