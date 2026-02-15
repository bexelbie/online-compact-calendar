// ABOUTME: Parses ICS (iCalendar) files into event objects for the compact calendar.
// ABOUTME: Exports parseICS, expandRecurring, filterEvents, getEventsForYear, isDateInEvent, replaceDemoYearSlugs, and normalizeIcsUrl.
import ICAL from 'ical.js';

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseICS(icsString) {
  const parsed = ICAL.parse(icsString);
  const component = new ICAL.Component(parsed);
  const vevents = component.getAllSubcomponents('vevent');

  return vevents.map((vevent) => {
    const event = new ICAL.Event(vevent);
    const summary = event.summary || '';
    const dtstart = vevent.getFirstPropertyValue('dtstart');
    const dtend = vevent.getFirstPropertyValue('dtend');
    const isAllDay = dtstart.isDate;

    const startDate = dtstart.toJSDate();

    let endDate;
    if (!dtend) {
      endDate = new Date(startDate);
    } else {
      endDate = dtend.toJSDate();
      if (isAllDay) {
        endDate.setDate(endDate.getDate() - 1);
      }
    }

    const result = { summary, startDate, endDate, isAllDay };
    if (event.isRecurring()) {
      result._icalEvent = event;
    }
    return result;
  });
}

export function expandRecurring(events, rangeStart, rangeEnd, { includeRecurring = true } = {}) {
  const rangeEndIcal = ICAL.Time.fromJSDate(rangeEnd);
  const result = [];

  for (const event of events) {
    if (!event._icalEvent) {
      result.push(event);
      continue;
    }

    const icalEvent = event._icalEvent;
    const durationMs = event.endDate - event.startDate;
    const iter = icalEvent.iterator();
    let isFirst = true;
    let next;
    while ((next = iter.next())) {
      if (next.compare(rangeEndIcal) > 0) break;
      const occStart = next.toJSDate();
      if (occStart < rangeStart) {
        isFirst = false;
        continue;
      }
      if (!isFirst && !includeRecurring) break;
      const occEnd = new Date(occStart.getTime() + durationMs);
      result.push({
        summary: event.summary,
        startDate: occStart,
        endDate: occEnd,
        isAllDay: event.isAllDay,
      });
      isFirst = false;
    }
  }

  return result;
}

export function filterEvents(events, { includeSingleDay = false } = {}) {
  return events.filter((event) => {
    if (!event.isAllDay) return false;
    if (includeSingleDay) return true;
    const start = stripTime(event.startDate);
    const end = stripTime(event.endDate);
    return end > start;
  });
}

export function getEventsForYear(events, year) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  return events.filter((event) => {
    const eventStart = stripTime(event.startDate);
    const eventEnd = stripTime(event.endDate);
    return eventStart <= yearEnd && eventEnd >= yearStart;
  });
}

export function isDateInEvent(date, event) {
  const d = stripTime(date);
  const start = stripTime(event.startDate);
  const end = stripTime(event.endDate);
  return d >= start && d <= end;
}

export function replaceDemoYearSlugs(icsText, year) {
  return icsText
    .replaceAll('{YEAR-1}', String(year - 1))
    .replaceAll('{YEAR+1}', String(year + 1))
    .replaceAll('{YEAR}', String(year));
}

export function normalizeIcsUrl(url) {
  return url.trim().replace(/^webcal:\/\//, 'https://');
}
