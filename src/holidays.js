// ABOUTME: Provides public holidays for a given year and country via Nager.Date API.
// ABOUTME: Caches country list and holidays in localStorage with 30-day expiry.

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function cacheSet(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

/**
 * Remove expired cache entries on startup. Scans all localStorage keys
 * matching our prefix and evicts those older than CACHE_TTL_MS.
 */
export function evictStaleCache() {
  try {
    const prefix = 'compact-cal-';
    const keysToCheck = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix) && key !== 'compact-cal-green-url'
          && key !== 'compact-cal-yellow-url' && key !== 'compact-cal-country'
          && key !== 'compact-cal-include-single-day'
          && key !== 'compact-cal-include-recurring') {
        keysToCheck.push(key);
      }
    }
    for (const key of keysToCheck) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const { timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp > CACHE_TTL_MS) {
          localStorage.removeItem(key);
        }
      } catch {
        // Malformed entry — remove it
        localStorage.removeItem(key);
      }
    }
  } catch {
    // localStorage unavailable — ignore
  }
}

/**
 * Fetch the list of available countries from Nager.Date API.
 * Returns [{ countryCode, name }]. Cached for 30 days.
 */
export async function fetchAvailableCountries() {
  const cacheKey = 'compact-cal-countries';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch('https://date.nager.at/api/v3/AvailableCountries');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    cacheSet(cacheKey, data);
    return data;
  } catch {
    return [];
  }
}

/**
 * Parse a "YYYY-MM-DD" string as a local date (not UTC).
 */
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Fetch public holidays from Nager.Date API for a given year and country.
 * Cached per country+year for 30 days. Falls back to static Czech holidays
 * for CZ, or empty array for other countries.
 */
export async function fetchHolidays(year, countryCode = 'CZ') {
  const cacheKey = `compact-cal-holidays-${countryCode}-${year}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return cached.map((entry) => ({
      ...entry,
      date: new Date(entry.date),
    }));
  }

  try {
    const response = await fetch(
      `https://date.nager.at/api/v3/publicholidays/${year}/${countryCode}`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const holidays = data.map((entry) => ({
      date: parseLocalDate(entry.date),
      name: entry.localName,
    }));

    // Store with serializable dates
    const toCache = holidays.map((h) => ({
      date: h.date.toISOString(),
      name: h.name,
    }));
    cacheSet(cacheKey, toCache);

    return holidays;
  } catch {
    if (countryCode === 'CZ') {
      return getStaticHolidays(year);
    }
    return [];
  }
}

/**
 * Calculate Easter Sunday for a given year using the Anonymous Gregorian algorithm.
 */
export function computeEasterSunday(year) {
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
 * Static Czech public holidays (offline fallback for CZ only).
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
 * Returns the holiday object if the given date falls on a holiday, null otherwise.
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
