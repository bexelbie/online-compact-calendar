// ABOUTME: Entry point for the compact calendar app.
// ABOUTME: Manages multi-calendar state (up to 6), settings UI, ICS loading, localStorage persistence, and orchestrates rendering.

import './styles.css';
import { generateYear } from './calendar-grid.js';
import { fetchHolidays, fetchAvailableCountries, evictStaleCache } from './holidays.js';
import { parseICS, expandRecurring, filterEvents, getEventsForYear, replaceDemoYearSlugs, normalizeIcsUrl } from './ics-parser.js';
import { renderCalendar } from './renderer.js';
import { encodeShareHash, decodeShareHash, buildShareStatus } from './share.js';

// Clean up expired cache entries on startup
evictStaleCache();

const STORAGE_KEY_CALENDARS = 'compact-cal-calendars';
const STORAGE_KEY_COUNTRY = 'compact-cal-country';
const STORAGE_KEY_INCLUDE_SINGLE_DAY = 'compact-cal-include-single-day';
const STORAGE_KEY_INCLUDE_RECURRING = 'compact-cal-include-recurring';
const STORAGE_KEY_MIGRATED = 'compact-cal-migrated';

// Old format keys — used only for migration detection
const LEGACY_KEY_GREEN_URL = 'compact-cal-green-url';
const LEGACY_KEY_YELLOW_URL = 'compact-cal-yellow-url';

// 6-calendar color palette
export const CALENDAR_COLORS = [
  '#1a60a8', // Blue
  '#c75400', // Orange
  '#7b1fa2', // Purple
  '#00796b', // Teal
  '#b5145a', // Magenta
  '#827717', // Olive
];

const MAX_CALENDARS = 6;

function createCalendar(index, overrides = {}) {
  const defaults = {
    id: `cal-${Date.now()}-${index}`,
    name: index === 0 ? 'Committed' : index === 1 ? 'Possible' : `Calendar ${index + 1}`,
    color: CALENDAR_COLORS[index % CALENDAR_COLORS.length],
    status: index === 0 ? 'committed' : index === 1 ? 'possible' : 'committed',
    source: { type: 'url', value: '' },
    overrides: { includeSingleDay: null, includeRecurring: null },
  };
  return { ...defaults, ...overrides, events: [], allEvents: [] };
}

// --- Migration from old green/yellow format ---
function migrateFromLegacyFormat() {
  const greenUrl = localStorage.getItem(LEGACY_KEY_GREEN_URL);
  const yellowUrl = localStorage.getItem(LEGACY_KEY_YELLOW_URL);

  if (!greenUrl && !yellowUrl) return null;

  const calendars = [];
  if (greenUrl || yellowUrl) {
    const cal1 = createCalendar(0);
    if (greenUrl) {
      cal1.source = { type: 'url', value: greenUrl };
    }
    calendars.push(cal1);

    const cal2 = createCalendar(1);
    if (yellowUrl) {
      cal2.source = { type: 'url', value: yellowUrl };
    }
    calendars.push(cal2);
  }

  // Persist new format
  saveCalendarConfigs(calendars);

  // Remove old keys
  localStorage.removeItem(LEGACY_KEY_GREEN_URL);
  localStorage.removeItem(LEGACY_KEY_YELLOW_URL);

  // Flag for migration banner
  localStorage.setItem(STORAGE_KEY_MIGRATED, 'pending');

  return calendars;
}

function saveCalendarConfigs(calendars) {
  const configs = calendars.map(c => ({
    id: c.id,
    name: c.name,
    color: c.color,
    status: c.status,
    source: c.source,
    overrides: c.overrides,
  }));
  localStorage.setItem(STORAGE_KEY_CALENDARS, JSON.stringify(configs));
}

function loadCalendarConfigs() {
  const raw = localStorage.getItem(STORAGE_KEY_CALENDARS);
  if (!raw) return null;
  try {
    const configs = JSON.parse(raw);
    return configs.map((cfg, i) => createCalendar(i, cfg));
  } catch {
    return null;
  }
}

// --- Initialize calendars ---
function initCalendars() {
  // Try new format first
  let calendars = loadCalendarConfigs();
  if (calendars) return calendars;

  // Try migrating from old format
  calendars = migrateFromLegacyFormat();
  if (calendars) return calendars;

  // Fresh install — start empty (banner will show)
  return [];
}

// Apply shared config from URL hash if present
const shareHash = window.location.hash.slice(1);
let initialCalendars = initCalendars();

