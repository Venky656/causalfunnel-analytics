import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eventsRouter } from './routes/events.js';
import { analyticsRouter } from './routes/analytics.js';
import { systemRouter } from './routes/system.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRACKER_PATH = path.resolve(__dirname, '..', '..', 'tracker', 'tracker.js');
const OVERLAY_PATH = path.resolve(__dirname, '..', '..', 'tracker', 'heatmap-overlay.js');
const INDEX_PATH = path.resolve(__dirname, '..', '..', 'client', 'dist', 'index.html');

export function createApp({ clientOrigin }) {
  const app = express();
  app.disable('x-powered-by');

  const allowed = (clientOrigin ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // Read APIs are public so the heat overlay/bookmarklet can fetch click
  // data from any page. Event ingest stays restricted to known origins.
  const readCors = cors({ origin: '*' });
  const writeCorsFor = (req) =>
    cors({
      origin: (origin, cb) => {
        // Always allow same-origin writes: CLIENT_ORIGIN pins *cross*-origin
        // frontends (e.g. http://localhost:5173), but the app also serves its
        // own UI (localhost:5001 / the deployed host) — blocking that silently
        // dropped every live event from the production build.
        const sameOrigin =
          origin && (origin === `http://${req.headers.host}` || origin === `https://${req.headers.host}`);
        if (!origin || sameOrigin || allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
        return cb(new Error('CORS: origin not allowed'));
      },
      // navigator.sendBeacon and credentialed fetches are sent with
      // credentials:'include', which forces a CORS preflight. Browsers reject
      // the response unless Access-Control-Allow-Credentials is 'true'. Without
      // this header every live event from the tracker is silently dropped.
      credentials: true,
    });
  app.use('/api', (req, res, next) => (req.method === 'GET' ? readCors : writeCorsFor(req))(req, res, next));
  app.use(express.json({ limit: '100kb' }));
  // Serve built React frontend (single-process deployment).
  app.use(express.static(path.join(__dirname, '..', '..', 'client', 'dist')));

  // Basic abuse protection on the ingest endpoint.
  const ingestLimiter = rateLimit({ windowMs: 60 * 1000, limit: 600, standardHeaders: true });
  app.use('/api/events', ingestLimiter);

  // Standalone tracking script.
  app.get('/tracker.js', (req, res) => {
    res.type('application/javascript');
    res.sendFile(TRACKER_PATH, (err) => {
      if (err) res.status(404).json({ ok: false, error: 'tracker script not found' });
    });
  });

  // Live heat overlay script (read-only — records nothing).
  app.get('/heatmap-overlay.js', (req, res) => {
    res.type('application/javascript');
    res.sendFile(OVERLAY_PATH, (err) => {
      if (err) res.status(404).json({ ok: false, error: 'overlay script not found' });
    });
  });

  app.use('/api/events', eventsRouter);
  app.use('/api', analyticsRouter);
  app.use('/api', systemRouter);

  // React Router SPA fallback — registered last so every API route and
  // script route above answers first. Unmatched /api paths fall through to
  // the JSON 404; everything else gets index.html so deep links work.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(INDEX_PATH, (err) => {
      if (err) next();
    });
  });

  app.use((req, res) => {
    res.status(404).json({ ok: false, error: `not found: ${req.method} ${req.path}` });
  });

  // Central error handler — never leak stack traces or credentials.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[api] error:', err.message);
    if (String(err.message).startsWith('CORS:')) {
      return res.status(403).json({ ok: false, error: err.message });
    }
    const status = err.status ?? 500;
    res.status(status).json({ ok: false, error: status === 500 ? 'internal server error' : err.message });
  });

  return app;
}
