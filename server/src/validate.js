const EVENT_TYPES = ['page_view', 'click', 'purchase'];
const SOURCES = ['live', 'demo'];

function isValidURL(value) {
  try {
    const u = new URL(String(value));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidDate(value) {
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function numOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function strOrNull(v, max) {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s; // truncate, never reject
}

/**
 * Validate POST /api/events payload.
 * Returns { ok, value } or { ok: false, errors }.
 */
export function validateEventInput(body = {}) {
  const errors = [];
  const {
    session_id,
    event_type,
    page_url,
    timestamp,
    x,
    y,
    viewport_width,
    viewport_height,
    page_width,
    page_height,
    data_source,
    element_tag,
    element_id,
    element_classes,
    element_text,
    element_href,
    element_section,
    element_key,
    element_rect,
    order_id,
    revenue,
    currency,
    items,
  } = body;

  if (!session_id || typeof session_id !== 'string' || !session_id.trim()) {
    errors.push('session_id is required');
  } else if (session_id.length > 128) {
    errors.push('session_id must be at most 128 characters');
  }

  if (!EVENT_TYPES.includes(event_type)) {
    errors.push('event_type must be one of: page_view, click, purchase');
  }

  if (!page_url || typeof page_url !== 'string' || !isValidURL(page_url)) {
    errors.push('page_url must be a valid http(s) URL');
  } else if (page_url.length > 2048) {
    errors.push('page_url must be at most 2048 characters');
  }

  let ts = new Date();
  if (timestamp !== undefined && timestamp !== null && timestamp !== '') {
    if (!isValidDate(timestamp)) errors.push('timestamp must be a valid date');
    else ts = new Date(timestamp);
  }

  let cx = null;
  let cy = null;
  if (event_type === 'click') {
    cx = numOrNull(x);
    cy = numOrNull(y);
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
      errors.push('click events require numeric x and y coordinates');
    }
  }

  // element_rect is optional but must be well-formed when present.
  let rect = null;
  if (element_rect && typeof element_rect === 'object') {
    const rx = numOrNull(element_rect.x);
    const ry = numOrNull(element_rect.y);
    const rw = numOrNull(element_rect.w);
    const rh = numOrNull(element_rect.h);
    if ([rx, ry, rw, rh].some((n) => Number.isNaN(n))) {
      errors.push('element_rect x/y/w/h must be numbers');
    } else if (rw !== null && rh !== null && (rw <= 0 || rh <= 0)) {
      errors.push('element_rect w/h must be greater than zero');
    } else if (rx !== null && ry !== null && rw !== null && rh !== null) {
      rect = { x: Math.round(rx), y: Math.round(ry), w: Math.round(rw), h: Math.round(rh) };
    }
  }

  // Purchase events: revenue must be a finite non-negative number.
  const rev = numOrNull(revenue);
  if (event_type === 'purchase') {
    if (rev === null || Number.isNaN(rev)) {
      errors.push('purchase events require a numeric revenue');
    } else if (rev < 0) {
      errors.push('purchase revenue must be zero or greater');
    }
  }
  let safeItems;
  if (Array.isArray(items)) {
    safeItems = items
      .slice(0, 100)
      .map((it) => ({
        product_id: strOrNull(it?.product_id, 120),
        name: strOrNull(it?.name, 160),
        qty: Number.isFinite(Number(it?.qty)) ? Math.max(0, Math.round(Number(it.qty))) : 0,
        unit_price: Number.isFinite(Number(it?.unit_price)) ? Number(it.unit_price) : null,
      }))
      .filter((it) => it.product_id || it.name);
  }

  for (const [key, raw] of [
    ['viewport_width', viewport_width],
    ['viewport_height', viewport_height],
    ['page_width', page_width],
    ['page_height', page_height],
  ]) {
    const n = numOrNull(raw);
    if (Number.isNaN(n)) errors.push(`${key} must be a number when provided`);
  }

  const source = data_source === undefined || data_source === null || data_source === '' ? 'live' : data_source;
  if (!SOURCES.includes(source)) errors.push('data_source must be one of: live, demo');

  if (errors.length > 0) return { ok: false, errors };

  const tag = strOrNull(element_tag, 20)?.toUpperCase() ?? null;
  // Defense in depth: never persist text captured from editable fields.
  const sensitive = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

  return {
    ok: true,
    value: {
      session_id: String(session_id).trim(),
      event_type,
      page_url: String(page_url),
      timestamp: ts,
      x: cx,
      y: cy,
      viewport_width: numOrNull(viewport_width) ?? null,
      viewport_height: numOrNull(viewport_height) ?? null,
      page_width: numOrNull(page_width) ?? null,
      page_height: numOrNull(page_height) ?? null,
      data_source: source,
      element_tag: tag,
      element_id: strOrNull(element_id, 120),
      element_classes: strOrNull(element_classes, 200),
      element_text: sensitive ? null : strOrNull(element_text, 120),
      element_href: strOrNull(element_href, 500),
      element_section: strOrNull(element_section, 120),
      element_key: strOrNull(element_key, 160),
      element_rect: rect,
      order_id: strOrNull(order_id, 64),
      revenue: rev === null || Number.isNaN(rev) ? null : rev,
      currency: strOrNull(currency, 8),
      items: safeItems,
    },
  };
}

/** Parse ?source= query param. Defaults to 'all'. */
export function parseSource(q) {
  const s = String(q ?? 'all').toLowerCase();
  return ['live', 'demo'].includes(s) ? s : 'all';
}

export function parsePagination(q, maxLimit = 100) {
  const page = Math.max(1, parseInt(q?.page ?? '1', 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(q?.limit ?? '20', 10) || 20));
  return { page, limit };
}
