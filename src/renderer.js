// ABOUTME: Renders the compact calendar as an HTML table with two event columns (Committed, Possible).
// ABOUTME: Exports renderCalendar() and pure logic functions for conflict detection and date formatting.

// 6-calendar color palette (Okabe-Ito CVD-safe) — must match main.js CALENDAR_COLORS
const CALENDAR_COLORS = [
  '#0072B2', '#E69F00', '#009E73', '#CC79A7', '#785EF0', '#D55E00',
];

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

/**
 * Build a map of day key → { hasCommitted, hasPossible } for grid coloring.
 * Examines all calendars and their committed/possible status.
 */
function buildDayStatus(calendars) {
  const status = {};
  for (const cal of calendars) {
    for (const event of cal.events) {
      const current = new Date(event.startDate);
      const end = new Date(event.endDate);
      current.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      while (current <= end) {
        const k = localDateKey(current);
        if (!status[k]) status[k] = { hasCommitted: false, hasPossible: false };
        if (cal.status === 'committed') status[k].hasCommitted = true;
        if (cal.status === 'possible') status[k].hasPossible = true;
        current.setDate(current.getDate() + 1);
      }
    }
  }
  return status;
}

/**
 * Detect conflicts: possible events that overlap any committed event.
 * Returns a Set of conflicting possible events.
 */
export function detectConflicts(possibleEvents, committedEvents) {
  const conflicts = new Set();
  for (const p of possibleEvents) {
    const pStart = localDateNum(p.startDate);
    const pEnd = localDateNum(p.endDate);
    for (const c of committedEvents) {
      const cStart = localDateNum(c.startDate);
      const cEnd = localDateNum(c.endDate);
      if (pStart <= cEnd && cStart <= pEnd) {
        conflicts.add(p);
        break;
      }
    }
  }
  return conflicts;
}

/**
 * Create name part of an event chip: colored shape + event name.
 * Square for committed calendars, circle for possible.
 * Continuations (event started before this week) get dimmed styling.
 */
function makeNameChip(event, calColor, calStatus, startsThisWeek, calName) {
  const chip = document.createElement('span');
  chip.className = 'event-chip';
  if (!startsThisWeek) chip.classList.add('continuation-dim');

  const dot = document.createElement('span');
  dot.className = 'event-dot ' + calStatus;
  dot.style.background = calColor;
  dot.setAttribute('aria-hidden', 'true');
  chip.appendChild(dot);

  const text = document.createTextNode(event.summary);
  chip.appendChild(text);
  chip.setAttribute('aria-label', `${event.summary}, ${calName} (${calStatus})`);
  return chip;
}

/**
 * Create start and end date chips for an event.
 */
function makeDateChips(event, startsThisWeek) {
  const startChip = document.createElement('span');
  startChip.className = 'event-chip event-date-chip';
  if (!startsThisWeek) startChip.classList.add('continuation-dim');
  startChip.textContent = formatEventDate(event.startDate);

  const endChip = document.createElement('span');
  endChip.className = 'event-chip event-date-chip';
  if (!startsThisWeek) endChip.classList.add('continuation-dim');
  endChip.textContent = formatEventDate(event.endDate);

  return { startChip, endChip };
}

/**
 * Toggle the expand/collapse state of overflow events.
 * The button lives in the spacer cell; data-target points to the name cell id.
 */
function toggleMore(btn) {
  const targetId = btn.dataset.target;
  const nameCell = document.getElementById(targetId);
  if (!nameCell) return;
  const startCell = nameCell.nextElementSibling;
  const endCell = startCell ? startCell.nextElementSibling : null;
  const overflows = [nameCell, startCell, endCell]
    .filter(Boolean)
    .map(c => c.querySelector('.event-overflow'))
    .filter(Boolean);
  const collapsed = overflows[0] && overflows[0].style.display === 'none';
  for (const ov of overflows) {
    ov.style.display = collapsed ? 'block' : 'none';
  }
  if (collapsed) {
    btn.textContent = '▾';
    btn.title = 'Collapse';
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'Collapse events');
  } else {
    const count = overflows[0].children.length;
    btn.textContent = '▸';
    btn.title = count + ' more event' + (count > 1 ? 's' : '');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', count + ' more event' + (count > 1 ? 's' : ''));
  }
}

// Monotonic counter for unique cell IDs within a render pass
let cellIdCounter = 0;

/**
 * Fill spacer, name, start-date, and end-date cells with event data.
 * Toggle marker goes in the spacer cell when there are 2+ events.
 */
