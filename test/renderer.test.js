// ABOUTME: Tests for renderer pure logic functions.
// ABOUTME: Covers computeEventPlacements, detectConflicts, and formatEventDate.
import { describe, it, expect } from 'vitest';
import { computeEventPlacements, detectConflicts, formatEventDate } from '../src/renderer.js';
import { generateYear } from '../src/calendar-grid.js';

function makeEvent(summary, startDate, endDate) {
  return { summary, startDate, endDate, isAllDay: true };
}

const WEEKS_2026 = generateYear(2026);

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

describe('computeEventPlacements', () => {
  it('places a single event in the correct week row', () => {
    // Mar 9-13 2026 is week 11 (Mon Mar 9)
    const events = [makeEvent('Offsite', new Date(2026, 2, 9), new Date(2026, 2, 13))];
    const { placements } = computeEventPlacements(events, WEEKS_2026);

    const placed = placements.filter(p => p !== null);
    expect(placed).toHaveLength(1);
    expect(placed[0].event.summary).toBe('Offsite');
  });

  it('marks ongoing rows for multi-week events', () => {
    // Jun 22 - Jul 3 spans 2 weeks
    const events = [makeEvent('Vacation', new Date(2026, 5, 22), new Date(2026, 6, 3))];
    const { ongoingRows } = computeEventPlacements(events, WEEKS_2026);

    expect(ongoingRows.size).toBeGreaterThanOrEqual(2);
  });

  it('spills second event in same week to an adjacent row', () => {
    // Two events starting in the same week
    const events = [
      makeEvent('Event A', new Date(2026, 2, 9), new Date(2026, 2, 11)),
      makeEvent('Event B', new Date(2026, 2, 10), new Date(2026, 2, 13)),
    ];
    const { placements } = computeEventPlacements(events, WEEKS_2026);

    const placed = placements.filter(p => p !== null);
    expect(placed).toHaveLength(2);
    const summaries = placed.map(p => p.event.summary).sort();
    expect(summaries).toEqual(['Event A', 'Event B']);
  });

  it('returns empty placements for no events', () => {
    const { placements, ongoingRows } = computeEventPlacements([], WEEKS_2026);

    expect(placements.every(p => p === null)).toBe(true);
    expect(ongoingRows.size).toBe(0);
  });

  it('handles event starting before the calendar range', () => {
    // Event starts Dec 2025, ends Jan 2026
    const events = [makeEvent('Holiday', new Date(2025, 11, 22), new Date(2026, 0, 2))];
    const { placements } = computeEventPlacements(events, WEEKS_2026);

    // Should be placed in row 0 (pre-calendar)
    expect(placements[0]).not.toBeNull();
    expect(placements[0].event.summary).toBe('Holiday');
  });

  it('sorts multiple events in same week by start date', () => {
    const events = [
      makeEvent('Later', new Date(2026, 2, 12), new Date(2026, 2, 13)),
      makeEvent('Earlier', new Date(2026, 2, 9), new Date(2026, 2, 10)),
    ];
    const { placements } = computeEventPlacements(events, WEEKS_2026);

    // Find the week where Mar 9 falls — "Earlier" should get the home row
    const homeRow = placements.findIndex(p => p !== null && p.event.summary === 'Earlier');
    const spillRow = placements.findIndex(p => p !== null && p.event.summary === 'Later');
    expect(homeRow).toBeLessThan(spillRow);
  });
});

describe('detectConflicts', () => {
  it('detects overlapping yellow and green events', () => {
    const green = [makeEvent('Green', new Date(2026, 2, 9), new Date(2026, 2, 13))];
    const yellow = [makeEvent('Yellow', new Date(2026, 2, 11), new Date(2026, 2, 15))];

    const conflicts = detectConflicts(yellow, green);
    expect(conflicts.size).toBe(1);
    expect(conflicts.has(yellow[0])).toBe(true);
  });

  it('returns empty set when no overlap', () => {
    const green = [makeEvent('Green', new Date(2026, 2, 9), new Date(2026, 2, 13))];
    const yellow = [makeEvent('Yellow', new Date(2026, 3, 1), new Date(2026, 3, 5))];

    const conflicts = detectConflicts(yellow, green);
    expect(conflicts.size).toBe(0);
  });

  it('detects conflict on exact boundary (same day)', () => {
    const green = [makeEvent('Green', new Date(2026, 2, 9), new Date(2026, 2, 13))];
    const yellow = [makeEvent('Yellow', new Date(2026, 2, 13), new Date(2026, 2, 15))];

    const conflicts = detectConflicts(yellow, green);
    expect(conflicts.size).toBe(1);
  });

  it('handles multiple yellow events, only some conflicting', () => {
    const green = [makeEvent('Green', new Date(2026, 2, 9), new Date(2026, 2, 13))];
    const yellow = [
      makeEvent('Conflict', new Date(2026, 2, 11), new Date(2026, 2, 15)),
      makeEvent('No Conflict', new Date(2026, 5, 1), new Date(2026, 5, 5)),
    ];

    const conflicts = detectConflicts(yellow, green);
    expect(conflicts.size).toBe(1);
    expect(conflicts.has(yellow[0])).toBe(true);
    expect(conflicts.has(yellow[1])).toBe(false);
  });

  it('returns empty set when no events', () => {
    expect(detectConflicts([], []).size).toBe(0);
  });
});