if (shareHash) {
  const shareConfig = decodeShareHash(shareHash);
  if (shareConfig) {
    const hasExisting = initialCalendars.length > 0 &&
      initialCalendars.some(c => c.source.value);
    const shouldApply = !hasExisting || window.confirm(
      'This link will replace your current calendar configuration. Continue?'
    );
    if (shouldApply) {
      if (shareConfig.calendars) {
        // New format share link
        initialCalendars = shareConfig.calendars.map((cfg, i) => createCalendar(i, {
          name: cfg.name,
          color: cfg.color,
          status: cfg.status,
          source: { type: 'url', value: cfg.url },
        }));
      } else {
        // Legacy format share link
        initialCalendars = [];
        if (shareConfig.greenUrl) {
          initialCalendars.push(createCalendar(0, {
            source: { type: 'url', value: shareConfig.greenUrl },
          }));
        }
        if (shareConfig.yellowUrl) {
          const idx = initialCalendars.length;
          initialCalendars.push(createCalendar(idx, {
            name: 'Possible',
            status: 'possible',
            color: CALENDAR_COLORS[1],
            source: { type: 'url', value: shareConfig.yellowUrl },
          }));
        }
      }
      if (shareConfig.countryCode) {
        localStorage.setItem(STORAGE_KEY_COUNTRY, shareConfig.countryCode);
      }
      saveCalendarConfigs(initialCalendars);
    }
    // Clear hash from URL bar so it doesn't persist in bookmarks
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

// Welcome banner — visible when no URL/file data is loaded
const welcomeBanner = document.getElementById('welcome-banner');
let bannerDismissedThisSession = false;

function updateBannerVisibility() {
  const hasData = state.calendars.some(c => c.allEvents.length > 0);
  if (hasData || bannerDismissedThisSession) {
    welcomeBanner.classList.remove('visible');
  } else {
    welcomeBanner.classList.add('visible');
  }
}

const hasSavedData = initialCalendars.length > 0 &&
  initialCalendars.some(c => c.source.value);
if (!hasSavedData) {
  welcomeBanner.classList.add('visible');
}
document.getElementById('welcome-dismiss').addEventListener('click', () => {
  bannerDismissedThisSession = true;
  welcomeBanner.classList.remove('visible');
});

// Migration banner — shown once after auto-migrating from old green/yellow format
const migrationBanner = document.getElementById('migration-banner');
if (localStorage.getItem(STORAGE_KEY_MIGRATED) === 'pending') {
  migrationBanner.hidden = false;
  migrationBanner.classList.add('visible');
}
document.getElementById('migration-dismiss').addEventListener('click', () => {
  migrationBanner.hidden = true;
  migrationBanner.classList.remove('visible');
  localStorage.setItem(STORAGE_KEY_MIGRATED, 'done');
});

const state = {
  year: new Date().getFullYear(),
  countryCode: localStorage.getItem(STORAGE_KEY_COUNTRY) || 'CZ',
  includeSingleDay: localStorage.getItem(STORAGE_KEY_INCLUDE_SINGLE_DAY) === 'true',
  includeRecurring: localStorage.getItem(STORAGE_KEY_INCLUDE_RECURRING) === 'true',
  holidays: [],
  calendars: initialCalendars,
};

const calendarContainer = document.getElementById('calendar-container');
const yearDisplay = document.getElementById('year-display');

// Settings panel toggle
const settingsPanel = document.getElementById('settings-panel');
const settingsBtn = document.getElementById('settings-btn');
const settingsClose = document.getElementById('settings-close');

function toggleSettings() {
  settingsPanel.hidden = !settingsPanel.hidden;
}

settingsBtn.addEventListener('click', toggleSettings);
settingsClose.addEventListener('click', () => { settingsPanel.hidden = true; });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !settingsPanel.hidden) {
    settingsPanel.hidden = true;
  }
});

document.addEventListener('click', (e) => {
  if (!settingsPanel.hidden && !settingsPanel.contains(e.target) && e.target !== settingsBtn) {
    settingsPanel.hidden = true;
  }
});

let renderGeneration = 0;

