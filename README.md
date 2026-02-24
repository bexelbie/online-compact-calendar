# Compact Calendar

## Live Sites

- **Production:** https://cc.bexelbie.com/ — latest stable release of the Compact Calendar
- **Beta:** https://beta-cc.bexelbie.com/ — tracks the `beta` branch when it differs from `main`

Compact Calendar is a web-based, year-at-a-glance planner inspired by [DSri Seah's Compact Calendar](https://davidseah.com/node/compact-calendar/). It's designed for planning questions that regular calendars handle poorly — which weeks are completely free, how holidays and trips overlap, or whether you can turn two public holidays into a long stretch away from work.

Instead of maintaining a separate spreadsheet, Compact Calendar reads your existing calendars (ICS files or URLs) and renders them into a single-page grid of continuous Monday–Sunday weeks. Up to six calendars are color-coded with a colorblind-safe palette, making it easy to see committed versus possible time at a glance and print or share the result.

For more background on why this exists, see the [blog post](https://www.bexelbie.com/2026/02/18/online-compact-calendar.html).

## Features

- Entire year at a glance with ISO 8601 week numbers, Monday start
- Up to 6 calendars with colorblind-safe colors for committed and possible time
- Load events from ICS files or webcal/HTTPS URLs (e.g., iCloud published calendars)
- Built-in demo data to explore the calendar without your own files
- Country-selectable public holidays via [Nager.Date API](https://date.nager.at/)
- Share your calendar view via a URL — settings are encoded in the URL fragment and never sent to any server
- Adjustable font size and print-friendly layout
- High-contrast grid option for color-blind users
- Keyboard and screen-reader friendly (ARIA attributes, focus management)
- All data stays in the browser (localStorage for preferences and caching)
- Server-side CORS proxy for fetching remote ICS URLs

## Architecture

- **Frontend**: Vanilla JavaScript, built with [Vite](https://vite.dev/)
- **API**: Azure Function (Node.js) providing a CORS proxy at `/api/ics-proxy`
- **Hosting**: Azure Static Web Apps
- **Tests**: [Vitest](https://vitest.dev/)

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
  renderer.js        # DOM rendering, legend, event columns, holiday toggle
  main.js            # App orchestration, multi-calendar state, settings UI
  share.js           # URL-hash-based sharing (encode/decode config)
  styles.css         # Layout, colors, accessibility, print styles
api/
  src/functions/
    ics-proxy.js     # Azure Function: CORS proxy for ICS URLs
public/
  green-sample.ics          # Demo data: Committed events
  yellow-sample.ics         # Demo data: Possible events
  staticwebapp.config.json  # Azure SWA routing and auth config
test/                # Vitest test suites (logic, rendering, a11y, share, etc.)
index.html           # Single-page app entry point
```

## Deployment

Hosted on Azure Static Web Apps with GitHub Actions CI/CD.

- `ci.yml` runs tests/build on pushes and PRs to `main` and `beta`
- `deploy.yml` deploys every push to `beta` (beta site)
- `release.yml` runs on `v*` tags and deploys production (main release flow)
- Beta tags (for example `v2.1.0-beta.1`) are optional and informational only

### Infrastructure Setup

The Azure infrastructure was created with the Azure CLI.

```bash
# Create resource group
az group create \
  --name rg-compact-calendar \
  --location westeurope

# Create production Static Web App
az staticwebapp create \
  --name compact-calendar \
  --resource-group rg-compact-calendar \
  --location westeurope

# Create beta Static Web App
az staticwebapp create \
  --name compact-calendar-beta \
  --resource-group rg-compact-calendar \
  --location westeurope

# Get production deployment token (store as AZURE_STATIC_WEB_APPS_API_TOKEN in GitHub)
az staticwebapp secrets list \
  --name compact-calendar \
  --resource-group rg-compact-calendar \
  --query "properties.apiKey" -o tsv

# Get beta deployment token (store as AZURE_STATIC_WEB_APPS_BETA_API_TOKEN in GitHub)
az staticwebapp secrets list \
  --name compact-calendar-beta \
  --resource-group rg-compact-calendar \
  --query "properties.apiKey" -o tsv

# Configure production custom domain
az staticwebapp hostname set \
  --name compact-calendar \
  --resource-group rg-compact-calendar \
  --hostname cc.bexelbie.com

# Configure beta custom domain (after DNS CNAME exists)
az staticwebapp hostname set \
  --name compact-calendar-beta \
  --resource-group rg-compact-calendar \
  --hostname beta-cc.bexelbie.com
```

Each custom domain requires a CNAME to the corresponding default hostname:

```bash
# Production default hostname
az staticwebapp show \
  --name compact-calendar \
  --resource-group rg-compact-calendar \
  --query "defaultHostname" -o tsv

# Beta default hostname
az staticwebapp show \
  --name compact-calendar-beta \
  --resource-group rg-compact-calendar \
  --query "defaultHostname" -o tsv
```

GitHub Actions secrets used by deployment workflows:

- `AZURE_STATIC_WEB_APPS_API_TOKEN` for production deploys
- `AZURE_STATIC_WEB_APPS_BETA_API_TOKEN` for beta branch deploys

## Privacy

All preferences (country, calendar URLs, filter settings) are stored in your browser's localStorage. Nothing is sent to third parties or used for tracking.

Calendar URLs necessarily go through the server-side proxy because browsers won't fetch them directly (CORS). The proxy is a stateless pass-through — it does not persist calendar data, in the function or in your browser. Calendar URLs are sent via POST request body rather than query parameters so they are not captured in platform-level request logs. Error logging includes only the target hostname, never the full URL or authentication tokens. If your calendar URL contains authentication tokens (iCloud URLs do), understand that the proxy briefly sees them in transit.

Holiday data is fetched directly from [Nager.Date](https://date.nager.at/) and cached in your browser for 30 days.

## License

[MIT](LICENSE)
