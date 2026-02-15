// ABOUTME: Renders the compact calendar as an HTML table in the DOM.
// ABOUTME: Exports renderCalendar() and pure logic functions for event placement and conflict detection.

function dateKey(y, m, d) {
  return `${y}-${m}-${d}`;
}

function gridDateKey(utcDate) {
  return dateKey(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
}

function localDateKey(localDate) {
  return dateKey(localDate.getFullYear(), localDate.getMonth(), localDate.getDate());
}

function dateNum(y, m, d) {
  return y * 10000 + m * 100 + d;
}

function gridDateNum(utcDate) {
  return dateNum(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
}

function localDateNum(localDate) {
  return dateNum(localDate.getFullYear(), localDate.getMonth(), localDate.getDate());
}

export function formatEventDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()}-${months[date.getMonth()]}`;
}

function buildHolidayMap(holidays) {
  const map = new Map();
  for (const h of holidays) {
    map.set(localDateKey(h.date), h.name);
  }
  return map;
}

function buildEventDayKeys(events) {
  const keys = new Set();
  for (const event of events) {
    const current = new Date(event.startDate);
    const end = new Date(event.endDate);
    current.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    while (current <= end) {
      keys.add(localDateKey(current));
      current.setDate(current.getDate() + 1);
    }
  }
  return keys;
}

function eventOverlapsWeek(event, weekMondayNum, weekSundayNum) {
  const eventStart = localDateNum(event.startDate);
  const eventEnd = localDateNum(event.endDate);
  return eventStart <= weekSundayNum && eventEnd >= weekMondayNum;
}

function eventStartsInWeek(event, weekMondayNum, weekSundayNum) {
  const eventStart = localDateNum(event.startDate);
  return eventStart >= weekMondayNum && eventStart <= weekSundayNum;
}

/**
 * Pre-compute event placements for a band (green or yellow).
 * Returns a Map of rowIndex → { event, ongoing: false } for rows with a starting event,
 * and marks rows where an event is ongoing but no label is shown.
 *
 * When multiple events start in the same week, only the first gets the home row.
 * Extras spill to the nearest empty row (prefer downward, then upward).
 */
export function computeEventPlacements(events, weeks) {
  const totalRows = weeks.length;
  // placements[i] = { event, ongoing } or null
  const placements = new Array(totalRows).fill(null);

  // Track which rows have an ongoing event (for background band styling)
  const ongoingRows = new Set();

  // First pass: find which week each event starts in, and mark ongoing rows
  const eventsByStartWeek = new Map(); // weekIndex → [events]
  const firstWeekMondayNum = totalRows > 0 ? gridDateNum(weeks[0].days[0]) : 0;

  for (const event of events) {
    let placed = false;
    for (let wi = 0; wi < totalRows; wi++) {
      const weekMondayNum = gridDateNum(weeks[wi].days[0]);
      const weekSundayNum = gridDateNum(weeks[wi].days[6]);

      if (eventOverlapsWeek(event, weekMondayNum, weekSundayNum)) {
        ongoingRows.add(wi);
      }

      if (!placed) {
        const startsHere = eventStartsInWeek(event, weekMondayNum, weekSundayNum);
        const preCalendar = wi === 0 && localDateNum(event.startDate) < firstWeekMondayNum;
        if (startsHere || preCalendar) {
          if (!eventsByStartWeek.has(wi)) eventsByStartWeek.set(wi, []);
          eventsByStartWeek.get(wi).push(event);
          placed = true;
        }
      }
    }
  }

  // Second pass: place events, spilling overflow to nearby rows
  for (const [weekIndex, weekEvents] of eventsByStartWeek) {
    // Sort by start date so the earliest gets the home row
    weekEvents.sort((a, b) => localDateNum(a.startDate) - localDateNum(b.startDate));

    for (let i = 0; i < weekEvents.length; i++) {
      const event = weekEvents[i];
      if (i === 0 && placements[weekIndex] === null) {
        placements[weekIndex] = { event, ongoing: false };
      } else {
        // Spill: search nearby rows for an empty slot, prefer downward then upward
        let placed = false;
        for (let offset = 1; offset < totalRows; offset++) {
          const down = weekIndex + offset;
          if (down < totalRows && placements[down] === null) {
            placements[down] = { event, ongoing: false };
            placed = true;
            break;
          }
          const up = weekIndex - offset;
          if (up >= 0 && placements[up] === null) {
            placements[up] = { event, ongoing: false };
            placed = true;
            break;
          }
        }
        if (!placed) {
          // Last resort: overwrite home row by appending to summary
          // This should be extremely rare
          const home = placements[weekIndex];
          if (home) {
            home.event = {
              summary: `${home.event.summary}, ${event.summary}`,
              startDate: localDateNum(home.event.startDate) < localDateNum(event.startDate) ? home.event.startDate : event.startDate,
              endDate: localDateNum(home.event.endDate) > localDateNum(event.endDate) ? home.event.endDate : event.endDate,
            };
          }
        }
      }
    }
  }

  return { placements, ongoingRows };
}

function eventsOverlap(eventA, eventB) {
  const aStart = localDateNum(eventA.startDate);
  const aEnd = localDateNum(eventA.endDate);
  const bStart = localDateNum(eventB.startDate);
  const bEnd = localDateNum(eventB.endDate);
  return aStart <= bEnd && bStart <= aEnd;
}

export function detectConflicts(yellowEvents, greenEvents) {
  const conflicts = new Set();
  for (const yellow of yellowEvents) {
    for (const green of greenEvents) {
      if (eventsOverlap(yellow, green)) {
        conflicts.add(yellow);
        break;
      }
    }
  }
  return conflicts;
}

function appendEventCells(tr, placement, isOngoing, bandClass, hasConflict) {
  if (placement) {
    const whatCell = document.createElement('td');
    whatCell.className = `event-what ${bandClass}`;
    whatCell.textContent = placement.event.summary;
    tr.appendChild(whatCell);

    const startCell = document.createElement('td');
    startCell.className = `event-date ${bandClass}${hasConflict ? ' conflict' : ''}`;
    startCell.textContent = formatEventDate(placement.event.startDate);
    tr.appendChild(startCell);

    const endCell = document.createElement('td');
    endCell.className = `event-date ${bandClass}${hasConflict ? ' conflict' : ''}`;
    endCell.textContent = formatEventDate(placement.event.endDate);
    tr.appendChild(endCell);
  } else if (isOngoing) {
    for (let i = 0; i < 3; i++) {
      const cell = document.createElement('td');
      cell.className = bandClass;
      tr.appendChild(cell);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      tr.appendChild(document.createElement('td'));
    }
  }
}

const HEADER_COLUMNS = [
  { text: '#', className: 'col-week' },
  { text: 'Month', className: 'col-month' },
  { text: 'Mo', className: 'col-day' },
  { text: 'Tu', className: 'col-day' },
  { text: 'We', className: 'col-day' },
  { text: 'Th', className: 'col-day' },
  { text: 'Fr', className: 'col-day' },
  { text: 'Sa', className: 'col-day weekend-header' },
  { text: 'Su', className: 'col-day weekend-header' },
  { text: '', className: 'spacer' },
  { text: 'Committed', className: 'col-event-what' },
  { text: 'Start', className: 'col-event-date' },
  { text: 'End', className: 'col-event-date' },
  { text: '', className: 'spacer' },
  { text: 'Possible', className: 'col-event-what' },
  { text: 'Start', className: 'col-event-date' },
  { text: 'End', className: 'col-event-date' },
];

export function renderCalendar(container, { weeks, holidays, greenEvents, yellowEvents, year }) {
  container.innerHTML = '';

  const holidayMap = buildHolidayMap(holidays);
  const greenDayKeys = buildEventDayKeys(greenEvents);
  const yellowDayKeys = buildEventDayKeys(yellowEvents);

  const greenPlacement = computeEventPlacements(greenEvents, weeks);
  const yellowPlacement = computeEventPlacements(yellowEvents, weeks);
  const yellowConflicts = detectConflicts(yellowEvents, greenEvents);

  const table = document.createElement('table');
  table.className = 'compact-calendar';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const col of HEADER_COLUMNS) {
    const th = document.createElement('th');
    th.className = col.className;
    th.textContent = col.text;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
    const week = weeks[weekIndex];
    const tr = document.createElement('tr');

    const weekCell = document.createElement('td');
    weekCell.className = 'col-week';
    weekCell.textContent = String(week.weekNumber).padStart(2, '0');
    tr.appendChild(weekCell);

    const monthCell = document.createElement('td');
    monthCell.className = 'col-month';
    if (week.month !== null) {
      monthCell.textContent = week.month;
    }
    tr.appendChild(monthCell);

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const day = week.days[dayIndex];
      const dayCell = document.createElement('td');
      const classes = ['day'];

      const key = gridDateKey(day);
      const isWeekend = dayIndex >= 5;
      const holidayName = holidayMap.get(key);
      const isHoliday = holidayName !== undefined;

      if (day.getUTCDate() === 1) classes.push('first-day');
      if (isWeekend) classes.push('weekend');
      if (isHoliday && !isWeekend) classes.push('holiday');
      if (isHoliday && isWeekend) classes.push('weekend-holiday');
      if (greenDayKeys.has(key)) classes.push('green-event');
      if (yellowDayKeys.has(key)) classes.push('yellow-event');

      dayCell.className = classes.join(' ');
      dayCell.textContent = day.getUTCDate();
      if (isHoliday) dayCell.title = holidayName;

      tr.appendChild(dayCell);
    }

    const spacer1 = document.createElement('td');
    spacer1.className = 'spacer';
    tr.appendChild(spacer1);

    appendEventCells(tr, greenPlacement.placements[weekIndex], greenPlacement.ongoingRows.has(weekIndex), 'green-band', false);

    const spacer2 = document.createElement('td');
    spacer2.className = 'spacer';
    tr.appendChild(spacer2);

    const yellowP = yellowPlacement.placements[weekIndex];
    const yellowHasConflict = yellowP ? yellowConflicts.has(yellowP.event) : false;
    appendEventCells(tr, yellowP, yellowPlacement.ongoingRows.has(weekIndex), 'yellow-band', yellowHasConflict);

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  container.appendChild(table);

  if (holidays.length > 0) {
    const section = document.createElement('div');
    section.className = 'holiday-reference';

    const heading = document.createElement('h2');
    heading.textContent = `Public Holidays ${year}`;
    section.appendChild(heading);

    const list = document.createElement('ul');
    const sorted = [...holidays].sort((a, b) => a.date - b.date);
    for (const h of sorted) {
      const li = document.createElement('li');
      const dateStr = h.date.toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
      });
      li.textContent = `${dateStr} — ${h.name}`;
      list.appendChild(li);
    }
    section.appendChild(list);
    container.appendChild(section);
  }
}