async function loadAndRender() {
  const thisGeneration = ++renderGeneration;

  yearDisplay.textContent = state.year;
  document.title = `Compact Calendar ${state.year}`;

  const year = state.year;
  const countryCode = state.countryCode;
  const includeSingleDay = state.includeSingleDay;
  const includeRecurring = state.includeRecurring;

  const holidays = await fetchHolidays(year, countryCode);

  // A newer render was started while we were fetching; discard this one
  if (thisGeneration !== renderGeneration) return;

  state.holidays = holidays;

  const rangeStart = new Date(year - 1, 0, 1);
  const rangeEnd = new Date(year + 1, 11, 31);

  // Process each calendar's events for the current year
  for (const cal of state.calendars) {
    const calIncludeSingleDay = cal.overrides.includeSingleDay !== null
      ? cal.overrides.includeSingleDay : includeSingleDay;
    const calIncludeRecurring = cal.overrides.includeRecurring !== null
      ? cal.overrides.includeRecurring : includeRecurring;

    const expandOpts = { includeRecurring: calIncludeRecurring };
    const filterOpts = { includeSingleDay: calIncludeSingleDay };
    cal.events = getEventsForYear(
      filterEvents(expandRecurring(cal.allEvents, rangeStart, rangeEnd, expandOpts), filterOpts),
      year
    );
  }

  const weeks = generateYear(year);

  renderCalendar(calendarContainer, {
    weeks,
    holidays: state.holidays,
    calendars: state.calendars,
    year,
  });
}

