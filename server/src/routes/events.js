import { Router } from 'express';
import { Event } from '../models/Event.js';
import { memoryStore } from '../memoryStore.js';
import { validateEventInput } from '../validate.js';
import { dbReady, isNetworkError } from '../db.js';

export const eventsRouter = Router();

/** POST /api/events — validate and store a tracking event. */
eventsRouter.post('/', async (req, res, next) => {
  try {
    const result = validateEventInput(req.body ?? {});
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: 'invalid event', details: result.errors });
    }
    let saved;
    if (dbReady()) {
      try {
        saved = await Event.create(result.value);
      } catch (err) {
        // readyState was stale and the insert died mid-TLS-blip: the event is
        // too valuable to 500 — park it in the memory store instead.
        if (!isNetworkError(err)) throw err;
        console.warn('[api] insert degraded to memory store:', String(err?.message ?? err).split('\n')[0]);
        saved = memoryStore.insert(result.value);
      }
    } else {
      saved = memoryStore.insert(result.value);
    }
    return res.status(201).json({ ok: true, id: String(saved._id), event: saved });
  } catch (err) {
    return next(err);
  }
});
