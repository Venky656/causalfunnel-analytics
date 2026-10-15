import { Router } from 'express';
import { Event } from '../models/Event.js';
import { memoryStore } from '../memoryStore.js';
import { parsePagination, parseSource } from '../validate.js';
import { dbReady } from '../db.js';

export const analyticsRouter = Router();

function matchSource(source) {
  return source === 'all' ? {} : { data_source: source };
}

/** GET /api/sessions?source=&search=&page=&limit= — session summaries from stored events. */
analyticsRouter.get('/sessions', async (req, res, next) => {
  try {
    const source = parseSource(req.query.source);
    const search = String(req.query.search ?? '').trim();
    const { page, limit } = parsePagination(req.query);

    if (!dbReady()) {
      const all = memoryStore.sessions({ source, search });
      const total = all.length;
      return res.json({
        ok: true,
        data: all.slice((page - 1) * limit, page * limit),
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
      });
    }

    const match = { ...matchSource(source) };
    if (search) match.session_id = { $regex: search, $options: 'i' };
    const grouped = await Event.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$session_id',
          total_events: { $sum: 1 },
          page_views: { $sum: { $cond: [{ $eq: ['$event_type', 'page_view'] }, 1, 0] } },
          clicks: { $sum: { $cond: [{ $eq: ['$event_type', 'click'] }, 1, 0] } },
          data_sources: { $addToSet: '$data_source' },
          first_seen: { $min: '$timestamp' },
          last_seen: { $max: '$timestamp' },
        },
      },
      { $sort: { last_seen: -1 } },
      {
        $project: {
          _id: 0,
          session_id: '$_id',
          total_events: 1,
          page_views: 1,
          clicks: 1,
          data_sources: 1,
          first_seen: 1,
          last_seen: 1,
        },
      },
    ]);
    const total = grouped.length;
    return res.json({
      ok: true,
      data: grouped.slice((page - 1) * limit, page * limit),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    return next(err);
  }
});

/** GET /api/sessions/:id/events?source= — chronological event timeline for one session. */
analyticsRouter.get('/sessions/:id/events', async (req, res, next) => {
  try {
    const source = parseSource(req.query.source);
    const sessionId = String(req.params.id);
    const data = dbReady()
      ? await Event.find({ session_id: sessionId, ...matchSource(source) })
          .sort({ timestamp: 1 })
          .lean()
      : memoryStore.sessionEvents(sessionId, source);
    return res.json({ ok: true, session_id: sessionId, count: data.length, data });
  } catch (err) {
    return next(err);
  }
});

/** GET /api/clicks?url=&source=&from=&to= — stored click coordinates for a page. */
async function handleClicks(req, res) {
  const url = String(req.query.url ?? '');
  if (!url) {
    return res.status(400).json({ ok: false, error: 'query parameter "url" is required' });
  }
  const source = parseSource(req.query.source);

  // Optional ISO date range (inclusive). Invalid values are rejected, never ignored.
  let fromDate = null;
  let toDate = null;
  if (req.query.from !== undefined && req.query.from !== '') {
    fromDate = new Date(String(req.query.from));
    if (Number.isNaN(fromDate.getTime())) {
      return res.status(400).json({ ok: false, error: 'query parameter "from" must be a valid date' });
    }
  }
  if (req.query.to !== undefined && req.query.to !== '') {
    toDate = new Date(String(req.query.to));
    if (Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ ok: false, error: 'query parameter "to" must be a valid date' });
    }
  }

  if (!dbReady()) {
    const data = memoryStore.clicks(url, source, { from: fromDate, to: toDate });
    return res.json({ ok: true, page_url: url, count: data.length, data });
  }
  const timeFilter = {
    ...(fromDate ? { $gte: fromDate } : {}),
    ...(toDate ? { $lte: toDate } : {}),
  };
  const data = await Event.find(
    {
      page_url: url,
      event_type: 'click',
      ...matchSource(source),
      ...(Object.keys(timeFilter).length > 0 ? { timestamp: timeFilter } : {}),
    },
    { x: 1, y: 1, timestamp: 1, session_id: 1, viewport_width: 1, viewport_height: 1, page_width: 1, page_height: 1, data_source: 1, element_tag: 1, element_text: 1, element_section: 1, element_key: 1, element_rect: 1, _id: 0 }
  )
    .sort({ timestamp: 1 })
    .lean();
  return res.json({ ok: true, page_url: url, count: data.length, data });
}

analyticsRouter.get('/clicks', handleClicks);

