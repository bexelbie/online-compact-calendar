import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
  },
  test: {
    globals: true,
  },
  server: {
    proxy: {
      '/api/ics-proxy': {
        target: 'https://placeholder.invalid',
        changeOrigin: true,
        secure: true,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // The actual target URL is passed as a query parameter
            const url = new URL(req.url, 'http://localhost');
            const target = url.searchParams.get('url');
            if (target) {
              const parsed = new URL(target);
              options.target = `${parsed.protocol}//${parsed.host}`;
              proxyReq.path = parsed.pathname + parsed.search;
              proxyReq.setHeader('host', parsed.host);
            }
          });
        },
      },
    },
  },
});
