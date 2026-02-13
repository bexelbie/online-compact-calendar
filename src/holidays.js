// ABOUTME: Provides Czech Republic public holidays for a given year.
// ABOUTME: Fetches from Nager.Date API with fallback to static calculation using Computus.

/**
 * Calculate Easter Sunday for a given year using the Anonymous Gregorian algorithm.
 * Returns a Date object for Easter Sunday.
 */
function computeEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

/**
 * Returns an array of Czech public holidays for the given year.
 * Each entry is { date: Date, name: string }.
 */
export function getStaticHolidays(year) {
  const easter = computeEasterSunday(year);

  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);

  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  return [
    { date: new Date(year, 0, 1), name: 'Den obnovy samostatného českého státu' },
    { date: goodFriday, name: 'Velký pátek' },
    { date: easterMonday, name: 'Velikonoční pondělí' },
    { date: new Date(year, 4, 1), name: 'Svátek práce' },
    { date: new Date(year, 4, 8), name: 'Den vítězství' },
    { date: new Date(year, 6, 5), name: 'Den slovanských věrozvěstů Cyrila a Metoděje' },
    { date: new Date(year, 6, 6), name: 'Den upálení mistra Jana Husa' },
    { date: new Date(year, 8, 28), name: 'Den české státnosti' },
    { date: new Date(year, 9, 28), name: 'Den vzniku samostatného československého státu' },
    { date: new Date(year, 10, 17), name: 'Den boje za svobodu a demokracii' },
    { date: new Date(year, 11, 24), name: 'Štědrý den' },
    { date: new Date(year, 11, 25), name: '1. svátek vánoční' },
    { date: new Date(year, 11, 26), name: '2. svátek vánoční' },
  ];
}

/**
 * Parse a "YYYY-MM-DD" string as a local date (not UTC).
 */
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Fetch Czech public holidays from Nager.Date API.
 * Falls back to static holidays if the request fails.
 */
export async function fetchHolidays(year) {
  try {
    const response = await fetch(
      `https://date.nager.at/api/v3/publicholidays/${year}/CZ`
    );
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    const data = await response.json();
    return data.map((entry) => ({
      date: parseLocalDate(entry.date),
      name: entry.localName,
    }));
  } catch {
    return getStaticHolidays(year);
  }
}

/**
 * Returns the holiday object if the given date falls on a holiday, null otherwise.
 * Compares by year-month-day only (ignores time).
 */
export function isHoliday(date, holidays) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();

  return (
    holidays.find(
      (h) =>
        h.date.getFullYear() === y &&
        h.date.getMonth() === m &&
        h.date.getDate() === d
    ) || null
  );
}
