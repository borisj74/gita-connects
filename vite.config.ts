/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Runs the Vercel Functions under api/ during `vite dev`.
 *
 * Without this, Vite serves api/verse.ts as a static module and the browser
 * gets JavaScript source where it expects JSON — so the verse panel silently
 * falls back to "could not load". Vercel runs these functions in production;
 * this makes local match.
 */
function apiRoutes(): Plugin {
  return {
    name: 'local-api-routes',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res, next) => {
        const [route] = (req.url ?? '').split('?');
        const name = route.replace(/^\/+/, '').replace(/\/$/, '');
        if (!name) return next();

        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`);
          const method = (req.method ?? 'GET').toUpperCase();
          const handler = (mod[method] ?? mod.default) as
            | ((request: Request) => Promise<Response>)
            | undefined;
          if (!handler) {
            res.statusCode = 405;
            return res.end();
          }
          const url = `http://${req.headers.host}${req.url}`;
          const response = await handler(new Request(url, { method }));

          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          // Never cache in dev: a stale payload from a broken parser is
          // indistinguishable from a live one and wastes a debugging cycle.
          res.setHeader('cache-control', 'no-store');
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          server.config.logger.error(`[api] ${name}: ${String(error)}`);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'Local API route failed' }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiRoutes()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
  },
})
