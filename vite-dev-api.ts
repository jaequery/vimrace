/**
 * vite-dev-api.ts — run the Vercel serverless functions under `vite dev`.
 *
 * Plain `vite` does not execute the `api/*.ts` handlers, so `/api/leaderboard`
 * and `/api/score` fall through to the SPA and the client shows "leaderboard
 * unavailable". This dev-only plugin wires those two routes to the real
 * handlers, loading `.env.local` so the Upstash (KV_REST_API_*) credentials are
 * available — the same code path that runs in production on Vercel.
 *
 * Build/preview/production are untouched (`apply: 'serve'`).
 */
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';

/** Minimal VercelResponse shim over a Node ServerResponse. */
function makeRes(res: import('node:http').ServerResponse) {
  return {
    statusCode: 200,
    setHeader: (k: string, v: string) => res.setHeader(k, v),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(obj: unknown) {
      res.statusCode = this.statusCode;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(obj));
    },
  };
}

export function devApi(): Plugin {
  return {
    name: 'vimrace-dev-api',
    apply: 'serve',
    configResolved(config) {
      // Load every var from .env / .env.local into process.env so the handlers'
      // getRedis() can read KV_REST_API_URL / KV_REST_API_TOKEN.
      const env = loadEnv(config.mode, process.cwd(), '');
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        const pathname = url.split('?')[0];
        const route =
          pathname === '/api/score'
            ? '/api/score.ts'
            : pathname === '/api/leaderboard'
            ? '/api/leaderboard.ts'
            : pathname === '/api/highscore'
            ? '/api/highscore.ts'
            : pathname === '/api/room'
            ? '/api/room.ts'
            : null;
        if (!route) return next();

        // Parse query string.
        const qs = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
        const query: Record<string, string> = {};
        for (const [k, v] of new URLSearchParams(qs)) query[k] = v;

        // Parse JSON body for writes.
        let body: unknown;
        if (req.method === 'POST') {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const raw = Buffer.concat(chunks).toString('utf8');
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            body = raw; // let the handler's own guard return a 400
          }
        }

        try {
          const mod = await server.ssrLoadModule(route);
          await mod.default({ method: req.method, query, body }, makeRes(res));
        } catch (err) {
          server.config.logger.error(`[dev-api] ${pathname} failed: ${String(err)}`);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'dev api error' }));
        }
      });
    },
  };
}
