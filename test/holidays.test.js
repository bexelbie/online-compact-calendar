// ABOUTME: Tests for public holiday calculation, lookup, and country list functions.
// ABOUTME: Covers static holiday generation, Easter computation, date matching, and API exports.

import { describe, it, expect } from 'vitest';
import { getStaticHolidays, isHoliday, fetchAvailableCountries, fetchHolidays, evictStaleCache, computeEasterSunday } from '../src/holidays.js';

describe('getStaticHolidays', () => {
  it('returns 13 holidays for 2026', () => {
    const holidays = getStaticHolidays(2026);
    expect(holidays).toHaveLength(13);
  });

  it('includes Jan 1 as Den obnovy samostatného českého státu', () => {
    const holidays = getStaticHolidays(2026);
    const jan1 = holidays.find(
      (h) => h.date.getMonth() === 0 && h.date.getDate() === 1
    );
    expect(jan1).toBeDefined();
    expect(jan1.name).toBe('Den obnovy samostatného českého státu');
  });

  it('has Good Friday on April 3 and Easter Monday on April 6 for 2026', () => {
    const holidays = getStaticHolidays(2026);

    const goodFriday = holidays.find((h) => h.name === 'Velký pátek');
    expect(goodFriday).toBeDefined();
    expect(goodFriday.date.getFullYear()).toBe(2026);
    expect(goodFriday.date.getMonth()).toBe(3); // April
    expect(goodFriday.date.getDate()).toBe(3);

    const easterMonday = holidays.find(
      (h) => h.name === 'Velikonoční pondělí'
    );
    expect(easterMonday).toBeDefined();
    expect(easterMonday.date.getFullYear()).toBe(2026);
    expect(easterMonday.date.getMonth()).toBe(3); // April
    expect(easterMonday.date.getDate()).toBe(6);
  });

  it('computes Easter-based holidays correctly for 2024 (Easter = March 31)', () => {
    const holidays = getStaticHolidays(2024);

    const goodFriday = holidays.find((h) => h.name === 'Velký pátek');
    expect(goodFriday.date.getFullYear()).toBe(2024);
    expect(goodFriday.date.getMonth()).toBe(2); // March
    expect(goodFriday.date.getDate()).toBe(29);

    const easterMonday = holidays.find(
      (h) => h.name === 'Velikonoční pondělí'
    );
    expect(easterMonday.date.getFullYear()).toBe(2024);
    expect(easterMonday.date.getMonth()).toBe(3); // April
    expect(easterMonday.date.getDate()).toBe(1);
  });

  it('all holidays have date and name properties', () => {
    const holidays = getStaticHolidays(2026);
    for (const h of holidays) {
      expect(h).toHaveProperty('date');
      expect(h).toHaveProperty('name');
      expect(h.date).toBeInstanceOf(Date);
      expect(typeof h.name).toBe('string');
    }
  });
});

// Known Easter Sunday dates from astronomical/liturgical records
describe('computeEasterSunday', () => {
  const knownDates = [
    [2020, 3, 12],  // April 12
    [2021, 3, 4],   // April 4
    [2022, 3, 17],  // April 17
    [2023, 3, 9],   // April 9
    [2024, 2, 31],  // March 31
    [2025, 3, 20],  // April 20
    [2026, 3, 5],   // April 5
    [2027, 2, 28],  // March 28
    [2028, 3, 16],  // April 16
    [2029, 3, 1],   // April 1
    [2030, 3, 21],  // April 21
  ];

  for (const [year, month, day] of knownDates) {
    it(`computes Easter ${year} correctly`, () => {
      const easter = computeEasterSunday(year);
      expect(easter.getFullYear()).toBe(year);
      expect(easter.getMonth()).toBe(month);
      expect(easter.getDate()).toBe(day);
    });
  }
});

describe('isHoliday', () => {
  const holidays = getStaticHolidays(2026);

  it('returns the holiday object for Jan 1', () => {
    const result = isHoliday(new Date(2026, 0, 1), holidays);
    expect(result).not.toBeNull();
    expect(result.name).toBe('Den obnovy samostatného českého státu');
  });

  it('returns null for Jan 2', () => {
    const result = isHoliday(new Date(2026, 0, 2), holidays);
    expect(result).toBeNull();
  });

  it('ignores time component when comparing dates', () => {
    const dateWithTime = new Date(2026, 0, 1, 14, 30, 45);
    const result = isHoliday(dateWithTime, holidays);
    expect(result).not.toBeNull();
    expect(result.name).toBe('Den obnovy samostatného českého státu');
  });
});

describe('fetchAvailableCountries', () => {
  it('is an async function that returns an array', async () => {
    const result = await fetchAvailableCountries();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('fetchHolidays', () => {
  it('defaults to CZ when no country code is given', async () => {
    const result = await fetchHolidays(2026);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('date');
    expect(result[0]).toHaveProperty('name');
  });

  it('accepts a country code parameter', async () => {
    const result = await fetchHolidays(2026, 'CZ');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('evictStaleCache', () => {
  it('is callable without errors', () => {
    expect(() => evictStaleCache()).not.toThrow();
  });
});
