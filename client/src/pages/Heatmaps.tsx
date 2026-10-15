import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, RefreshCw, RotateCcw, X } from 'lucide-react';
import { getClicks, getElements, getHealth, getPages } from '../lib/api';
import type { ClickPoint, ElementStat, HealthData, PageInfo, Source } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { EmptyState, ErrorBox, Loading, SourceBanner, SourceFilter } from '../components/ui';

const CANVAS_H = 480;
const MAX_RENDERED = 5000;
const CLUSTER_CELL = 90;
const MAX_HOTSPOTS = 8;

type RampStop = [number, number, number, number, number];
const PALETTES: Record<string, RampStop[]> = {
  thermal: [
    [0.0, 0, 0, 0, 0],
    [0.22, 34, 197, 94, 90],
    [0.48, 250, 204, 21, 115],
    [0.74, 249, 115, 22, 135],
    [1.0, 239, 68, 68, 150],
  ],
  inferno: [
    [0.0, 0, 0, 0, 0],
    [0.25, 87, 16, 110, 115],
    [0.5, 188, 55, 84, 150],
    [0.75, 249, 142, 50, 170],
    [1.0, 252, 255, 164, 195],
  ],
  ocean: [
    [0.0, 0, 0, 0, 0],
    [0.25, 34, 211, 238, 110],
    [0.5, 59, 130, 246, 145],
    [0.75, 99, 102, 241, 170],
    [1.0, 168, 85, 247, 195],
  ],
};

function rampColor(t: number, pal: RampStop[]): [number, number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < pal.length; i++) {
    if (x <= pal[i][0]) {
      const [x0, r0, g0, b0, a0] = pal[i - 1];
      const [x1, r1, g1, b1, a1] = pal[i];
      const f = (x - x0) / Math.max(1e-6, x1 - x0);
      return [
        Math.round(r0 + (r1 - r0) * f),
        Math.round(g0 + (g1 - g0) * f),
        Math.round(b0 + (b1 - b0) * f),
        Math.round(a0 + (a1 - a0) * f),
      ];
    }
  }
  const [, r, g, b, a] = pal[pal.length - 1];
  return [r, g, b, a];
}

interface Dot {
  left: number;
  top: number;
  click: ClickPoint;
}

interface Hotspot {
  key: string;
  cx: number;
  cy: number;
  count: number;
  sessions: string[];
  latest: string;
  label: string;
  section: string | null;
}

/** Grid-cluster display-space dots into ranked hotspots with real metrics. */
function clusterDots(dots: Dot[]): Hotspot[] {
  const cells = new Map<
    string,
    { xs: number; ys: number; clicks: ClickPoint[] }
  >();
  for (const d of dots) {
    const key = `${Math.floor(d.left / CLUSTER_CELL)}:${Math.floor(d.top / CLUSTER_CELL)}`;
    if (!cells.has(key)) cells.set(key, { xs: 0, ys: 0, clicks: [] });
    const c = cells.get(key)!;
    c.xs += d.left;
    c.ys += d.top;
    c.clicks.push(d.click);
  }
  const out: Hotspot[] = [];
  for (const [key, c] of cells) {
    const sessions = [...new Set(c.clicks.map((k) => k.session_id))];
    let latest = c.clicks[0].timestamp;
    const texts = new Map<string, number>();
    const tags = new Map<string, number>();
    const sections = new Map<string, number>();
    for (const k of c.clicks) {
      if (k.timestamp > latest) latest = k.timestamp;
      if (k.element_text) texts.set(k.element_text, (texts.get(k.element_text) ?? 0) + 1);
      if (k.element_tag) tags.set(k.element_tag, (tags.get(k.element_tag) ?? 0) + 1);
      if (k.element_section) sections.set(k.element_section, (sections.get(k.element_section) ?? 0) + 1);
    }
    const top = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const text = top(texts);
    const tag = top(tags);
    out.push({
      key,
      cx: c.xs / c.clicks.length,
      cy: c.ys / c.clicks.length,
      count: c.clicks.length,
      sessions,
      latest,
      label: text ? `“${text}”` : tag ?? 'Page interaction',
      section: top(sections),
    });
  }
  return out.sort((a, b) => b.count - a.count).slice(0, MAX_HOTSPOTS);
}

type Range = 'all' | '24h' | '7d';
type Viewport = 'all' | 'desktop' | 'mobile';

