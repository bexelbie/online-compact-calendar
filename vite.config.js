import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
  },
  plugins: [
    {
      name: 'ics-proxy',
      configureServer(server) {
        server.middlewares.use('/api/ics-proxy', async (req, res) => {
          if (req.method !== 'POST') {
            res.writeHead(405);
            res.end('Method not allowed');
            return;
          }
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          let url;
          try {
            url = JSON.parse(Buffer.concat(chunks).toString()).url;
          } catch {
            res.writeHead(400);
            res.end('Invalid JSON body');
            return;
          }
          if (!url) {
            res.writeHead(400);
            res.end('Missing url');
            return;
          }
          let parsed;
          try {
            parsed = new URL(url);
          } catch {
            res.writeHead(400);
            res.end('Invalid URL');
            return;
          }
          if (parsed.protocol !== 'https:') {
            res.writeHead(400);
            res.end('Only HTTPS URLs are allowed');
            return;
          }
          try {
            const upstream = await fetch(url, {
              headers: {
                'User-Agent': 'CompactCalendar/1.0',
                'Accept': 'text/calendar, text/plain, */*',
              },
            });
            if (!upstream.ok) {
              res.writeHead(upstream.status);
              res.end(`Upstream responded with ${upstream.status}`);
              return;
            }
            const body = await upstream.text();
            res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8' });
            res.end(body);
          } catch {
            res.writeHead(502);
            res.end('Failed to fetch calendar');
          }
        });
      },
    },
  ],
});
