// ABOUTME: Tests for Czech public holiday calculation and lookup functions.
// ABOUTME: Covers static holiday generation, Easter computation, and date matching.

import { describe, it, expect } from 'vitest';
import { getStaticHolidays, isHoliday } from '../src/holidays.js';

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