function fillEventsCells(spacerCell, nameCell, startCell, endCell, eventEntries) {
  if (eventEntries.length === 0) {
    return;
  }

  const first = eventEntries[0];
  if (eventEntries.length === 1) {
    nameCell.appendChild(makeNameChip(first.event, first.calColor, first.calStatus, first.startsThisWeek, first.calName));
    const dates = makeDateChips(first.event, first.startsThisWeek);
    startCell.appendChild(dates.startChip);
    endCell.appendChild(dates.endChip);
  } else {
    // Give the name cell a unique ID so the toggle can find it
    const cellId = 'evt-' + (cellIdCounter++);
    nameCell.id = cellId;

    const moreBtn = document.createElement('button');
    moreBtn.className = 'event-more';
    moreBtn.textContent = '▸';
    moreBtn.dataset.target = cellId;
    moreBtn.setAttribute('aria-expanded', 'false');
    moreBtn.setAttribute('aria-label', (eventEntries.length - 1) + ' more event' + (eventEntries.length - 1 > 1 ? 's' : ''));
    moreBtn.title = (eventEntries.length - 1) + ' more event' + (eventEntries.length - 1 > 1 ? 's' : '');
    moreBtn.addEventListener('click', function () { toggleMore(this); });
    spacerCell.appendChild(moreBtn);

    nameCell.appendChild(makeNameChip(first.event, first.calColor, first.calStatus, first.startsThisWeek, first.calName));
    const firstDates = makeDateChips(first.event, first.startsThisWeek);
    startCell.appendChild(firstDates.startChip);
    endCell.appendChild(firstDates.endChip);

    const nameOverflow = document.createElement('div');
    nameOverflow.className = 'event-overflow';
    nameOverflow.style.display = 'none';
    const startOverflow = document.createElement('div');
    startOverflow.className = 'event-overflow';
    startOverflow.style.display = 'none';
    const endOverflow = document.createElement('div');
    endOverflow.className = 'event-overflow';
    endOverflow.style.display = 'none';
    for (let i = 1; i < eventEntries.length; i++) {
      const e = eventEntries[i];
      nameOverflow.appendChild(makeNameChip(e.event, e.calColor, e.calStatus, e.startsThisWeek, e.calName));
      const dates = makeDateChips(e.event, e.startsThisWeek);
      startOverflow.appendChild(dates.startChip);
      endOverflow.appendChild(dates.endChip);
    }
    nameCell.appendChild(nameOverflow);
    startCell.appendChild(startOverflow);
    endCell.appendChild(endOverflow);
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
  { text: 'Committed', className: 'col-event-name' },
  { text: 'Start', className: 'col-event-date' },
  { text: 'End', className: 'col-event-date' },
  { text: '', className: 'spacer' },
  { text: 'Possible', className: 'col-event-name' },
  { text: 'Start', className: 'col-event-date' },
  { text: 'End', className: 'col-event-date' },
];

export function renderCalendar(container, { weeks, holidays, calendars, year }) {
  container.innerHTML = '';
  cellIdCounter = 0;

  const holidayMap = buildHolidayMap(holidays);
  const cals = calendars || [];
  const dayStatus = buildDayStatus(cals);

  // Build legend
  const legend = document.createElement('div');
  legend.className = 'calendar-legend';

  // Calendar color legend — square = committed, circle = possible
  for (const cal of cals) {
    const item = document.createElement('span');
    item.className = 'legend-item';
    const dot = document.createElement('span');
    dot.className = 'legend-dot ' + cal.status;
    dot.style.background = cal.color;
    dot.setAttribute('aria-hidden', 'true');
    item.appendChild(dot);
    const label = document.createElement('span');
    label.textContent = cal.name;
    item.appendChild(label);
    item.setAttribute('aria-label', `${cal.name} (${cal.status})`);
    legend.appendChild(item);
  }

  // Grid color key — on its own line
  const gridLine = document.createElement('div');
  gridLine.className = 'legend-grid-key';

  const gridKeys = [
    { className: 'legend-swatch holiday-swatch', text: 'Holiday' },
    { className: 'legend-swatch first-day-swatch', text: 'First of month' },
    { className: 'legend-swatch committed-swatch', text: 'Committed' },
    { className: 'legend-swatch possible-swatch', text: 'Possible' },
    { className: 'legend-swatch overlap-swatch', text: 'Overlap' },
    { className: 'legend-dot committed', text: '= committed cal', bg: '#666' },
    { className: 'legend-dot possible', text: '= possible cal', bg: '#666' },
  ];
  for (const key of gridKeys) {
    const item = document.createElement('span');
    item.className = 'legend-item';
    const swatch = document.createElement('span');
    swatch.className = key.className;
    if (key.bg) swatch.style.background = key.bg;
    swatch.setAttribute('aria-hidden', 'true');
    item.appendChild(swatch);
    const label = document.createElement('span');
    label.textContent = key.text;
    item.appendChild(label);
    gridLine.appendChild(item);
  }

  legend.appendChild(gridLine);
  container.appendChild(legend);

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

    // Week number
    const weekCell = document.createElement('td');
    weekCell.className = 'col-week';
    weekCell.textContent = String(week.weekNumber).padStart(2, '0');
    tr.appendChild(weekCell);

    // Month
    const monthCell = document.createElement('td');
    monthCell.className = 'col-month';
    if (week.month !== null) {
      monthCell.textContent = week.month;
    }
    tr.appendChild(monthCell);

    // Day cells — binary committed/possible coloring
    const weekMondayNum = gridDateNum(week.days[0]);
    const weekSundayNum = gridDateNum(week.days[6]);

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

      // Binary green/yellow coloring from all calendars
      const ds = dayStatus[key];
      if (ds) {
        if (ds.hasCommitted) classes.push('committed-event');
        if (ds.hasPossible) classes.push('possible-event');
      }

      dayCell.className = classes.join(' ');
      dayCell.textContent = day.getUTCDate();
      if (isHoliday) dayCell.title = holidayName;

      tr.appendChild(dayCell);
    }

    // Spacer
    const spacer1 = document.createElement('td');
    spacer1.className = 'spacer';
    tr.appendChild(spacer1);

    // Gather events active this week, split by committed/possible
    const committedEntries = [];
    const possibleEntries = [];

    for (const cal of cals) {
      for (const event of cal.events) {
        const eStart = localDateNum(event.startDate);
        const eEnd = localDateNum(event.endDate);
        if (eStart <= weekSundayNum && eEnd >= weekMondayNum) {
          const startsThisWeek = eStart >= weekMondayNum && eStart <= weekSundayNum;
          const entry = { event, calColor: cal.color, calStatus: cal.status, calName: cal.name, startsThisWeek };
          if (cal.status === 'committed') {
            committedEntries.push(entry);
          } else {
            possibleEntries.push(entry);
          }
        }
      }
    }

    // Sort: starting events first, then continuations, each by start date
    const sortFn = (a, b) => {
      if (a.startsThisWeek !== b.startsThisWeek) return a.startsThisWeek ? -1 : 1;
      return localDateNum(a.event.startDate) - localDateNum(b.event.startDate);
    };
    committedEntries.sort(sortFn);
    possibleEntries.sort(sortFn);

    // Committed: spacer + name + start + end columns
    const committedNameCell = document.createElement('td');
    committedNameCell.className = 'event-name-col';
    const committedStartCell = document.createElement('td');
    committedStartCell.className = 'event-date-col';
    const committedEndCell = document.createElement('td');
    committedEndCell.className = 'event-date-col';
    fillEventsCells(spacer1, committedNameCell, committedStartCell, committedEndCell, committedEntries);
    tr.appendChild(committedNameCell);
    tr.appendChild(committedStartCell);
    tr.appendChild(committedEndCell);

    // Spacer between committed and possible
    const spacer2 = document.createElement('td');
    spacer2.className = 'spacer';
    tr.appendChild(spacer2);

    // Possible: spacer2 + name + start + end columns
    const possibleNameCell = document.createElement('td');
    possibleNameCell.className = 'event-name-col';
    const possibleStartCell = document.createElement('td');
    possibleStartCell.className = 'event-date-col';
    const possibleEndCell = document.createElement('td');
    possibleEndCell.className = 'event-date-col';
    fillEventsCells(spacer2, possibleNameCell, possibleStartCell, possibleEndCell, possibleEntries);
    tr.appendChild(possibleNameCell);
    tr.appendChild(possibleStartCell);
    tr.appendChild(possibleEndCell);

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  container.appendChild(table);

  if (holidays.length > 0) {
    const section = document.createElement('div');
    section.className = 'holiday-reference';

    const toggle = document.createElement('button');
    toggle.className = 'holiday-toggle';
    toggle.textContent = `▸ Public Holidays ${year}`;
    toggle.setAttribute('aria-expanded', 'false');

    const listId = 'holiday-list-' + year;
    section.appendChild(toggle);

    const list = document.createElement('ul');
    list.id = listId;
    list.hidden = true;
    toggle.setAttribute('aria-controls', listId);
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

    toggle.addEventListener('click', () => {
      list.hidden = !list.hidden;
      toggle.textContent = (list.hidden ? '▸' : '▾') + ` Public Holidays ${year}`;
      toggle.setAttribute('aria-expanded', String(!list.hidden));
    });

    container.appendChild(section);
  }
}
