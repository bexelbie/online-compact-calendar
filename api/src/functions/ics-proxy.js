// ABOUTME: Azure Function that proxies ICS calendar URLs to bypass CORS restrictions.
// ABOUTME: Accepts a URL query parameter and fetches the ICS content server-side.

const { app } = require('@azure/functions');

app.http('ics-proxy', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'ics-proxy',
  handler: async (request, context) => {
    const url = request.query.get('url');

    if (!url) {
      return { status: 400, body: 'Missing url parameter' };
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return { status: 400, body: 'Invalid URL' };
    }

    if (parsed.protocol !== 'https:') {
      return { status: 400, body: 'Only HTTPS URLs are allowed' };
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'CompactCalendar/1.0',
          'Accept': 'text/calendar, text/plain, */*',
        },
      });

      if (!response.ok) {
        return {
          status: response.status,
          body: `Upstream responded with ${response.status}`,
        };
      }

      const body = await response.text();

      return {
        status: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
        body,
      };
    } catch (err) {
      context.error(`Proxy fetch failed: ${err.message}`);
      return { status: 502, body: `Failed to fetch: ${err.message}` };
    }
  },
});