/**
 * Shared per-element aggregation over a set of stored events.
 * Produces one row per element_key: click/session counts, an averaged anchor
 * rect, plus conversion metrics (purchases, revenue, AOV, conversion rate,
 * revenue per click, revenue per session) and rank by clicks.
 */
function summariseElements(rows) {
  const byKey = new Map();
  for (const r of rows) {
    const key = r.element_key;
    if (!key) continue;
    if (!byKey.has(key)) {
      byKey.set(key, {
        element_key: key,
        label: null,
        tag: null,
        section: null,
        href: null,
        sessions: new Set(),
        clicks: 0,
        rects: [],
        purchases: 0,
        revenue: 0,
        order_ids: new Set(),
        latest: null,
      });
    }
    const e = byKey.get(key);
    if (r.element_text) e.label = e.label ?? r.element_text;
    if (r.element_tag) e.tag = e.tag ?? r.element_tag;
    if (r.element_section) e.section = e.section ?? r.element_section;
    if (r.element_href) e.href = e.href ?? r.element_href;
    if (r.event_type === 'purchase') {
      e.purchases += 1;
      e.revenue += Number(r.revenue) || 0;
      if (r.order_id) e.order_ids.add(r.order_id);
      e.sessions.add(r.session_id);
      e.latest = !e.latest || r.timestamp > e.latest ? r.timestamp : e.latest;
    } else {
      e.clicks += 1;
      e.sessions.add(r.session_id);
      if (r.element_rect && r.element_rect.w > 0 && r.element_rect.h > 0) {
        e.rects.push(r.element_rect);
      }
      e.latest = !e.latest || r.timestamp > e.latest ? r.timestamp : e.latest;
    }
  }

  const out = [];
  for (const e of byKey.values()) {
    const sessions = e.sessions.size;
    const purchases = e.order_ids.size || e.purchases;
    // Median-ish anchor: average the rects, which is stable across viewports
    // and keeps the blob on the element's real footprint.
    let rect = null;
    if (e.rects.length > 0) {
      const sum = e.rects.reduce(
        (a, r) => ({ x: a.x + r.x, y: a.y + r.y, w: a.w + r.w, h: a.h + r.h }),
        { x: 0, y: 0, w: 0, h: 0 }
      );
      const n = e.rects.length;
      rect = {
        x: Math.round(sum.x / n),
        y: Math.round(sum.y / n),
        w: Math.round(sum.w / n),
        h: Math.round(sum.h / n),
      };
    }
    const aov = purchases > 0 ? e.revenue / purchases : 0;
    out.push({
      element_key: e.element_key,
      label: e.label ?? e.element_key,
      tag: e.tag,
      section: e.section,
      href: e.href,
      clicks: e.clicks,
      sessions,
      purchases,
      revenue: Math.round(e.revenue * 100) / 100,
      aov: Math.round(aov * 100) / 100,
      // Conversion rate: sessions that clicked this element and went on to
      // purchase, over sessions that clicked it.
      conversion_rate:
        sessions > 0 ? Math.round((purchases / sessions) * 10000) / 100 : 0,
      revenue_per_click: e.clicks > 0 ? Math.round((e.revenue / e.clicks) * 100) / 100 : 0,
      revenue_per_session: sessions > 0 ? Math.round((e.revenue / sessions) * 100) / 100 : 0,
      rect,
      latest: e.latest,
    });
  }
  out.sort((a, b) => b.clicks - a.clicks || b.revenue - a.revenue);
  out.forEach((e, i) => {
    e.rank = i + 1;
  });
  return out;
}

/**
 * GET /api/elements?url=&source=&limit=
 * Element-anchored heatmap data: one row per clicked element with rank and
 * conversion metrics. This is what powers precise per-product heat instead of
 * a page-wide pixel smear.
 */
analyticsRouter.get('/elements', async (req, res, next) => {
  try {
    const url = String(req.query.url ?? '');
    if (!url) {
      return res.status(400).json({ ok: false, error: 'query parameter "url" is required' });
    }
    const source = parseSource(req.query.source);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit ?? '60', 10) || 60));

    let rows;
    if (dbReady()) {
      rows = await Event.find(
        {
          page_url: url,
          element_key: { $exists: true, $nin: [null, ''] },
          ...matchSource(source),
        },
        {
          element_key: 1,
          element_text: 1,
          element_tag: 1,
          element_section: 1,
          element_href: 1,
          element_rect: 1,
          event_type: 1,
          revenue: 1,
          order_id: 1,
          session_id: 1,
          timestamp: 1,
          _id: 0,
        }
      )
        .sort({ timestamp: -1 })
        .limit(20000)
        .lean();
    } else {
      rows = memoryStore.elements(url, source);
    }

    const data = summariseElements(rows).slice(0, limit);
    return res.json({
      ok: true,
      page_url: url,
      source,
      count: data.length,
      total_clicks: data.reduce((n, e) => n + e.clicks, 0),
      total_revenue: Math.round(data.reduce((n, e) => n + e.revenue, 0) * 100) / 100,
      data,
    });
  } catch (err) {
    return next(err);
  }
});

