import { Router } from 'express';
import { dbStatus } from '../db.js';

export const systemRouter = Router();

/** GET /api/health — server health and database connectivity. */
systemRouter.get('/health', (req, res) => {
  res.json({
    ok: true,
    db: dbStatus(),
    uptime_seconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
