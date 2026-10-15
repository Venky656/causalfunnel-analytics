/**
 * Transparent in-memory event store used when MongoDB is unreachable.
 * Mirrors the query surface of the Mongoose-backed implementation so the
 * API behaves identically; /api/health reports { db: 'memory' } in this mode.
 */
const events = [];
let seq = 0;

function id() {
  seq += 1;
  return `mem_${Date.now().toString(36)}_${seq}`;
}

function withId(e) {
  return { _id: e._id ?? id(), ...e };
}

function inSource(source) {
  return (e) => source === 'all' || e.data_source === source;
}

function toDate(v) {
  return v instanceof Date ? v : new Date(v);
}

export const memoryStore = {
  insert(doc) {
    const saved = withId({ ...doc, timestamp: toDate(doc.timestamp ?? new Date()) });
    events.push(saved);
    return saved;
  },

  clearDemo() {
    const before = events.length;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].data_source === 'demo') events.splice(i, 1);
    }
    return before - events.length;
  },

  sessions({ source = 'all', search = '' } = {}) {
    const q = search.trim().toLowerCase();
    const groups = new Map();
    for (const e of events.filter(inSource(source))) {
      if (q && !e.session_id.toLowerCase().includes(q)) continue;
      if (!groups.has(e.session_id)) groups.set(e.session_id, []);
      groups.get(e.session_id).push(e);
    }
    const out = [];
    for (const [session_id, list] of groups) {
      list.sort((a, b) => toDate(a.timestamp) - toDate(b.timestamp));
      out.push({
        session_id,
        total_events: list.length,
        page_views: list.filter((e) => e.event_type === 'page_view').length,
        clicks: list.filter((e) => e.event_type === 'click').length,
        data_sources: [...new Set(list.map((e) => e.data_source))],
        first_seen: list[0].timestamp,
        last_seen: list[list.length - 1].timestamp,
      });
    }
    out.sort((a, b) => toDate(b.last_seen) - toDate(a.last_seen));
    return out;
  },

  sessionEvents(sessionId, source = 'all') {
    return events
      .filter((e) => e.session_id === sessionId && inSource(source)(e))
      .sort((a, b) => toDate(a.timestamp) - toDate(b.timestamp));
  },

  clicks(url, source = 'all', { from = null, to = null } = {}) {
    return events
      .filter((e) => e.event_type === 'click' && e.page_url === url && inSource(source)(e))
      .filter((e) => {
        const t = toDate(e.timestamp);
        if (from && t < from) return false;
        if (to && t > to) return false;
        return true;
      })
      .sort((a, b) => toDate(a.timestamp) - toDate(b.timestamp));
  },

  /** Rows for /api/elements: events carrying a stable element_key for a page. */
  elements(url, source = 'all') {
    return events
      .filter((e) => e.page_url === url && e.element_key && inSource(source)(e))
      .sort((a, b) => toDate(a.timestamp) - toDate(b.timestamp));
  },

  pages(source = 'all') {
    const map = new Map();
    for (const e of events.filter(inSource(source))) {
      if (!map.has(e.page_url)) map.set(e.page_url, { page_url: e.page_url, events: 0, clicks: 0 });
      const row = map.get(e.page_url);
      row.events += 1;
      if (e.event_type === 'click') row.clicks += 1;
    }
    return [...map.values()].sort((a, b) => b.events - a.events);
  },

  overview(source = 'all') {
    const list = events.filter(inSource(source));
    const sessions = new Set(list.map((e) => e.session_id));
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const dayEvents = list.filter((e) => toDate(e.timestamp) >= d && toDate(e.timestamp) < next);
      days.push({
        date: d.toISOString().slice(0, 10),
        events: dayEvents.length,
        page_views: dayEvents.filter((e) => e.event_type === 'page_view').length,
        clicks: dayEvents.filter((e) => e.event_type === 'click').length,
      });
    }
    return {
      total_sessions: sessions.size,
      total_events: list.length,
      page_views: list.filter((e) => e.event_type === 'page_view').length,
      clicks: list.filter((e) => e.event_type === 'click').length,
      by_day: days,
      top_pages: this.pages(source).slice(0, 5),
      top_elements: topElements(list).slice(0, 5),
    };
  },
};

function topElements(list) {
  const map = new Map();
  for (const e of list) {
    if (e.event_type !== 'click') continue;
    const tag = e.element_tag ?? 'UNKNOWN';
    const text = e.element_text ?? '';
    const key = `${tag}|||${text}`;
    if (!map.has(key)) map.set(key, { tag, text, clicks: 0 });
    map.get(key).clicks += 1;
  }
  return [...map.values()].sort((a, b) => b.clicks - a.clicks);
}
