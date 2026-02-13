// ABOUTME: Entry point for the compact calendar app.
// ABOUTME: Handles year navigation, ICS file/URL loading with localStorage persistence, and orchestrates rendering.

import './styles.css';
import { generateYear } from './calendar-grid.js';
import { fetchHolidays } from './holidays.js';
import { parseICS, getEventsForYear } from './ics-parser.js';
import { renderCalendar } from './renderer.js';

const STORAGE_KEY_GREEN_URL = 'compact-cal-green-url';
const STORAGE_KEY_YELLOW_URL = 'compact-cal-yellow-url';

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

function normalizeIcsUrl(url) {
  return url.trim().replace(/^webcal:\/\//, 'https://');
}

async function fetchIcsFromUrl(url, color) {
  const statusEl = document.getElementById(`${color}-status`);
  statusEl.textContent = 'Loading...';
  statusEl.className = 'load-status';

  try {
    const httpsUrl = normalizeIcsUrl(url);
    const proxyUrl = `/api/ics-proxy?url=${encodeURIComponent(httpsUrl)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const icsText = await response.text();
    const events = parseICS(icsText);

    if (color === 'green') {
      state.allGreenEvents = events;
    } else {
      state.allYellowEvents = events;
    }

    localStorage.setItem(
      color === 'green' ? STORAGE_KEY_GREEN_URL : STORAGE_KEY_YELLOW_URL,
      url.trim()
    );

    statusEl.textContent = `${events.length} events`;
    statusEl.className = 'load-status success';
    loadAndRender();
  } catch (err) {
    console.error(`Failed to fetch ICS: ${err.message}`);
    statusEl.textContent = `Error: ${err.message}`;
    statusEl.className = 'load-status error';
  }
}

function handleFileUpload(file, color) {
  const statusEl = document.getElementById(`${color}-status`);
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const events = parseICS(e.target.result);
      if (color === 'green') {
        state.allGreenEvents = events;
      } else {
        state.allYellowEvents = events;
      }
      statusEl.textContent = `${events.length} events`;
      statusEl.className = 'load-status success';
      loadAndRender();
    } catch (err) {
      console.error(`Failed to parse ICS file: ${err.message}`);
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.className = 'load-status error';
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

// Font size controls
const fontSizeDisplay = document.getElementById('font-size-display');
let fontSize = parseInt(getComputedStyle(document.body).fontSize, 10);
fontSizeDisplay.textContent = `${fontSize}px`;

document.getElementById('font-down').addEventListener('click', () => {
  if (fontSize > 10) {
    fontSize--;
    document.body.style.fontSize = `${fontSize}px`;
    fontSizeDisplay.textContent = `${fontSize}px`;
  }
});

document.getElementById('font-up').addEventListener('click', () => {
  if (fontSize < 24) {
    fontSize++;
    document.body.style.fontSize = `${fontSize}px`;
    fontSizeDisplay.textContent = `${fontSize}px`;
  }
});

// Band input setup: dropdown mode switching, action buttons, file/URL inputs
function setupBand(color) {
  const modeSelect = document.getElementById(`${color}-mode`);
  const urlInput = document.getElementById(`${color}-url`);
  const fileInput = document.getElementById(`${color}-ics`);
  const actionBtn = document.getElementById(`${color}-action`);
  const statusEl = document.getElementById(`${color}-status`);
  const storageKey = color === 'green' ? STORAGE_KEY_GREEN_URL : STORAGE_KEY_YELLOW_URL;

  function applyMode(mode) {
    if (mode === 'url') {
      urlInput.hidden = false;
      fileInput.hidden = true;
      actionBtn.textContent = 'Fetch';
      actionBtn.hidden = false;
    } else if (mode === 'file') {
      urlInput.hidden = true;
      fileInput.hidden = true;
      actionBtn.textContent = 'Choose File';
      actionBtn.hidden = false;
    } else if (mode === 'clear') {
      // Clear events and saved URL, then reset to URL mode
      if (color === 'green') {
        state.allGreenEvents = [];
      } else {
        state.allYellowEvents = [];
      }
      localStorage.removeItem(storageKey);
      urlInput.value = '';
      fileInput.value = '';
      statusEl.textContent = 'Cleared';
      statusEl.className = 'load-status';
      modeSelect.value = 'url';
      applyMode('url');
      loadAndRender();
    }
  }

  modeSelect.addEventListener('change', () => applyMode(modeSelect.value));

  actionBtn.addEventListener('click', () => {
    if (modeSelect.value === 'url') {
      const url = urlInput.value;
      if (url) fetchIcsFromUrl(url, color);
    } else if (modeSelect.value === 'file') {
      fileInput.click();
    }
  });

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const url = urlInput.value;
      if (url) fetchIcsFromUrl(url, color);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFileUpload(fileInput.files[0], color);
  });

  // Restore saved URL from localStorage
  const savedUrl = localStorage.getItem(storageKey);
  if (savedUrl) {
    urlInput.value = savedUrl;
    modeSelect.value = 'url';
    applyMode('url');
    fetchIcsFromUrl(savedUrl, color);
  } else {
    applyMode('url');
  }
}

setupBand('green');
setupBand('yellow');

// Initial render (holidays + grid even before ICS loads)
loadAndRender();