async function fetchIcsFromUrl(url, calIndex) {
  const cal = state.calendars[calIndex];
  const statusEl = document.getElementById(`cal-${calIndex}-status`);
  if (statusEl) {
    statusEl.textContent = 'Loading...';
    statusEl.className = 'load-status';
  }

  try {
    const httpsUrl = normalizeIcsUrl(url);
    const response = await fetch('/api/ics-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: httpsUrl }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const icsText = await response.text();
    const events = parseICS(icsText);

    cal.allEvents = events;
    cal.source = { type: 'url', value: url.trim() };

    saveCalendarConfigs(state.calendars);

    if (statusEl) {
      statusEl.textContent = `${events.length} events`;
      statusEl.className = 'load-status success';
    }
    updateRefreshVisibility();
    updateShareVisibility();
    updateBannerVisibility();
    loadAndRender();
  } catch (err) {
    console.error(`Failed to fetch ICS: ${err.message}`);
    if (statusEl) {
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.className = 'load-status error';
    }
  }
}

function handleFileUpload(file, calIndex) {
  const cal = state.calendars[calIndex];
  const statusEl = document.getElementById(`cal-${calIndex}-status`);
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const events = parseICS(e.target.result);
      cal.allEvents = events;
      cal.source = { type: 'file', value: file.name };

      saveCalendarConfigs(state.calendars);
      updateRefreshVisibility();
      updateShareVisibility();
      updateBannerVisibility();
      if (statusEl) {
        statusEl.textContent = `${events.length} events`;
        statusEl.className = 'load-status success';
      }
      loadAndRender();
    } catch (err) {
      console.error(`Failed to parse ICS file: ${err.message}`);
      if (statusEl) {
        statusEl.textContent = `Error: ${err.message}`;
        statusEl.className = 'load-status error';
      }
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
  const hasUrls = state.calendars.some(c => c.source.type === 'url' && c.source.value);
  refreshBtn.hidden = !hasUrls;
}

refreshBtn.addEventListener('click', async () => {
  const fetches = [];
  for (let i = 0; i < state.calendars.length; i++) {
    const cal = state.calendars[i];
    if (cal.source.type === 'url' && cal.source.value) {
      fetches.push(fetchIcsFromUrl(cal.source.value, i));
    }
  }
  await Promise.all(fetches);
});

updateRefreshVisibility();

// Share button — generates a shareable URL from current config
const shareBtn = document.getElementById('share-btn');
const shareStatusEl = document.getElementById('share-status');

function updateShareVisibility() {
  const hasUrls = state.calendars.some(c => c.source.type === 'url' && c.source.value);
  shareBtn.hidden = !hasUrls;
  if (!hasUrls) shareStatusEl.textContent = '';
}

shareBtn.addEventListener('click', async () => {
  const countryCode = localStorage.getItem(STORAGE_KEY_COUNTRY) || '';
  const shareableCalendars = state.calendars
    .filter(c => c.source.type === 'url' && c.source.value)
    .map(c => ({ name: c.name, color: c.color, status: c.status, url: c.source.value }));

  const hash = encodeShareHash({ countryCode, calendars: shareableCalendars });
  const shareUrl = `${window.location.origin}${window.location.pathname}#${hash}`;

  try {
    await navigator.clipboard.writeText(shareUrl);
  } catch {
    // Fallback for contexts where clipboard API is unavailable
    prompt('Copy this link:', shareUrl);
  }

  const fileCalendars = state.calendars.filter(c =>
    c.source.type === 'file' && c.allEvents.length > 0
  );
  const status = buildShareStatus({ fileCalendarNames: fileCalendars.map(c => c.name) });
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

// Calendar input setup: dropdown mode switching, action buttons, file/URL inputs
function setupCalendar(calIndex) {
  const cal = state.calendars[calIndex];
  const modeSelect = document.getElementById(`cal-${calIndex}-mode`);
  const urlInput = document.getElementById(`cal-${calIndex}-url`);
  const fileInput = document.getElementById(`cal-${calIndex}-ics`);
  const actionBtn = document.getElementById(`cal-${calIndex}-action`);
  const statusEl = document.getElementById(`cal-${calIndex}-status`);
  const nameInput = document.getElementById(`cal-${calIndex}-name`);
  const statusSelect = document.getElementById(`cal-${calIndex}-status-type`);

  if (!modeSelect) return;

  // Sync name input
  if (nameInput) {
    nameInput.addEventListener('change', () => {
      cal.name = nameInput.value || cal.name;
      saveCalendarConfigs(state.calendars);
      loadAndRender();
    });
  }

  // Sync status (committed/possible) toggle
  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      cal.status = statusSelect.value;
      saveCalendarConfigs(state.calendars);
      loadAndRender();
    });
  }

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
      // Demo only available for first two calendars
      const sampleFile = calIndex === 0 ? '/green-sample.ics' : '/yellow-sample.ics';
      fetch(sampleFile)
        .then(resp => resp.text())
        .then(icsText => {
          const resolvedText = replaceDemoYearSlugs(icsText, new Date().getFullYear());
          const events = parseICS(resolvedText);
          cal.allEvents = events;
          cal.source = { type: 'demo', value: sampleFile };
          saveCalendarConfigs(state.calendars);
          updateRefreshVisibility();
          updateShareVisibility();
          updateBannerVisibility();
          statusEl.textContent = `${events.length} demo events`;
          statusEl.className = 'load-status success';
          loadAndRender();
        })
        .catch(err => {
          statusEl.textContent = `Error: ${err.message}`;
          statusEl.className = 'load-status error';
          updateBannerVisibility();
        });
    } else if (mode === 'clear') {
      cal.allEvents = [];
      cal.events = [];
      cal.source = { type: 'url', value: '' };
      saveCalendarConfigs(state.calendars);
      urlInput.value = '';
      fileInput.value = '';
      statusEl.textContent = 'Cleared';
      statusEl.className = 'load-status';
      modeSelect.value = 'url';
      applyMode('url');
      updateRefreshVisibility();
      updateShareVisibility();
      updateBannerVisibility();
      loadAndRender();
    }
  }

  modeSelect.addEventListener('change', () => applyMode(modeSelect.value));

  actionBtn.addEventListener('click', () => {
    if (modeSelect.value === 'url') {
      const url = urlInput.value;
      if (url) fetchIcsFromUrl(url, calIndex);
    } else if (modeSelect.value === 'file') {
      fileInput.click();
    }
  });

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const url = urlInput.value;
      if (url) fetchIcsFromUrl(url, calIndex);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFileUpload(fileInput.files[0], calIndex);
  });

  // Restore saved URL from config
  if (cal.source.type === 'url' && cal.source.value) {
    urlInput.value = cal.source.value;
    modeSelect.value = 'url';
    applyMode('url');
    fetchIcsFromUrl(cal.source.value, calIndex);
  } else {
    applyMode('url');
  }
}

// --- Dynamic calendar list rendering ---
const calendarListEl = document.getElementById('calendar-list');
const addCalendarBtn = document.getElementById('add-calendar-btn');

