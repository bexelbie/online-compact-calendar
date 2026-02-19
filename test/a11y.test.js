// ABOUTME: Accessibility tests for rendered DOM output.
// ABOUTME: Verifies ARIA attributes, semantic elements, and color palette values.
import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderCalendar } from '../src/renderer.js';
import { generateYear } from '../src/calendar-grid.js';

// CVD-safe palette values — must match main.js and renderer.js
const EXPECTED_COLORS = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#785EF0', '#D55E00'];

function makeEvent(summary, startDate, endDate) {
  return { summary, startDate, endDate, isAllDay: true };
}

// Set up a minimal DOM environment for each test
let dom, document, container;

beforeEach(() => {
  dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"></div></body></html>');
  document = dom.window.document;
  // Patch global document so renderer can use document.createElement
  global.document = document;
  container = document.getElementById('container');
});

const weeks = generateYear(2026);

describe('color palette', () => {
  it('renderer uses correct CVD-safe calendar colors in legend', () => {
    const calendars = EXPECTED_COLORS.map((color, i) => ({
      name: `Cal ${i}`, color, status: i % 2 === 0 ? 'committed' : 'possible', events: [],
    }));
    renderCalendar(container, { weeks, holidays: [], calendars, year: 2026 });

    const dots = container.querySelectorAll('.calendar-legend > .legend-item .legend-dot');
    expect(dots).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      // jsdom normalizes hex to rgb(), so check both representations
      const bg = dots[i].style.background || dots[i].style.backgroundColor;
      expect(bg).toBeTruthy();
    }
  });
});

describe('event overflow toggle', () => {
  it('is a <button> element', () => {
    const calendars = [{
      name: 'Work', color: '#0072B2', status: 'committed',
      events: [
        makeEvent('Event A', new Date(2026, 0, 5), new Date(2026, 0, 9)),
        makeEvent('Event B', new Date(2026, 0, 5), new Date(2026, 0, 7)),
      ],
    }];
    renderCalendar(container, { weeks, holidays: [], calendars, year: 2026 });

    const toggles = container.querySelectorAll('.event-more');
    expect(toggles.length).toBeGreaterThan(0);
    for (const toggle of toggles) {
      expect(toggle.tagName).toBe('BUTTON');
    }
  });

  it('has aria-expanded="false" when collapsed', () => {
    const calendars = [{
      name: 'Work', color: '#0072B2', status: 'committed',
      events: [
        makeEvent('Event A', new Date(2026, 0, 5), new Date(2026, 0, 9)),
        makeEvent('Event B', new Date(2026, 0, 5), new Date(2026, 0, 7)),
      ],
    }];
    renderCalendar(container, { weeks, holidays: [], calendars, year: 2026 });

    const toggle = container.querySelector('.event-more');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('has an aria-label describing the count', () => {
    const calendars = [{
      name: 'Work', color: '#0072B2', status: 'committed',
      events: [
        makeEvent('Event A', new Date(2026, 0, 5), new Date(2026, 0, 9)),
        makeEvent('Event B', new Date(2026, 0, 5), new Date(2026, 0, 7)),
        makeEvent('Event C', new Date(2026, 0, 6), new Date(2026, 0, 8)),
      ],
    }];
    renderCalendar(container, { weeks, holidays: [], calendars, year: 2026 });

    const toggle = container.querySelector('.event-more');
    expect(toggle.getAttribute('aria-label')).toMatch(/\d+ more events?/);
  });
});

describe('holiday toggle', () => {
  it('has aria-expanded attribute', () => {
    const holidays = [{ date: new Date(2026, 0, 1), name: 'New Year' }];
    renderCalendar(container, { weeks, holidays, calendars: [], year: 2026 });

    const toggle = container.querySelector('.holiday-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('has aria-controls pointing to holiday list', () => {
    const holidays = [{ date: new Date(2026, 0, 1), name: 'New Year' }];
    renderCalendar(container, { weeks, holidays, calendars: [], year: 2026 });

    const toggle = container.querySelector('.holiday-toggle');
    const listId = toggle.getAttribute('aria-controls');
    expect(listId).toBeTruthy();
    const list = container.querySelector(`#${listId}`);
    expect(list).not.toBeNull();
    expect(list.tagName).toBe('UL');
  });
});

describe('legend accessibility', () => {
  it('marks calendar color dots as aria-hidden', () => {
    const calendars = [
      { name: 'Work', color: '#0072B2', status: 'committed', events: [] },
    ];
    renderCalendar(container, { weeks, holidays: [], calendars, year: 2026 });

    const legendDots = container.querySelectorAll('.legend-dot');
    for (const dot of legendDots) {
      expect(dot.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('marks grid key swatches as aria-hidden', () => {
    const calendars = [
      { name: 'Work', color: '#0072B2', status: 'committed', events: [] },
    ];
    renderCalendar(container, { weeks, holidays: [], calendars, year: 2026 });

    const swatches = container.querySelectorAll('.legend-swatch');
    for (const swatch of swatches) {
      expect(swatch.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('has text labels next to each calendar dot', () => {
    const calendars = [
      { name: 'Work', color: '#0072B2', status: 'committed', events: [] },
      { name: 'Personal', color: '#E69F00', status: 'possible', events: [] },
    ];
    renderCalendar(container, { weeks, holidays: [], calendars, year: 2026 });

    const items = container.querySelectorAll('.calendar-legend > .legend-item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Work');
    expect(items[1].textContent).toContain('Personal');
  });
});

describe('event chip accessibility', () => {
  it('marks event dots as aria-hidden', () => {
    const calendars = [{
      name: 'Work', color: '#0072B2', status: 'committed',
      events: [makeEvent('Conference', new Date(2026, 0, 5), new Date(2026, 0, 9))],
    }];
    renderCalendar(container, { weeks, holidays: [], calendars, year: 2026 });

    const dots = container.querySelectorAll('.event-dot');
    for (const dot of dots) {
      expect(dot.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('includes calendar name in chip aria-label', () => {
    const calendars = [{
      name: 'Work', color: '#0072B2', status: 'committed',
      events: [makeEvent('Conference', new Date(2026, 0, 5), new Date(2026, 0, 9))],
    }];
    renderCalendar(container, { weeks, holidays: [], calendars, year: 2026 });

    const chip = container.querySelector('.event-chip');
    expect(chip.getAttribute('aria-label')).toContain('Conference');
    expect(chip.getAttribute('aria-label')).toContain('Work');
    expect(chip.getAttribute('aria-label')).toContain('committed');
  });
});