// Backwards-compatible alias: /api/heatmap?page_url=... (earlier contract).
analyticsRouter.get('/heatmap', (req, res) => {
  req.query.url = req.query.page_url ?? req.query.url ?? '';
  return handleClicks(req, res);
});

/** GET /api/pages?source= — distinct page URLs with event/click counts. */
analyticsRouter.get('/pages', async (req, res, next) => {
  try {
    const source = parseSource(req.query.source);
    if (!dbReady()) {
      const data = memoryStore.pages(source);
      return res.json({ ok: true, count: data.length, data });
    }
    const data = await Event.aggregate([
      { $match: matchSource(source) },
      {
        $group: {
          _id: '$page_url',
          events: { $sum: 1 },
          clicks: { $sum: { $cond: [{ $eq: ['$event_type', 'click'] }, 1, 0] } },
        },
      },
      { $project: { _id: 0, page_url: '$_id', events: 1, clicks: 1 } },
      { $sort: { events: -1 } },
    ]);
    return res.json({ ok: true, count: data.length, data });
  } catch (err) {
    return next(err);
  }
});

/** GET /api/overview?source= — summary metrics computed from stored events. */
analyticsRouter.get('/overview', async (req, res, next) => {
  try {
    const source = parseSource(req.query.source);
    if (!dbReady()) {
      return res.json({ ok: true, source, ...memoryStore.overview(source) });
    }
    const match = matchSource(source);
    const [totals] = await Event.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total_events: { $sum: 1 },
          page_views: { $sum: { $cond: [{ $eq: ['$event_type', 'page_view'] }, 1, 0] } },
          clicks: { $sum: { $cond: [{ $eq: ['$event_type', 'click'] }, 1, 0] } },
          sessions: { $addToSet: '$session_id' },
        },
      },
      { $project: { _id: 0, total_events: 1, page_views: 1, clicks: 1, total_sessions: { $size: '$sessions' } } },
    ]);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 13);
    const daily = await Event.aggregate([
      { $match: { ...match, timestamp: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          events: { $sum: 1 },
          page_views: { $sum: { $cond: [{ $eq: ['$event_type', 'page_view'] }, 1, 0] } },
          clicks: { $sum: { $cond: [{ $eq: ['$event_type', 'click'] }, 1, 0] } },
        },
      },
      { $project: { _id: 0, date: '$_id', events: 1, page_views: 1, clicks: 1 } },
      { $sort: { date: 1 } },
    ]);
    const byDayMap = new Map(daily.map((d) => [d.date, d]));
    const by_day = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(start);
      d.setDate(start.getDate() + (13 - i));
      const key = d.toISOString().slice(0, 10);
      by_day.push(byDayMap.get(key) ?? { date: key, events: 0, page_views: 0, clicks: 0 });
    }
    const top_pages = await Event.aggregate([
      { $match: match },
      { $group: { _id: '$page_url', events: { $sum: 1 } } },
      { $project: { _id: 0, page_url: '$_id', events: 1 } },
      { $sort: { events: -1 } },
      { $limit: 5 },
    ]);
    const top_elements = await Event.aggregate([
      { $match: { ...match, event_type: 'click' } },
      {
        $group: {
          _id: { tag: { $ifNull: ['$element_tag', 'UNKNOWN'] }, text: { $ifNull: ['$element_text', ''] } },
          clicks: { $sum: 1 },
        },
      },
      { $project: { _id: 0, tag: '$_id.tag', text: '$_id.text', clicks: 1 } },
      { $sort: { clicks: -1 } },
      { $limit: 5 },
    ]);
    return res.json({
      ok: true,
      source,
      total_sessions: totals?.total_sessions ?? 0,
      total_events: totals?.total_events ?? 0,
      page_views: totals?.page_views ?? 0,
      clicks: totals?.clicks ?? 0,
      by_day,
      top_pages,
      top_elements,
    });
  } catch (err) {
    return next(err);
  }
});
