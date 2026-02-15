// ABOUTME: Tests for the ICS parser module.
// ABOUTME: Covers parseICS, getEventsForYear, isDateInEvent, filterEvents, expandRecurring, and replaceDemoYearSlugs.
import { describe, it, expect } from 'vitest';
import { parseICS, getEventsForYear, isDateInEvent, filterEvents, expandRecurring, replaceDemoYearSlugs } from '../src/ics-parser.js';

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

const MIXED_CALENDAR_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART:20260601T090000Z
DTEND:20260601T170000Z
SUMMARY:Dentist
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260715
DTEND;VALUE=DATE:20260716
SUMMARY:Birthday
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260714
DTEND;VALUE=DATE:20260718
SUMMARY:Vacation
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260901
SUMMARY:Reminder
END:VEVENT
END:VCALENDAR`;

describe('filterEvents', () => {
  it('drops timed (non-all-day) events', () => {
    const events = parseICS(TIMED_EVENT_ICS);
    const filtered = filterEvents(events);
    expect(filtered).toHaveLength(0);
  });

  it('keeps multi-day all-day events', () => {
    const events = parseICS(ALL_DAY_EVENT_ICS);
    const filtered = filterEvents(events);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].summary).toBe('Vacation');
  });

  it('drops single-day all-day events by default', () => {
    const singleDayIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260715
DTEND;VALUE=DATE:20260716
SUMMARY:Birthday
END:VEVENT
END:VCALENDAR`;
    const events = parseICS(singleDayIcs);
    const filtered = filterEvents(events);
    expect(filtered).toHaveLength(0);
  });

  it('includes single-day all-day events when includeSingleDay is true', () => {
    const singleDayIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260715
DTEND;VALUE=DATE:20260716
SUMMARY:Birthday
END:VEVENT
END:VCALENDAR`;
    const events = parseICS(singleDayIcs);
    const filtered = filterEvents(events, { includeSingleDay: true });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].summary).toBe('Birthday');
  });

  it('drops events with no DTEND by default (single-day)', () => {
    const events = parseICS(NO_DTEND_ICS);
    const filtered = filterEvents(events);
    expect(filtered).toHaveLength(0);
  });

  it('includes events with no DTEND when includeSingleDay is true', () => {
    const events = parseICS(NO_DTEND_ICS);
    const filtered = filterEvents(events, { includeSingleDay: true });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].summary).toBe('Single Day');
  });

  it('filters a busy shared calendar to only multi-day all-day events', () => {
    const events = parseICS(MIXED_CALENDAR_ICS);
    const filtered = filterEvents(events);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].summary).toBe('Vacation');
  });

  it('includes single-day all-day from a mixed calendar when opted in', () => {
    const events = parseICS(MIXED_CALENDAR_ICS);
    const filtered = filterEvents(events, { includeSingleDay: true });
    expect(filtered).toHaveLength(3);
    const summaries = filtered.map(e => e.summary).sort();
    expect(summaries).toEqual(['Birthday', 'Reminder', 'Vacation']);
  });

  it('keeps multi-day all-day events spanning year boundary', () => {
    const events = parseICS(YEAR_SPANNING_ICS);
    const filtered = filterEvents(events);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].summary).toBe('Holiday Break');
  });
});

const WEEKLY_RECURRING_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260105
DTEND;VALUE=DATE:20260106
SUMMARY:Weekly Standup
RRULE:FREQ=WEEKLY;COUNT=4
END:VEVENT
END:VCALENDAR`;

const MONTHLY_MULTIDAY_RECURRING_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260105
DTEND;VALUE=DATE:20260108
SUMMARY:Quarterly Offsite
RRULE:FREQ=MONTHLY;COUNT=3
END:VEVENT
END:VCALENDAR`;

const UNBOUNDED_RECURRING_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260105
DTEND;VALUE=DATE:20260106
SUMMARY:Every Monday
RRULE:FREQ=WEEKLY;BYDAY=MO
END:VEVENT
END:VCALENDAR`;

const MIXED_RECURRING_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260714
DTEND;VALUE=DATE:20260718
SUMMARY:Vacation
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260105
DTEND;VALUE=DATE:20260106
SUMMARY:Weekly Thing
RRULE:FREQ=WEEKLY;COUNT=3
END:VEVENT
END:VCALENDAR`;

describe('expandRecurring', () => {
  it('expands a recurring event into individual occurrences', () => {
    const events = parseICS(WEEKLY_RECURRING_ICS);
    const expanded = expandRecurring(events, new Date(2026, 0, 1), new Date(2026, 11, 31));
    expect(expanded).toHaveLength(4);
    expect(expanded[0].summary).toBe('Weekly Standup');
    expect(expanded[0].startDate.getDate()).toBe(5);
    expect(expanded[1].startDate.getDate()).toBe(12);
    expect(expanded[2].startDate.getDate()).toBe(19);
    expect(expanded[3].startDate.getDate()).toBe(26);
  });

  it('computes correct end dates for multi-day recurring events', () => {
    const events = parseICS(MONTHLY_MULTIDAY_RECURRING_ICS);
    const expanded = expandRecurring(events, new Date(2026, 0, 1), new Date(2026, 11, 31));
    expect(expanded).toHaveLength(3);
    // First occurrence: Jan 5-7 (DTEND Jan 8 minus 1 for all-day)
    expect(expanded[0].startDate.getDate()).toBe(5);
    expect(expanded[0].endDate.getDate()).toBe(7);
    // Second: Feb 5-7
    expect(expanded[1].startDate.getMonth()).toBe(1);
    expect(expanded[1].startDate.getDate()).toBe(5);
    expect(expanded[1].endDate.getDate()).toBe(7);
  });

  it('caps unbounded recurrences at the range end', () => {
    const events = parseICS(UNBOUNDED_RECURRING_ICS);
    const expanded = expandRecurring(events, new Date(2026, 0, 1), new Date(2026, 0, 31));
    // Jan 2026 has Mondays on 5, 12, 19, 26
    expect(expanded.length).toBe(4);
    for (const e of expanded) {
      expect(e.startDate.getMonth()).toBe(0);
    }
  });

  it('passes through non-recurring events unchanged', () => {
    const events = parseICS(ALL_DAY_EVENT_ICS);
    const expanded = expandRecurring(events, new Date(2026, 0, 1), new Date(2026, 11, 31));
    expect(expanded).toHaveLength(1);
    expect(expanded[0].summary).toBe('Vacation');
  });

  it('handles a mix of recurring and non-recurring events', () => {
    const events = parseICS(MIXED_RECURRING_ICS);
    const expanded = expandRecurring(events, new Date(2026, 0, 1), new Date(2026, 11, 31));
    // 1 non-recurring + 3 recurring occurrences
    expect(expanded).toHaveLength(4);
    const summaries = expanded.map(e => e.summary);
    expect(summaries.filter(s => s === 'Weekly Thing')).toHaveLength(3);
    expect(summaries.filter(s => s === 'Vacation')).toHaveLength(1);
  });

  it('excludes occurrences outside the given range', () => {
    const events = parseICS(WEEKLY_RECURRING_ICS);
    // Range only covers first 2 weeks of Jan
    const expanded = expandRecurring(events, new Date(2026, 0, 1), new Date(2026, 0, 14));
    expect(expanded).toHaveLength(2);
  });

  it('preserves isAllDay on expanded occurrences', () => {
    const events = parseICS(WEEKLY_RECURRING_ICS);
    const expanded = expandRecurring(events, new Date(2026, 0, 1), new Date(2026, 11, 31));
    for (const e of expanded) {
      expect(e.isAllDay).toBe(true);
    }
  });

  it('includes only the first occurrence when includeRecurring is false', () => {
    const events = parseICS(MIXED_RECURRING_ICS);
    const expanded = expandRecurring(events, new Date(2026, 0, 1), new Date(2026, 11, 31), { includeRecurring: false });
    // 1 non-recurring Vacation + 1 first occurrence of Weekly Thing
    expect(expanded).toHaveLength(2);
    const summaries = expanded.map(e => e.summary).sort();
    expect(summaries).toEqual(['Vacation', 'Weekly Thing']);
  });

  it('includes all occurrences by default', () => {
    const events = parseICS(MIXED_RECURRING_ICS);
    const expanded = expandRecurring(events, new Date(2026, 0, 1), new Date(2026, 11, 31));
    expect(expanded).toHaveLength(4);
  });

  it('keeps only first occurrence when includeRecurring is false for a purely recurring calendar', () => {
    const events = parseICS(WEEKLY_RECURRING_ICS);
    const expanded = expandRecurring(events, new Date(2026, 0, 1), new Date(2026, 11, 31), { includeRecurring: false });
    expect(expanded).toHaveLength(1);
    expect(expanded[0].startDate.getDate()).toBe(5);
  });

  it('first occurrence of recurring event is not marked as recurring for filtering', () => {
    const events = parseICS(WEEKLY_RECURRING_ICS);
    const expanded = expandRecurring(events, new Date(2026, 0, 1), new Date(2026, 11, 31), { includeRecurring: false });
    expect(expanded[0].isAllDay).toBe(true);
  });
});

describe('replaceDemoYearSlugs', () => {
  it('replaces {YEAR} with the given year', () => {
    const input = 'DTSTART;VALUE=DATE:{YEAR}0309';
    expect(replaceDemoYearSlugs(input, 2026)).toBe('DTSTART;VALUE=DATE:20260309');
  });

  it('replaces {YEAR-1} with the previous year', () => {
    const input = 'DTSTART;VALUE=DATE:{YEAR-1}1222';
    expect(replaceDemoYearSlugs(input, 2026)).toBe('DTSTART;VALUE=DATE:20251222');
  });

  it('replaces {YEAR+1} with the next year', () => {
    const input = 'DTEND;VALUE=DATE:{YEAR+1}0103';
    expect(replaceDemoYearSlugs(input, 2026)).toBe('DTEND;VALUE=DATE:20270103');
  });

  it('handles multiple slugs in the same text', () => {
    const input = `DTSTART;VALUE=DATE:{YEAR-1}1222
DTEND;VALUE=DATE:{YEAR}0103
SUMMARY:Holiday Break`;
    const result = replaceDemoYearSlugs(input, 2027);
    expect(result).toContain('20261222');
    expect(result).toContain('20270103');
  });

  it('leaves text without slugs unchanged', () => {
    const input = 'DTSTART;VALUE=DATE:20260309';
    expect(replaceDemoYearSlugs(input, 2026)).toBe(input);
  });

  it('produces parseable ICS when applied to a demo file', () => {
    const demoIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:{YEAR}0714
DTEND;VALUE=DATE:{YEAR}0718
SUMMARY:Vacation
END:VEVENT
END:VCALENDAR`;
    const resolved = replaceDemoYearSlugs(demoIcs, 2028);
    const events = parseICS(resolved);
    expect(events).toHaveLength(1);
    expect(events[0].startDate.getFullYear()).toBe(2028);
    expect(events[0].startDate.getMonth()).toBe(6);
  });
});
