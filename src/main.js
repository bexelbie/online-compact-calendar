// ABOUTME: Entry point for the compact calendar app.
// ABOUTME: Handles year navigation, ICS file/URL loading with localStorage persistence, and orchestrates rendering.

import './styles.css';
import { generateYear } from './calendar-grid.js';
import { fetchHolidays, fetchAvailableCountries, evictStaleCache } from './holidays.js';
import { parseICS, getEventsForYear } from './ics-parser.js';
import { renderCalendar } from './renderer.js';
import { encodeShareHash, decodeShareHash, buildShareStatus } from './share.js';

// Clean up expired cache entries on startup
evictStaleCache();

const STORAGE_KEY_GREEN_URL = 'compact-cal-green-url';
const STORAGE_KEY_YELLOW_URL = 'compact-cal-yellow-url';
const STORAGE_KEY_COUNTRY = 'compact-cal-country';
const STORAGE_KEY_WELCOMED = 'compact-cal-welcomed';

// Apply shared config from URL hash if present
const shareHash = window.location.hash.slice(1);
if (shareHash) {
  const shareConfig = decodeShareHash(shareHash);
  if (shareConfig) {
    const hasExisting = localStorage.getItem(STORAGE_KEY_GREEN_URL) || localStorage.getItem(STORAGE_KEY_YELLOW_URL);
    const shouldApply = !hasExisting || window.confirm(
      'This link will replace your current calendar configuration. Continue?'
    );
    if (shouldApply) {
      if (shareConfig.greenUrl) {
        localStorage.setItem(STORAGE_KEY_GREEN_URL, shareConfig.greenUrl);
      } else {
        localStorage.removeItem(STORAGE_KEY_GREEN_URL);
      }
      if (shareConfig.yellowUrl) {
        localStorage.setItem(STORAGE_KEY_YELLOW_URL, shareConfig.yellowUrl);
      } else {
        localStorage.removeItem(STORAGE_KEY_YELLOW_URL);
      }
      if (shareConfig.countryCode) {
        localStorage.setItem(STORAGE_KEY_COUNTRY, shareConfig.countryCode);
      }
    }
    // Clear hash from URL bar so it doesn't persist in bookmarks
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

// Show welcome banner for first-time users (hide if they have saved URLs)
const welcomeBanner = document.getElementById('welcome-banner');
const hasSavedUrls = localStorage.getItem(STORAGE_KEY_GREEN_URL) || localStorage.getItem(STORAGE_KEY_YELLOW_URL);
const wasDismissed = localStorage.getItem(STORAGE_KEY_WELCOMED);
if (!hasSavedUrls && !wasDismissed) {
  welcomeBanner.classList.add('visible');
}
document.getElementById('welcome-dismiss').addEventListener('click', () => {
  welcomeBanner.classList.remove('visible');
  localStorage.setItem(STORAGE_KEY_WELCOMED, '1');
});

const state = {
  year: new Date().getFullYear(),
  countryCode: localStorage.getItem(STORAGE_KEY_COUNTRY) || 'CZ',
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

  state.holidays = await fetchHolidays(state.year, state.countryCode);

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
    updateRefreshVisibility();
    updateShareVisibility();
    loadAndRender();
  } catch (err) {
    console.error(`Failed to fetch ICS: ${err.message}`);
    statusEl.textContent = `Error: ${err.message}`;
    statusEl.className = 'load-status error';
  }
}

function handleFileUpload(file, color) {
  const statusEl = document.getElementById(`${color}-status`);
  const storageKey = color === 'green' ? STORAGE_KEY_GREEN_URL : STORAGE_KEY_YELLOW_URL;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const events = parseICS(e.target.result);
      if (color === 'green') {
        state.allGreenEvents = events;
      } else {
        state.allYellowEvents = events;
      }
      localStorage.removeItem(storageKey);
      updateRefreshVisibility();
      updateShareVisibility();
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

// Refresh button — re-fetches saved URLs
const refreshBtn = document.getElementById('refresh-btn');

function updateRefreshVisibility() {
  const hasUrls = localStorage.getItem(STORAGE_KEY_GREEN_URL) || localStorage.getItem(STORAGE_KEY_YELLOW_URL);
  refreshBtn.hidden = !hasUrls;
}

refreshBtn.addEventListener('click', async () => {
  const greenUrl = localStorage.getItem(STORAGE_KEY_GREEN_URL);
  const yellowUrl = localStorage.getItem(STORAGE_KEY_YELLOW_URL);
  const fetches = [];
  if (greenUrl) fetches.push(fetchIcsFromUrl(greenUrl, 'green'));
  if (yellowUrl) fetches.push(fetchIcsFromUrl(yellowUrl, 'yellow'));
  await Promise.all(fetches);
});

updateRefreshVisibility();

// Share button — generates a shareable URL from current config
const shareBtn = document.getElementById('share-btn');
const shareStatusEl = document.getElementById('share-status');

function updateShareVisibility() {
  const hasUrls = localStorage.getItem(STORAGE_KEY_GREEN_URL) || localStorage.getItem(STORAGE_KEY_YELLOW_URL);
  shareBtn.hidden = !hasUrls;
  if (!hasUrls) shareStatusEl.textContent = '';
}

shareBtn.addEventListener('click', async () => {
  const greenUrl = localStorage.getItem(STORAGE_KEY_GREEN_URL);
  const yellowUrl = localStorage.getItem(STORAGE_KEY_YELLOW_URL);
  const countryCode = localStorage.getItem(STORAGE_KEY_COUNTRY) || '';

  const hash = encodeShareHash({ countryCode, greenUrl, yellowUrl });
  const shareUrl = `${window.location.origin}${window.location.pathname}#${hash}`;

  try {
    await navigator.clipboard.writeText(shareUrl);
  } catch {
    // Fallback for contexts where clipboard API is unavailable
    prompt('Copy this link:', shareUrl);
  }

  const status = buildShareStatus({
    greenUrl,
    yellowUrl,
    greenHasEvents: state.allGreenEvents.length > 0,
    yellowHasEvents: state.allYellowEvents.length > 0,
  });
  shareStatusEl.textContent = status;
  shareStatusEl.className = 'load-status success';
});

updateShareVisibility();
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
    } else if (mode === 'demo') {
      urlInput.hidden = true;
      fileInput.hidden = true;
      actionBtn.hidden = true;
      statusEl.textContent = 'Loading demo...';
      const sampleFile = color === 'green' ? '/green-sample.ics' : '/yellow-sample.ics';
      fetch(sampleFile)
        .then(resp => resp.text())
        .then(icsText => {
          const events = parseICS(icsText);
          if (color === 'green') {
            state.allGreenEvents = events;
          } else {
            state.allYellowEvents = events;
          }
          localStorage.removeItem(storageKey);
          updateRefreshVisibility();
          updateShareVisibility();
          statusEl.textContent = `${events.length} demo events`;
          statusEl.className = 'load-status success';
          loadAndRender();
        })
        .catch(err => {
          statusEl.textContent = `Error: ${err.message}`;
          statusEl.className = 'load-status error';
        });
    } else if (mode === 'clear') {
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
      updateRefreshVisibility();
      updateShareVisibility();
      // Show welcome banner again if both bands are empty
      if (state.allGreenEvents.length === 0 && state.allYellowEvents.length === 0) {
        localStorage.removeItem(STORAGE_KEY_WELCOMED);
        welcomeBanner.classList.add('visible');
      }
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

// Country dropdown setup
const countrySelect = document.getElementById('country-select');
const countryStatus = document.getElementById('country-status');

async function populateCountryDropdown() {
  countryStatus.textContent = 'Loading...';
  const countries = await fetchAvailableCountries();
  countrySelect.innerHTML = '';

  if (countries.length === 0) {
    const opt = document.createElement('option');
    opt.value = 'CZ';
    opt.textContent = 'Czechia (offline)';
    countrySelect.appendChild(opt);
    countryStatus.textContent = '';
    return;
  }

  for (const c of countries) {
    const opt = document.createElement('option');
    opt.value = c.countryCode;
    opt.textContent = c.name;
    countrySelect.appendChild(opt);
  }
  countrySelect.value = state.countryCode;
  countryStatus.textContent = '';
}

countrySelect.addEventListener('change', () => {
  state.countryCode = countrySelect.value;
  localStorage.setItem(STORAGE_KEY_COUNTRY, state.countryCode);
  loadAndRender();
});

populateCountryDropdown();

// Initial render (holidays + grid even before ICS loads)
loadAndRender();
