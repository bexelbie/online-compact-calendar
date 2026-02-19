// ABOUTME: Tests for renderer pure logic functions.
// ABOUTME: Covers detectConflicts and formatEventDate.
import { describe, it, expect } from 'vitest';
import { detectConflicts, formatEventDate } from '../src/renderer.js';

function makeEvent(summary, startDate, endDate) {
  return { summary, startDate, endDate, isAllDay: true };
}

describe('formatEventDate', () => {
  it('formats a January date', () => {
    expect(formatEventDate(new Date(2026, 0, 5))).toBe('5-Jan');
  });

  it('formats a December date', () => {
    expect(formatEventDate(new Date(2026, 11, 25))).toBe('25-Dec');
  });

  it('formats single-digit day without padding', () => {
    expect(formatEventDate(new Date(2026, 5, 3))).toBe('3-Jun');
  });

  it('formats all twelve months correctly', () => {
    const expected = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let m = 0; m < 12; m++) {
      expect(formatEventDate(new Date(2026, m, 15))).toBe(`15-${expected[m]}`);
    }
  });
});

describe('detectConflicts', () => {
  it('detects overlapping possible and committed events', () => {
    const committed = [makeEvent('Committed', new Date(2026, 2, 9), new Date(2026, 2, 13))];
    const possible = [makeEvent('Possible', new Date(2026, 2, 11), new Date(2026, 2, 15))];

    const conflicts = detectConflicts(possible, committed);
    expect(conflicts.size).toBe(1);
    expect(conflicts.has(possible[0])).toBe(true);
  });

  it('returns empty set when no overlap', () => {
    const committed = [makeEvent('Committed', new Date(2026, 2, 9), new Date(2026, 2, 13))];
    const possible = [makeEvent('Possible', new Date(2026, 3, 1), new Date(2026, 3, 5))];

    const conflicts = detectConflicts(possible, committed);
    expect(conflicts.size).toBe(0);
  });

  it('detects conflict on exact boundary (same day)', () => {
    const committed = [makeEvent('Committed', new Date(2026, 2, 9), new Date(2026, 2, 13))];
    const possible = [makeEvent('Possible', new Date(2026, 2, 13), new Date(2026, 2, 15))];

    const conflicts = detectConflicts(possible, committed);
    expect(conflicts.size).toBe(1);
  });

  it('handles multiple possible events, only some conflicting', () => {
    const committed = [makeEvent('Committed', new Date(2026, 2, 9), new Date(2026, 2, 13))];
    const possible = [
      makeEvent('Conflict', new Date(2026, 2, 11), new Date(2026, 2, 15)),
      makeEvent('No Conflict', new Date(2026, 5, 1), new Date(2026, 5, 5)),
    ];

    const conflicts = detectConflicts(possible, committed);
    expect(conflicts.size).toBe(1);
    expect(conflicts.has(possible[0])).toBe(true);
    expect(conflicts.has(possible[1])).toBe(false);
  });

  it('returns empty set when no events', () => {
    expect(detectConflicts([], []).size).toBe(0);
  });

  it('detects conflicts across multiple committed calendars', () => {
    const committed = [
      makeEvent('Work', new Date(2026, 2, 9), new Date(2026, 2, 13)),
      makeEvent('Personal', new Date(2026, 5, 1), new Date(2026, 5, 5)),
    ];
    const possible = [
      makeEvent('Family trip', new Date(2026, 2, 12), new Date(2026, 2, 14)),
      makeEvent('Social', new Date(2026, 7, 1), new Date(2026, 7, 5)),
    ];

    const conflicts = detectConflicts(possible, committed);
    expect(conflicts.size).toBe(1);
    expect(conflicts.has(possible[0])).toBe(true);
    expect(conflicts.has(possible[1])).toBe(false);
  });
});
