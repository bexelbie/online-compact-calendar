// ABOUTME: Entry point for the compact calendar app.
// ABOUTME: Handles year navigation, ICS file uploads, and orchestrates rendering.

import './styles.css';
import { generateYear } from './calendar-grid.js';
import { fetchHolidays } from './holidays.js';
import { parseICS, getEventsForYear } from './ics-parser.js';
import { renderCalendar } from './renderer.js';

const state = {
  year: new Date().getFullYear(),
  holidays: [],
  greenEvents: [],
  yellowEvents: [],
  allGreenEvents: [],
  allYellowEvents: [],
};

const calendarContainer = document.getElementById('calendar-container');
const yearDisplay = document.getElementById('year-display');

async function loadAndRender() {
  yearDisplay.textContent = state.year;
  document.title = `Compact Calendar ${state.year}`;

  state.holidays = await fetchHolidays(state.year);

  state.greenEvents = getEventsForYear(state.allGreenEvents, state.year);
  state.yellowEvents = getEventsForYear(state.allYellowEvents, state.year);

  const weeks = generateYear(state.year);

  renderCalendar(calendarContainer, {
    weeks,
    holidays: state.holidays,
    greenEvents: state.greenEvents,
    yellowEvents: state.yellowEvents,
    year: state.year,
  });
}

function handleFileUpload(file, color) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const events = parseICS(e.target.result);
      if (color === 'green') {
        state.allGreenEvents = events;
      } else {
        state.allYellowEvents = events;
      }
      loadAndRender();
    } catch (err) {
      console.error(`Failed to parse ICS file: ${err.message}`);
      alert(`Failed to parse ICS file: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

// Year navigation
document.getElementById('year-prev').addEventListener('click', () => {
  state.year--;
  loadAndRender();
});

document.getElementById('year-next').addEventListener('click', () => {
  state.year++;
  loadAndRender();
});

// File uploads
document.getElementById('green-ics').addEventListener('change', (e) => {
  if (e.target.files[0]) handleFileUpload(e.target.files[0], 'green');
});

document.getElementById('yellow-ics').addEventListener('change', (e) => {
  if (e.target.files[0]) handleFileUpload(e.target.files[0], 'yellow');
});

// Initial render
loadAndRender();