function renderCalendarRow(calIndex) {
  const cal = state.calendars[calIndex];
  const isDemoEligible = calIndex < 2;

  const row = document.createElement('div');
  row.className = 'upload-group calendar-row';
  row.id = `cal-${calIndex}-row`;

  const dot = document.createElement('span');
  dot.className = 'color-dot';
  dot.style.background = cal.color;
  row.appendChild(dot);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = `cal-${calIndex}-name`;
  nameInput.className = 'cal-name-input';
  nameInput.value = cal.name;
  nameInput.placeholder = 'Calendar name';
  row.appendChild(nameInput);

  const statusSelect = document.createElement('select');
  statusSelect.id = `cal-${calIndex}-status-type`;
  statusSelect.className = 'mode-select';
  for (const val of ['committed', 'possible']) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val.charAt(0).toUpperCase() + val.slice(1);
    if (val === cal.status) opt.selected = true;
    statusSelect.appendChild(opt);
  }
  row.appendChild(statusSelect);

  const modeSelect = document.createElement('select');
  modeSelect.id = `cal-${calIndex}-mode`;
  modeSelect.className = 'mode-select';
  const modes = isDemoEligible
    ? ['url', 'file', 'demo', 'clear']
    : ['url', 'file', 'clear'];
  for (const val of modes) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val.charAt(0).toUpperCase() + val.slice(1);
    modeSelect.appendChild(opt);
  }
  row.appendChild(modeSelect);

  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.id = `cal-${calIndex}-url`;
  urlInput.className = 'url-input';
  urlInput.placeholder = 'webcal:// or https://';
  row.appendChild(urlInput);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = `cal-${calIndex}-ics`;
  fileInput.className = 'file-input';
  fileInput.accept = '.ics,.ical';
  fileInput.hidden = true;
  row.appendChild(fileInput);

  const actionBtn = document.createElement('button');
  actionBtn.id = `cal-${calIndex}-action`;
  actionBtn.className = 'action-btn';
  actionBtn.textContent = 'Fetch';
  row.appendChild(actionBtn);

  const statusEl = document.createElement('span');
  statusEl.id = `cal-${calIndex}-status`;
  statusEl.className = 'load-status';
  row.appendChild(statusEl);

  // Remove button — only if more than 2 calendars
  if (state.calendars.length > 2) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'action-btn remove-cal-btn';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove calendar';
    removeBtn.addEventListener('click', () => removeCalendar(calIndex));
    row.appendChild(removeBtn);
  }

  return row;
}

function renderCalendarList() {
  calendarListEl.innerHTML = '';
  for (let i = 0; i < state.calendars.length; i++) {
    calendarListEl.appendChild(renderCalendarRow(i));
  }
  // Wire up event handlers for each calendar row
  for (let i = 0; i < state.calendars.length; i++) {
    setupCalendar(i);
  }
  addCalendarBtn.hidden = state.calendars.length >= MAX_CALENDARS;
  updateRefreshVisibility();
  updateShareVisibility();
}

function addCalendar() {
  if (state.calendars.length >= MAX_CALENDARS) return;
  const idx = state.calendars.length;
  state.calendars.push(createCalendar(idx));
  saveCalendarConfigs(state.calendars);
  renderCalendarList();
}

function removeCalendar(calIndex) {
  if (state.calendars.length <= 2) return;
  state.calendars.splice(calIndex, 1);
  // Reassign colors so they stay consistent with position
  for (let i = 0; i < state.calendars.length; i++) {
    state.calendars[i].color = CALENDAR_COLORS[i % CALENDAR_COLORS.length];
  }
  saveCalendarConfigs(state.calendars);
  renderCalendarList();
  loadAndRender();
}

addCalendarBtn.addEventListener('click', addCalendar);

// Ensure at least 2 calendars exist (default empty state)
if (state.calendars.length === 0) {
  state.calendars.push(createCalendar(0));
  state.calendars.push(createCalendar(1));
}

renderCalendarList();

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

// Single-day event filter checkbox
const includeSingleDayCheckbox = document.getElementById('include-single-day');
includeSingleDayCheckbox.checked = state.includeSingleDay;

includeSingleDayCheckbox.addEventListener('change', () => {
  state.includeSingleDay = includeSingleDayCheckbox.checked;
  localStorage.setItem(STORAGE_KEY_INCLUDE_SINGLE_DAY, String(state.includeSingleDay));
  loadAndRender();
});

// Recurring event filter checkbox
const includeRecurringCheckbox = document.getElementById('include-recurring');
includeRecurringCheckbox.checked = state.includeRecurring;

includeRecurringCheckbox.addEventListener('change', () => {
  state.includeRecurring = includeRecurringCheckbox.checked;
  localStorage.setItem(STORAGE_KEY_INCLUDE_RECURRING, String(state.includeRecurring));
  loadAndRender();
});

// Display app version in credits
document.getElementById('app-version').textContent = `v${__APP_VERSION__}`;

// Initial render (holidays + grid even before ICS loads)
loadAndRender();
