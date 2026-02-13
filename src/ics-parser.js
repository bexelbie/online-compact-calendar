// ABOUTME: Parses ICS (iCalendar) files into event objects for the compact calendar.
// ABOUTME: Exports parseICS, getEventsForYear, and isDateInEvent functions.
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

    const startDate = dtstart.toJSDate();

    let endDate;
    if (!dtend) {
      endDate = new Date(startDate);
    } else {
      endDate = dtend.toJSDate();
      const isAllDay = dtstart.isDate;
      if (isAllDay) {
        endDate.setDate(endDate.getDate() - 1);
      }
    }

    return { summary, startDate, endDate };
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
