import { Router } from 'express';
import { Event } from '../models/Event.js';
import { memoryStore } from '../memoryStore.js';
import { validateEventInput } from '../validate.js';
import { dbReady } from '../db.js';

export const eventsRouter = Router();

/** POST /api/events — validate and store a tracking event. */
eventsRouter.post('/', async (req, res, next) => {
  try {
    const result = validateEventInput(req.body ?? {});
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: 'invalid event', details: result.errors });
    }
    const saved = dbReady() ? await Event.create(result.value) : memoryStore.insert(result.value);
    return res.status(201).json({ ok: true, id: String(saved._id), event: saved });
  } catch (err) {
    return next(err);
  }
});
