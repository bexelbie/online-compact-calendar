// ABOUTME: Tests for the ICS parser module.
// ABOUTME: Covers parseICS, getEventsForYear, and isDateInEvent functions.
import { describe, it, expect } from 'vitest';
import { parseICS, getEventsForYear, isDateInEvent } from '../src/ics-parser.js';

const TIMED_EVENT_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART:20260601T090000Z
DTEND:20260603T170000Z
SUMMARY:Conference
END:VEVENT
END:VCALENDAR`;

const ALL_DAY_EVENT_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260714
DTEND;VALUE=DATE:20260718
SUMMARY:Vacation
END:VEVENT
END:VCALENDAR`;

const MULTIPLE_EVENTS_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART:20260601T090000Z
DTEND:20260603T170000Z
SUMMARY:Conference
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260714
DTEND;VALUE=DATE:20260718
SUMMARY:Vacation
END:VEVENT
END:VCALENDAR`;

const NO_DTEND_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260901
SUMMARY:Single Day
END:VEVENT
END:VCALENDAR`;

const YEAR_SPANNING_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20251220
DTEND;VALUE=DATE:20260105
SUMMARY:Holiday Break
END:VEVENT
END:VCALENDAR`;

describe('parseICS', () => {
  it('parses a single timed event with correct fields', () => {
    const events = parseICS(TIMED_EVENT_ICS);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('Conference');
    expect(events[0].startDate).toEqual(new Date('2026-06-01T09:00:00Z'));
    expect(events[0].endDate).toEqual(new Date('2026-06-03T17:00:00Z'));
  });

  it('subtracts one day from DTEND for all-day events', () => {
    const events = parseICS(ALL_DAY_EVENT_ICS);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('Vacation');
    expect(events[0].startDate.getFullYear()).toBe(2026);
    expect(events[0].startDate.getMonth()).toBe(6); // July
    expect(events[0].startDate.getDate()).toBe(14);
    expect(events[0].endDate.getMonth()).toBe(6); // July
    expect(events[0].endDate.getDate()).toBe(17); // 18 minus 1
  });

  it('parses multiple events', () => {
    const events = parseICS(MULTIPLE_EVENTS_ICS);
    expect(events).toHaveLength(2);
    expect(events[0].summary).toBe('Conference');
    expect(events[1].summary).toBe('Vacation');
  });

  it('treats missing DTEND as a single-day event', () => {
    const events = parseICS(NO_DTEND_ICS);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('Single Day');
    expect(events[0].startDate.getDate()).toBe(1);
    expect(events[0].endDate.getDate()).toBe(1);
    expect(events[0].startDate.getMonth()).toBe(events[0].endDate.getMonth());
  });
});

describe('isDateInEvent', () => {
  const event = {
    summary: 'Test',
    startDate: new Date(2026, 6, 14),
    endDate: new Date(2026, 6, 17),
  };

  it('returns true for a date within the range', () => {
    expect(isDateInEvent(new Date(2026, 6, 15), event)).toBe(true);
  });

  it('returns false for a date outside the range', () => {
    expect(isDateInEvent(new Date(2026, 6, 20), event)).toBe(false);
  });

  it('returns true on the start boundary', () => {
    expect(isDateInEvent(new Date(2026, 6, 14), event)).toBe(true);
  });

  it('returns true on the end boundary', () => {
    expect(isDateInEvent(new Date(2026, 6, 17), event)).toBe(true);
  });
});

describe('getEventsForYear', () => {
  it('includes an event spanning across year boundary', () => {
    const events = parseICS(YEAR_SPANNING_ICS);
    const filtered2026 = getEventsForYear(events, 2026);
    expect(filtered2026).toHaveLength(1);
    expect(filtered2026[0].summary).toBe('Holiday Break');
  });

  it('includes the same spanning event in the previous year too', () => {
    const events = parseICS(YEAR_SPANNING_ICS);
    const filtered2025 = getEventsForYear(events, 2025);
    expect(filtered2025).toHaveLength(1);
  });

  it('excludes events from a different year', () => {
    const events = parseICS(TIMED_EVENT_ICS);
    const filtered2025 = getEventsForYear(events, 2025);
    expect(filtered2025).toHaveLength(0);
  });
});
