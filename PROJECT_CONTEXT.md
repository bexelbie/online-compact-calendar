# Project Context

Compact, printable calendar web app. Renders a year-at-a-glance grid from ICS calendar feeds with color-coded markers and optional public holidays. Configuration is shared via URL fragment (no server-side storage).

## Tech Stack

Vanilla JS + Vite, plain CSS, Vitest + jsdom. Hosted on Azure Static Web Apps. Single runtime dependency: `ical.js`. The `api/` directory contains an Azure Function (`ics-proxy`) that proxies remote ICS feeds to avoid CORS — HTTPS-only.

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Run tests | `npm test` |
| Install deps | `npm ci` (root) + `cd api && npm ci` (API) |

## Deployment & Release

Two Azure SWA environments sharing the same `deploy.yml` workflow:

- **Beta**: Auto-deploys on push to `beta` branch (`AZURE_STATIC_WEB_APPS_BETA_API_TOKEN`)
- **Production**: Deploys when a `v*` tag is pushed to `main` (`AZURE_STATIC_WEB_APPS_API_TOKEN`)

Release steps:
1. Merge work into `main`
2. Create annotated tag: `git tag -a v2.1.0 -m "Release notes here"`
3. Push: `git push origin v2.1.0`
4. `release.yml` runs CI, verifies tag is on `main`, creates GitHub Release from tag annotation (`gh release create --notes-from-tag`), then deploys to production

**`__APP_VERSION__`** is injected at build time from `package.json` via Vite `define`.
