// Which doodle (Task F.4) a build shows, from the build's date. Pure, unit-tested in tests/doodles.test.ts.
//
// The daily CI build (deploy.yml, scheduled 03:17 UTC; GitHub often starts it hours later) picks the doodle, so
// other days ship no doodle markup or JS at all. A doodle shows when the build's UTC date is anywhere from the day
// before its first day to the day after its last, so every time zone sees it on its own date.
//
// Hanukkah: the 8 days from 25 Kislev, from Intl's Hebrew calendar (no dependency). The first candle is lit the
// evening before, which the day-before margin covers.

import { DOODLES, type Doodle, type DoodleId } from './doodles.ts';

const DAY_MS = 86_400_000;

/** Days since 1970-01-01 in UTC. */
export const utcDay = (date: Date) => Math.floor(date.getTime() / DAY_MS);

const dayOf = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day) / DAY_MS;

/** Day of the Programmer: the 256th day of the year (Sep 13, or Sep 12 in a leap year). */
export const programmersDay = (year: number) => dayOf(year, 1, 1) + 255;

const hebrew = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long', timeZone: 'UTC' });

/** The UTC day of 25 Kislev in this Gregorian year (always between late November and late December). */
export function hanukkahStart(year: number): number {
  for (let day = dayOf(year, 11, 15); day <= dayOf(year, 12, 31); day++) {
    const parts = hebrew.formatToParts(new Date(day * DAY_MS));
    const month = parts.find((p) => p.type === 'month')?.value;
    const date = parts.find((p) => p.type === 'day')?.value;
    if (month === 'Kislev' && date === '25') return day;
  }
  throw new Error(`no 25 Kislev found in ${year}`);
}

/** The length of Hanukkah, in days. */
export const HANUKKAH_DAYS = 8;

const LAUNCH_DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The launch date's month and day, or null when it's empty. Throws on anything but a real YYYY-MM-DD date. */
export function parseLaunchDate(launchDate: string): { month: number; day: number } | null {
  if (launchDate === '') return null;
  const match = launchDate.match(LAUNCH_DATE_FORMAT);
  const [year, month, day] = (match?.slice(1) ?? []).map(Number);
  const valid =
    year !== undefined &&
    month !== undefined &&
    day !== undefined &&
    new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === launchDate;
  if (!valid) throw new Error(`LAUNCH_DATE must be empty or a YYYY-MM-DD date, got "${launchDate}"`);
  return { month, day };
}

/** A doodle's days in one Gregorian year, as UTC days (first and last included), or null if it has none. */
export function occurrence(id: DoodleId, year: number, launchDate: string): { first: number; last: number } | null {
  const single = (day: number) => ({ first: day, last: day });
  switch (id) {
    case 'launch': {
      const launch = parseLaunchDate(launchDate);
      return launch ? single(dayOf(year, launch.month, launch.day)) : null;
    }
    case 'new-year':
      return single(dayOf(year, 1, 1));
    case 'pi-day':
      return single(dayOf(year, 3, 14));
    case 'turing':
      return single(dayOf(year, 6, 23));
    case 'programmers-day':
      return single(programmersDay(year));
    case 'halloween':
      return single(dayOf(year, 10, 31));
    case 'hanukkah': {
      const first = hanukkahStart(year);
      return { first, last: first + HANUKKAH_DAYS - 1 };
    }
  }
}

/** The doodle for a build on this date (its UTC day), by priority (the DOODLES order), or null on other days. */
export function doodleForDate(date: Date, launchDate: string): Doodle | null {
  parseLaunchDate(launchDate);
  const today = utcDay(date);
  const year = date.getUTCFullYear();
  for (const doodle of DOODLES) {
    for (const y of [year - 1, year, year + 1]) {
      const days = occurrence(doodle.id, y, launchDate);
      if (days && today >= days.first - 1 && today <= days.last + 1) return doodle;
    }
  }
  return null;
}
