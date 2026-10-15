export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  // Single-process deploy (Render/Heroku/`node src/index.js`): the React app and
  // the API share one origin, so use relative paths — no host to hardcode.
  (import.meta.env.PROD ? '' : 'http://localhost:5001');

export const BACKEND_ORIGIN = (() => {
  if (API_BASE === '') return window.location.origin;
  try {
    return new URL(API_BASE).origin;
  } catch {
    return API_BASE;
  }
})();

export type Source = 'all' | 'live' | 'demo';

export interface SessionSummary {
  session_id: string;
  total_events: number;
  page_views: number;
  clicks: number;
  data_sources: string[];
  first_seen: string;
  last_seen: string;
}

export interface EventItem {
  _id?: string;
  session_id: string;
  event_type: 'page_view' | 'click';
  page_url: string;
  timestamp: string;
  x?: number | null;
  y?: number | null;
  viewport_width?: number | null;
  viewport_height?: number | null;
  page_width?: number | null;
  page_height?: number | null;
  data_source: 'live' | 'demo';
  element_tag?: string | null;
  element_id?: string | null;
  element_classes?: string | null;
  element_text?: string | null;
  element_href?: string | null;
  element_section?: string | null;
}

export interface PageInfo {
  page_url: string;
  events: number;
  clicks: number;
}

export interface ClickPoint {
  x: number;
  y: number;
  timestamp: string;
  session_id: string;
  viewport_width?: number | null;
  viewport_height?: number | null;
  page_width?: number | null;
  page_height?: number | null;
  data_source: 'live' | 'demo';
  element_tag?: string | null;
  element_text?: string | null;
  element_section?: string | null;
  element_key?: string | null;
  element_rect?: { x: number; y: number; w: number; h: number } | null;
}

/** One row from GET /api/elements — an element-anchored hotspot with metrics. */
export interface ElementStat {
  element_key: string;
  label: string;
  tag?: string | null;
  section?: string | null;
  href?: string | null;
  rank: number;
  clicks: number;
  sessions: number;
  purchases: number;
  revenue: number;
  aov: number;
  conversion_rate: number;
  revenue_per_click: number;
  revenue_per_session: number;
  rect?: { x: number; y: number; w: number; h: number } | null;
  latest?: string | null;
}

export interface ElementsResponse {
  page_url: string;
  source: Source;
  count: number;
  total_clicks: number;
  total_revenue: number;
  data: ElementStat[];
}

export interface DayDatum {
  date: string;
  events: number;
  page_views: number;
  clicks: number;
}

export interface OverviewData {
  source: Source;
  total_sessions: number;
  total_events: number;
  page_views: number;
  clicks: number;
  by_day: DayDatum[];
  top_pages: { page_url: string; events: number }[];
  top_elements: { tag: string; text: string; clicks: number }[];
}

export interface HealthData {
  ok: boolean;
  db: 'mongodb' | 'memory';
  uptime_seconds: number;
  timestamp: string;
}

async function api<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`);
  } catch {
    throw new Error(`Cannot reach the API at ${API_BASE}. Is the backend running?`);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    throw new Error(`API returned a non-JSON response (${res.status}).`);
  }
  if (!res.ok) {
    const msg =
      typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

interface Envelope<D> {
  ok: boolean;
  data: D;
}

export const getHealth = () => api<HealthData>('/api/health');

export const getOverview = (source: Source) =>
  api<OverviewData>(`/api/overview?source=${source}`);

export interface SessionsResponse {
  data: SessionSummary[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export const getSessions = (source: Source, search: string, page: number, limit = 12) =>
  api<SessionsResponse>(
    `/api/sessions?source=${source}&search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`
  );

export const getSessionEvents = async (id: string, source: Source) => {
  const body = await api<Envelope<EventItem[]>>(
    `/api/sessions/${encodeURIComponent(id)}/events?source=${source}`
  );
  return body.data;
};

export const getPages = async (source: Source) => {
  const body = await api<Envelope<PageInfo[]>>(`/api/pages?source=${source}`);
  return body.data;
};

export const getClicks = async (url: string, source: Source, from?: string) => {
  const params = new URLSearchParams({ url, source });
  if (from) params.set('from', from);
  const body = await api<Envelope<ClickPoint[]>>(`/api/clicks?${params.toString()}`);
  return body.data;
};

export const getElements = (url: string, source: Source, limit = 60) =>
  api<ElementsResponse>(
    `/api/elements?url=${encodeURIComponent(url)}&source=${source}&limit=${limit}`
  );