export default function Heatmaps() {
  const [source, setSource] = useState<Source>('all');
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [pageUrl, setPageUrl] = useState('');
  const [clicks, setClicks] = useState<ClickPoint[]>([]);
  const [range, setRange] = useState<Range>('all');
  const [viewport, setViewport] = useState<Viewport>('all');
  const [dotSize, setDotSize] = useState(14);
  const [view, setView] = useState<'heat' | 'dots'>('heat');
  const [surface, setSurface] = useState<'preview' | 'canvas'>('preview');
  // Element mode = the precise, reference-quality per-element heatmap.
  // Pixel mode = the original page-wide density canvas (kept as a fallback).
  const [mode, setMode] = useState<'element' | 'pixels'>('element');
  const [elements, setElements] = useState<ElementStat[]>([]);
  const [elementTotals, setElementTotals] = useState({ clicks: 0, revenue: 0 });
  const [hoverEl, setHoverEl] = useState<string | null>(null);
  const [palette, setPalette] = useState<string>('thermal');
  const [normalize, setNormalize] = useState(true);
  const [opacity, setOpacity] = useState(0.8);
  const [live, setLive] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [hover, setHover] = useState<{ x: number; y: number; count: number } | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState('');
  const [loadingPages, setLoadingPages] = useState(true);
  const [loadingClicks, setLoadingClicks] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [boxW, setBoxW] = useState(900);

  const rangeFrom = (r: Range): string | undefined => {
    if (r === '24h') return new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    if (r === '7d') return new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    return undefined;
  };

  const loadAll = useCallback(async () => {
    setLoadingPages(true);
    setError('');
    try {
      const [pg, h] = await Promise.all([
        getPages(source),
        getHealth().catch(() => null),
      ]);
      setPages(pg);
      setHealth(h);
      setPageUrl((prev) => (pg.some((p) => p.page_url === prev) ? prev : (pg[0]?.page_url ?? '')));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pages');
    } finally {
      setLoadingPages(false);
    }
  }, [source]);

  useEffect(() => {
    setSelectedKey(null);
    loadAll();
  }, [loadAll]);

  const loadClicks = useCallback(async (silent = false) => {
    if (!pageUrl) {
      setClicks([]);
      return;
    }
    if (!silent) setLoadingClicks(true);
    try {
      setClicks(await getClicks(pageUrl, source, rangeFrom(range)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load clicks');
    } finally {
      if (!silent) setLoadingClicks(false);
    }
  }, [pageUrl, source, range]);

  useEffect(() => {
    setSelectedKey(null);
    loadClicks();
  }, [loadClicks]);

  // Element-anchored rows for the current page. Fails soft (older backends
  // lack /api/elements) so the page still works in pixel mode.
  const loadElements = useCallback(async () => {
    if (!pageUrl) {
      setElements([]);
      return;
    }
    try {
      const body = await getElements(pageUrl, source, 60);
      setElements(body.data ?? []);
      setElementTotals({ clicks: body.total_clicks ?? 0, revenue: body.total_revenue ?? 0 });
    } catch {
      setElements([]);
      setElementTotals({ clicks: 0, revenue: 0 });
    }
  }, [pageUrl, source]);

  useEffect(() => {
    loadElements();
  }, [loadElements]);

  useEffect(() => {
    if (!live || !pageUrl) return;
    const t = setInterval(() => {
      loadClicks(true);
      loadElements();
    }, 5000);
    return () => clearInterval(t);
  }, [live, pageUrl, loadClicks, loadElements]);

  useEffect(() => {
    const measure = () => setBoxW(boxRef.current?.clientWidth ?? 900);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const { refW, refH } = useMemo(() => {
    const w = Math.max(320, ...clicks.map((c) => c.page_width ?? c.x ?? 0));
    const h = Math.max(600, ...clicks.map((c) => c.page_height ?? (c.y ?? 0) + 200));
    return { refW: Math.round(w), refH: Math.round(h) };
  }, [clicks]);

  const previewable = useMemo(() => {
    try {
      return pageUrl !== '' && new URL(pageUrl).origin === window.location.origin;
    } catch {
      return false;
    }
  }, [pageUrl]);
  const showPreview = previewable && surface === 'preview';
  const dispH = showPreview ? Math.max(320, Math.round((refH * boxW) / refW)) : CANVAS_H;

  // Viewport filter is applied client-side on stored viewport metadata.
  // Clicks without metadata are counted as desktop and labeled as such.
  const visible = useMemo(() => {
    if (viewport === 'all') return clicks;
    return clicks.filter((c) => {
      const w = c.viewport_width ?? 1440;
      return viewport === 'desktop' ? w >= 1024 : w < 1024;
    });
  }, [clicks, viewport]);

  const dots: Dot[] = useMemo(() => {
    const sx = boxW / refW;
    const sy = dispH / refH;
    return visible.map((c) => ({ left: (c.x ?? 0) * sx, top: (c.y ?? 0) * sy, click: c }));
  }, [visible, boxW, dispH, refW, refH]);

  const hotspots = useMemo(() => clusterDots(dots), [dots]);
  const selected = hotspots.find((h) => h.key === selectedKey) ?? null;
  const totalSessions = useMemo(() => new Set(visible.map((c) => c.session_id)).size, [visible]);

  const previewSrc = useMemo(() => {
    try {
      const u = new URL(pageUrl);
      u.searchParams.set('notrack', '1');
      return u.toString();
    } catch {
      return '';
    }
  }, [pageUrl]);

  useEffect(() => {
    if (!showPreview && view !== 'heat') return;
    const canvas = canvasRef.current;
    if (!canvas || boxW <= 0) return;
    const W = Math.round(boxW);
    const H = dispH;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    const sample = dots.slice(0, MAX_RENDERED);
    if (sample.length === 0) return;

    // True gaussian density surface in a float grid (no 8-bit clamping, so
    // overlapping clicks sum into smooth hills instead of flat red plates).
    const R = Math.max(36, dotSize * 3.2);
    const sigma = R / 2.2;
    const rad = Math.ceil(sigma * 3);
    const twoS2 = 2 * sigma * sigma;
    const dens = new Float32Array(W * H);
    let peak = 0;
    for (const d of sample) {
      const x0 = Math.max(0, Math.floor(d.left - rad));
      const x1 = Math.min(W - 1, Math.ceil(d.left + rad));
      const y0 = Math.max(0, Math.floor(d.top - rad));
      const y1 = Math.min(H - 1, Math.ceil(d.top + rad));
      for (let y = y0; y <= y1; y++) {
        const dy = y - d.top;
        for (let x = x0; x <= x1; x++) {
          const dx = x - d.left;
          const v = Math.exp(-(dx * dx + dy * dy) / twoS2);
          const idx = y * W + x;
          dens[idx] += v;
          if (dens[idx] > peak) peak = dens[idx];
        }
      }
    }
    if (peak <= 0) return;
    const pal = PALETTES[palette] ?? PALETTES.thermal;
    const out = ctx.createImageData(W, H);
    for (let i = 0; i < dens.length; i++) {
      const v = dens[i];
      if (v <= 0.01) continue;
      // Square-root compression spreads mid-density across yellow/green.
      const t = normalize ? Math.sqrt(v / peak) : Math.min(1, v / 8);
      if (t <= 0.02) continue;
      const [r, g, b, a] = rampColor(t, pal);
      const o = i * 4;
      out.data[o] = r;
      out.data[o + 1] = g;
      out.data[o + 2] = b;
      out.data[o + 3] = Math.round(a * opacity);
    }
    ctx.putImageData(out, 0, 0);
  }, [dots, boxW, dispH, showPreview, dotSize, view, palette, normalize, opacity]);

  const legendBg = useMemo(() => {
    const stops = (PALETTES[palette] ?? PALETTES.thermal)
      .slice(1)
      .map(([t, r, g, b]) => `rgb(${r},${g},${b}) ${(t * 100).toFixed(0)}%`)
      .join(', ');
    return `linear-gradient(90deg, ${stops})`;
  }, [palette]);

  const inspect = (clientX: number, clientY: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || dots.length === 0) {
      setHover(null);
      return;
    }
    const scale = rect.width / (boxW * zoom);
    const x = (clientX - rect.left) / scale;
    const y = (clientY - rect.top) / scale;
    const R = Math.max(18, dotSize * 2.4);
    const lim = Math.min(dots.length, 2000);
    let n = 0;
    for (let i = 0; i < lim; i++) {
      const dx = dots[i].left - x;
      const dy = dots[i].top - y;
      if (dx * dx + dy * dy <= R * R) n++;
    }
    setHover({ x, y, count: n });
  };

  const zoomTo = (z: number) => setZoom(Math.min(2, Math.max(0.5, Math.round(z * 100) / 100)));

  return (
    <div className="flex flex-col gap-5">
      {/* A. Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Click Heatmaps</h1>
          <p className="text-sm text-slate-500">Understand where users interact with your website.</p>
        </div>
        <div className="flex items-center gap-2">
          {health && (
            <span
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
                health.db === 'mongodb' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
              title={`Backend: connected, database: ${health.db}`}
            >
              ● {health.db === 'mongodb' ? 'MongoDB live' : 'memory store'}
            </span>
          )}
          <SourceFilter value={source} onChange={setSource} />
          <button
            onClick={() => { loadAll(); loadClicks(); }}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-600"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <SourceBanner source={source} />
      {loadingPages && <Loading label="Loading pages…" />}
      {error && !loadingPages && <ErrorBox message={error} onRetry={loadAll} />}

      {!loadingPages && !error && pages.length === 0 && (
        <EmptyState
          title="No tracked pages yet"
          hint="Open the Everyday Market storefront (/store) and click around, or seed demo data: cd server && npm run seed:demo — then refresh."
        />
      )}

      {!loadingPages && !error && pages.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          {/* B. Filter toolbar — every control changes the data below */}
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="page-select" className="text-sm font-medium text-slate-500">Page</label>
            <select
              id="page-select"
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
              className="max-w-full flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs shadow-sm focus:border-indigo-500 focus:outline-none md:text-sm"
            >
              {pages.map((p) => (
                <option key={p.page_url} value={p.page_url}>
                  {p.page_url} ({p.clicks} clicks)
                </option>
              ))}
            </select>
            <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
              Clicks
            </span>
            <label className="flex items-center gap-2 text-sm text-slate-500">
              Date
              <select
                aria-label="Date range"
                value={range}
                onChange={(e) => setRange(e.target.value as Range)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-medium shadow-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">All time</option>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-500">
              Device
              <select
                aria-label="Viewport filter"
                value={viewport}
                onChange={(e) => setViewport(e.target.value as Viewport)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-medium shadow-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">All viewports</option>
                <option value="desktop">Desktop ≥1024px</option>
                <option value="mobile">Mobile &lt;1024px</option>
              </select>
            </label>
            <span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold tabular-nums text-white">
              {loadingClicks ? '…' : `${visible.length} clicks · ${totalSessions} sessions`}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
            <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-bold" role="group" aria-label="Heatmap mode">
              <button
                onClick={() => setMode('element')}
                aria-pressed={mode === 'element'}
                title="Heat anchored to each real control/product, with per-element revenue metrics"
                className={`rounded-md px-3 py-1.5 ${mode === 'element' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Elements
              </button>
              <button
                onClick={() => setMode('pixels')}
                aria-pressed={mode === 'pixels'}
                title="Page-wide click density canvas (raw coordinates)"
                className={`rounded-md px-3 py-1.5 ${mode === 'pixels' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Pixels
              </button>
            </div>
            <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-bold" role="group" aria-label="Display surface">
              <button
                onClick={() => previewable && setSurface('preview')}
                disabled={!previewable}
                aria-pressed={showPreview}
                title={previewable ? 'Heat overlay on the live page' : 'Page preview is only available for same-origin URLs'}
                className={`rounded-md px-3 py-1.5 ${showPreview ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800 disabled:opacity-40'}`}
              >
                Preview
              </button>
              <button
                onClick={() => setSurface('canvas')}
                aria-pressed={!showPreview}
                title="Scaled coordinate canvas"
                className={`rounded-md px-3 py-1.5 ${!showPreview ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Canvas
              </button>
            </div>
            {!showPreview && (
              <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-bold" role="group" aria-label="Heatmap style">
                {(['heat', 'dots'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    className={`rounded-md px-3 py-1.5 capitalize ${view === v ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {v === 'heat' ? 'Heat' : 'Dots'}
                  </button>
                ))}
              </div>
            )}
            <label htmlFor="dot-size" className="flex items-center gap-2 text-sm text-slate-500">
              {showPreview || view === 'heat' ? 'Radius' : 'Marker'}
              <input id="dot-size" type="range" min={8} max={28} value={dotSize}
                onChange={(e) => setDotSize(Number(e.target.value))} className="accent-indigo-600" />
            </label>
            <label htmlFor="palette" className="flex items-center gap-2 text-sm text-slate-500">
              Palette
              <select id="palette" value={palette} onChange={(e) => setPalette(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-medium shadow-sm focus:border-indigo-500 focus:outline-none">
                <option value="thermal">Thermal</option>
                <option value="inferno">Inferno</option>
                <option value="ocean">Ocean</option>
              </select>
            </label>
            <label htmlFor="opacity" className="flex items-center gap-2 text-sm text-slate-500">
              Opacity
              <input id="opacity" type="range" min={30} max={100} value={Math.round(opacity * 100)}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)} className="accent-indigo-600" />
            </label>
            <button onClick={() => setNormalize((v) => !v)} aria-pressed={normalize}
              title="Rescale colors to the observed peak density (dynamic coloring)"
              className={`rounded-lg px-3 py-2 text-xs font-bold ${normalize ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-800'}`}>
              Auto-scale {normalize ? 'ON' : 'OFF'}
            </button>
            <button onClick={() => setLive((v) => !v)} aria-pressed={live}
              title="Re-fetch clicks every 5 seconds and stream them onto the map"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${live ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-800'}`}>
              <span className={`h-2 w-2 rounded-full ${live ? 'animate-pulse bg-white' : 'bg-slate-400'}`} />
              {live ? 'LIVE' : 'Go live'}
            </button>
            <div className="ml-auto flex items-center gap-1" role="group" aria-label="Zoom">
              <button onClick={() => zoomTo(zoom - 0.25)} disabled={zoom <= 0.5} aria-label="Zoom out"
                className="rounded-lg border border-slate-300 p-2 disabled:opacity-40 hover:bg-slate-50"><Minus size={14} /></button>
              <span className="w-12 text-center text-xs font-bold tabular-nums">{Math.round(zoom * 100)}%</span>
              <button onClick={() => zoomTo(zoom + 0.25)} disabled={zoom >= 2} aria-label="Zoom in"
                className="rounded-lg border border-slate-300 p-2 disabled:opacity-40 hover:bg-slate-50"><Plus size={14} /></button>
              <button onClick={() => zoomTo(1)} aria-label="Reset zoom"
                className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50"><RotateCcw size={14} /></button>
            </div>
          </div>

          {/* C1. Element-anchored heatmap — precise, per-control blobs + revenue */}
          {mode === 'element' && (
            <div className="mt-4">
              {elements.length === 0 ? (
                <div className="rounded-xl bg-slate-100 p-10 text-center ring-1 ring-slate-200">
                  <p className="text-sm font-bold text-slate-500">
                    No element-anchored clicks yet for this page.
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-400">
                    Element heat appears once visitors click real controls that carry a{' '}
                    <code className="rounded bg-slate-200 px-1">data-analytics-id</code>. Browse the
                    demo store (products, a product page, filters, cart) to generate them, then refresh.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {elements.map((el) => {
                    const pct =
                      elementTotals.clicks > 0
                        ? Math.round((el.clicks / elementTotals.clicks) * 1000) / 10
                        : 0;
                    const open = hoverEl === el.element_key;
                    return (
                      <div
                        key={el.element_key}
                        onMouseEnter={() => setHoverEl(el.element_key)}
                        onMouseLeave={() => setHoverEl((k) => (k === el.element_key ? null : k))}
                        className={`rounded-2xl bg-white p-4 shadow-sm ring-1 transition ${
                          open ? 'ring-emerald-400' : 'ring-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800">
                                #{el.rank}
                              </span>
                              <p className="truncate text-sm font-extrabold uppercase tracking-wide text-slate-800">
                                {el.label}
                              </p>
                            </div>
                            {el.section && (
                              <p className="mt-0.5 text-[11px] text-slate-400">§ {el.section}</p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-lg font-extrabold tabular-nums text-slate-900">
                              {el.clicks.toLocaleString()}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">clicks</p>
                          </div>
                        </div>

                        {/* heat bar — click share, the "most clickable" signal */}
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-red-500"
                            style={{ width: `${Math.max(3, pct)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-slate-400">
                          {pct}% of this page&apos;s clicks
                        </p>

                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                          <div className="flex justify-between border-b border-slate-100 py-1">
                            <dt className="text-slate-500">Sessions</dt>
                            <dd className="font-bold tabular-nums">{el.sessions.toLocaleString()}</dd>
                          </div>
                          <div className="flex justify-between border-b border-slate-100 py-1">
                            <dt className="text-slate-500">Purchases</dt>
                            <dd className="font-bold tabular-nums">{el.purchases.toLocaleString()}</dd>
                          </div>
                          <div className="flex justify-between border-b border-slate-100 py-1">
                            <dt className="text-slate-500">Revenue</dt>
                            <dd className="font-bold tabular-nums text-emerald-700">${el.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
                          </div>
                          <div className="flex justify-between border-b border-slate-100 py-1">
                            <dt className="text-slate-500">Avg. Order Value</dt>
                            <dd className="font-bold tabular-nums">${el.aov.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
                          </div>
                          <div className="flex justify-between border-b border-slate-100 py-1">
                            <dt className="text-slate-500">Conversion Rate</dt>
                            <dd className="font-bold tabular-nums">{el.conversion_rate.toFixed(2)}%</dd>
                          </div>
                          <div className="flex justify-between border-b border-slate-100 py-1">
                            <dt className="text-slate-500">Rev. per click</dt>
                            <dd className="font-bold tabular-nums">${el.revenue_per_click.toFixed(2)}</dd>
                          </div>
                        </dl>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700">
                  {elements.length} elements · {elementTotals.clicks.toLocaleString()} clicks
                  {elementTotals.revenue > 0 && ` · $${elementTotals.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} revenue`}
                </span>
                <span>ranked by clicks — each card is one real control</span>
                {live && (
                  <span className="flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-red-700">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-600" /> streaming
                  </span>
                )}
              </div>
            </div>
          )}

          {/* C2. Pixel density canvas (original coordinate mode) */}
          {mode === 'pixels' && (
          <>
          <div className="mt-4 rounded-xl bg-slate-100 p-3 ring-1 ring-slate-200">
            <div ref={boxRef} className="max-h-[720px] overflow-auto rounded-lg">
              <div style={{ width: Math.round(boxW * zoom), height: Math.round(dispH * zoom) }} className="relative">
                <div
                  onMouseMove={(e) => inspect(e.clientX, e.clientY)}
                  onMouseLeave={() => setHover(null)}
                  className="relative origin-top-left overflow-hidden bg-white ring-1 ring-indigo-200"
                  style={{
                    width: Math.round(boxW),
                    height: dispH,
                    transform: `scale(${zoom})`,
                    ...(showPreview
                      ? {}
                      : {
                          backgroundImage:
                            'repeating-linear-gradient(0deg, #f8fafc 0 39px, #e2e8f0 39px 40px), repeating-linear-gradient(90deg, #f8fafc 0 39px, #e2e8f0 39px 40px)',
                        }),
                  }}
                  role="img"
                  aria-label={`Scaled click map for ${pageUrl} with ${visible.length} clicks`}
                >
                  {showPreview && (
                    <iframe
                      src={previewSrc}
                      title={`Preview of ${pageUrl}`}
                      scrolling="no"
                      tabIndex={-1}
                      className="pointer-events-none absolute inset-0 h-full w-full border-0 bg-white"
                    />
                  )}
                  {(showPreview || view === 'heat') && (
                    <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                  )}
                  {!showPreview &&
                    view === 'dots' &&
                    dots.map((d, i) => (
                      <span
                        key={i}
                        title={`${d.click.element_tag ?? 'click'}${d.click.element_text ? ` “${d.click.element_text}”` : ''} @ (${d.click.x}, ${d.click.y}) · ${d.click.session_id} · ${fmtDateTime(d.click.timestamp)}`}
                        className="absolute rounded-full border-2 border-red-800/80 bg-red-500/55 hover:bg-red-500/90"
                        style={{ left: d.left, top: d.top, width: dotSize, height: dotSize, transform: 'translate(-50%, -50%)' }}
                      />
                    ))}
                  {(showPreview || view === 'heat') &&
                    hotspots.map((h, i) => (
                      <button
                        key={h.key}
                        onClick={() => setSelectedKey((prev) => (prev === h.key ? null : h.key))}
                        aria-pressed={selectedKey === h.key}
                        aria-label={`Hotspot ${i + 1}: ${h.count} clicks, ${h.label}`}
                        title={`${h.count} clicks — ${h.label}`}
                        className={`absolute z-10 flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold shadow-lg ring-2 ring-white transition-transform hover:scale-110 ${
                          selectedKey === h.key ? 'bg-indigo-600 text-white' : 'bg-slate-900/85 text-white'
                        }`}
                        style={{ left: h.cx, top: h.cy, transform: 'translate(-50%, -50%)' }}
                      >
                        #{i + 1}
                      </button>
                    ))}
                  {!loadingClicks && dots.length === 0 && (
                    <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-400">
                      No clicks recorded for this page with the current source, date and device filters.
                      Try widening the date range or visit the demo storefront to generate interactions.
                    </p>
                  )}
                  {hover && dots.length > 0 && (
                    <span
                      className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg"
                      style={{ left: Math.min(hover.x + 14, Math.max(0, boxW - 170)), top: Math.max(hover.y - 34, 4) }}
                    >
                      {hover.count} click{hover.count === 1 ? '' : 's'} in brush radius
                    </span>
                  )}
                  {/* Floating hotspot card — metrics computed from the selected dataset */}
                  {selected && (
                    <div
                      className="absolute z-20 w-72 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-200"
                      style={{
                        left: selected.cx > boxW * 0.55 ? Math.max(8, selected.cx - 300) : Math.min(selected.cx + 16, Math.max(8, boxW - 296)),
                        top: Math.min(Math.max(8, selected.cy - 40), Math.max(8, dispH - 300)),
                      }}
                      role="dialog"
                      aria-label={`Hotspot ${hotspots.indexOf(selected) + 1} details`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-800">
                          #{hotspots.indexOf(selected) + 1}
                        </span>
                        <button onClick={() => setSelectedKey(null)} aria-label="Close hotspot details"
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <X size={15} />
                        </button>
                      </div>
                      <p className="mt-1.5 break-words text-sm font-extrabold leading-snug">{selected.label}</p>
                      {selected.section && <p className="text-[11px] font-medium text-slate-400">§ {selected.section}</p>}
                      <dl className="mt-2 divide-y divide-slate-100 text-[13px]">
                        <div className="flex justify-between py-1.5"><dt className="text-slate-500">Clicks</dt><dd className="font-bold tabular-nums">{selected.count}</dd></div>
                        <div className="flex justify-between py-1.5"><dt className="text-slate-500">Share of page clicks</dt><dd className="font-bold tabular-nums">{visible.length > 0 ? ((selected.count / visible.length) * 100).toFixed(1) : '0.0'}%</dd></div>
                        <div className="flex justify-between py-1.5"><dt className="text-slate-500">Unique sessions</dt><dd className="font-bold tabular-nums">{selected.sessions.length}</dd></div>
                        <div className="flex justify-between py-1.5"><dt className="text-slate-500">Most recent</dt><dd className="font-bold">{fmtDateTime(selected.latest)}</dd></div>
                      </dl>
                      <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] leading-snug text-slate-400">
                        Revenue metrics not tracked — no purchase events are recorded.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {(showPreview || view === 'heat') && dots.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
              <span>Fewer clicks</span>
              <span className="h-2.5 w-40 rounded-full" style={{ background: legendBg }} />
              <span>More clicks</span>
              {normalize && <span className="ml-1 rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700">auto-scaled to peak density</span>}
              {live && <span className="ml-1 flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-red-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-600" /> streaming</span>}
              {clicks.length > MAX_RENDERED && (
                <span className="ml-2">showing density for first {MAX_RENDERED.toLocaleString()} clicks</span>
              )}
            </div>
          )}

          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            {showPreview ? (
              <>
                Live page preview with recorded clicks overlaid ({refW}×{refH}px → {Math.round(boxW)}×{dispH}px,
                zoom {Math.round(zoom * 100)}%). Coordinates are scaled from each click&apos;s recorded viewport;
                clicks without viewport metadata are treated as desktop. The preview is non-interactive and
                records no events (?notrack=1). Click a numbered hotspot for its metrics.
              </>
            ) : (
              <>
                Scaled coordinate canvas ({refW}×{refH}px → {Math.round(boxW)}×{CANVAS_H}px). Positions preserve
                the relative layout of the original page — a coordinate map, not an exact replay. Click a
                numbered hotspot for its metrics; hover a dot for session details.
              </>
            )}
          </p>
          </>
          )}
        </div>
      )}
    </div>
  );
}
