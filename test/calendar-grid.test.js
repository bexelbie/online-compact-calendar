// ABOUTME: Tests for the compact calendar grid generator.
// ABOUTME: Validates week structure, month markers, and ISO 8601 compliance.

import { describe, it, expect } from 'vitest';
import { generateYear } from '../src/calendar-grid.js';

describe('generateYear', () => {
  it('2026 should produce 53 weeks', () => {
    const weeks = generateYear(2026);
    expect(weeks).toHaveLength(53);
  });

  it('first week of 2026 starts Mon Dec 29 2025 with week number 1', () => {
    const weeks = generateYear(2026);
    const first = weeks[0];
    expect(first.weekNumber).toBe(1);
    expect(first.days[0].getUTCFullYear()).toBe(2025);
    expect(first.days[0].getUTCMonth()).toBe(11); // December
    expect(first.days[0].getUTCDate()).toBe(29);
  });

  it('week containing Feb 1 2026 should have month "February"', () => {
    const weeks = generateYear(2026);
    const febWeek = weeks.find(w =>
      w.days.some(d => d.getUTCMonth() === 1 && d.getUTCDate() === 1 && d.getUTCFullYear() === 2026)
    );
    expect(febWeek).toBeDefined();
    expect(febWeek.month).toBe('February');
  });

  it('every week has exactly 7 days', () => {
    const weeks = generateYear(2026);
    for (const week of weeks) {
      expect(week.days).toHaveLength(7);
    }
  });

  it('days within a week are Mon through Sun in order', () => {
    const weeks = generateYear(2026);
    const expectedDays = [1, 2, 3, 4, 5, 6, 0]; // Mon=1 .. Sun=0
    for (const week of weeks) {
      for (let i = 0; i < 7; i++) {
        expect(week.days[i].getUTCDay()).toBe(expectedDays[i]);
      }
    }
  });

  it('2024 leap year handles Feb 29 correctly', () => {
    const weeks = generateYear(2024);
    const feb29Week = weeks.find(w =>
      w.days.some(d => d.getUTCMonth() === 1 && d.getUTCDate() === 29 && d.getUTCFullYear() === 2024)
    );
    expect(feb29Week).toBeDefined();
    const feb29 = feb29Week.days.find(d => d.getUTCMonth() === 1 && d.getUTCDate() === 29);
    expect(feb29.getUTCFullYear()).toBe(2024);
  });

  it('week numbers are sequential', () => {
    const weeks = generateYear(2026);
    for (let i = 1; i < weeks.length; i++) {
      const prev = weeks[i - 1].weekNumber;
      const curr = weeks[i].weekNumber;
      const isSequential = curr === prev + 1 || (curr === 1 && prev >= 52);
      expect(isSequential, `week ${i}: expected sequential after ${prev}, got ${curr}`).toBe(true);
    }
  });
});
