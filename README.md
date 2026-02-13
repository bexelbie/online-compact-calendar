# Compact Calendar

A web-based compact calendar inspired by [Sri Seah's Compact Calendar](https://davidseah.com/node/compact-calendar/). Displays an entire year at a glance using ISO 8601 week numbering with two configurable event bands (Committed and Possible) fed from ICS calendar files or URLs.

## Features

- ISO 8601 week numbers, Monday start
- Two event bands: **Committed** (green) and **Possible** (yellow)
- Load events from ICS files or webcal/HTTPS URLs (e.g., iCloud published calendars)
- Built-in demo data to explore the calendar without your own files
- Country-selectable public holidays via [Nager.Date API](https://date.nager.at/)
- Font size controls and print-friendly layout
- All data stays in the browser (localStorage for preferences and caching)
- Server-side CORS proxy for fetching remote ICS URLs

## Architecture

- **Frontend**: Vanilla JavaScript, built with [Vite](https://vite.dev/)
- **API**: Azure Function (Node.js) providing a CORS proxy at `/api/ics-proxy`
- **Hosting**: Azure Static Web Apps
- **Tests**: [Vitest](https://vitest.dev/) — 30 tests across calendar grid, holidays, and ICS parsing

## Development

```bash
npm install
npx vite          # Dev server at http://localhost:5173
npx vitest run    # Run tests
npx vite build    # Build to dist/
```

The Vite dev server includes a proxy at `/api/ics-proxy` for local development, mirroring the Azure Function in production.

## Project Structure

```
src/
  calendar-grid.js   # Year grid generation (ISO 8601 weeks)
  holidays.js        # Holiday fetching, caching, country selection
  ics-parser.js      # ICS file parsing (VEVENT extraction)
  renderer.js        # DOM rendering, color precedence, event placement
  main.js            # App orchestration, UI controls, state management
  styles.css         # Layout, colors, print styles
api/
  src/functions/
    ics-proxy.js     # Azure Function: CORS proxy for ICS URLs
public/
  green-sample.ics          # Demo data: Committed events
  yellow-sample.ics         # Demo data: Possible events
  staticwebapp.config.json  # Azure SWA routing and auth config
test/                # Vitest test suites
test-data/           # Sample ICS files for testing
index.html           # Single-page app entry point
```

## Deployment

Hosted on Azure Static Web Apps with GitHub Actions CI/CD. Pushes to `main` trigger automatic builds and deployments.

## License

[MIT](LICENSE)
