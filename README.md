# CausalFunnel Analytics — User Behavior Platform

A full-stack web analytics MVP: a demo storefront generates real browser events through a standalone
tracking script → an Express API validates and stores them in MongoDB → a React dashboard shows
sessions, user journeys and click heatmaps.

## Features

- **Everyday Market demo store** (React + Router): home, searchable/filterable/sortable
  56-product catalog across 7 categories, product detail with gallery/ratings/related items,
  cart drawer with quantities and checkout.
- **Standalone `tracker.js`**: `page_view` on load + SPA route changes (no double-counting),
  `click` with x/y + viewport/page dimensions, `localStorage` sessions with a 30-minute inactivity
  timeout, `sendBeacon` with `fetch` fallback. Served by the backend at `GET /tracker.js`.
- **Backend APIs** (Node + Express ESM + Mongoose): event ingest with validation, session summaries,
  chronological journeys, click coordinates, page lists, overview metrics, health check.
- **Dashboard** (React + TS + Tailwind + Router + Recharts + Lucide): Overview charts, Sessions table
  with search/pagination, per-session journey timeline, coordinate-accurate click heatmaps, and a
  Tracking Setup page that generates install instructions from live config.
- **Live vs demo separation**: tracker events are `data_source: "live"`; `npm run seed:demo` inserts
  ~24 clearly-labeled simulated sessions (`data_source: "demo"`, idempotent, never touches live data).
  Every view has an All / Live / Demo filter with an explicit banner.

## Tech stack

| Layer | Technology |
|---|---|
| Storefront + dashboard | React 18, TypeScript, Vite, Tailwind CSS v4, React Router, Recharts, Lucide |
| Tracking | Dependency-free vanilla JS (`tracker/tracker.js`) |
| Backend | Node.js 18+, Express 4 (ES modules), Mongoose, dotenv, express-rate-limit, CORS |
| Database | MongoDB Atlas (any `MONGODB_URI` works); transparent in-memory fallback for offline dev |

## Architecture

```
Everyday Market (/store/*) ──tracker.js──▶ POST /api/events ──▶ MongoDB (events)
        │ boils down to page_view + click + session_id        │
        ▼                                                     ▼
React dashboard (/, /sessions, /heatmaps, /setup) ──▶ analytics APIs ──▶ aggregations
```

Only storefront routes load the tracker, so dashboard usage is never recorded and page views can't
be double-counted. The frontend never talks to MongoDB directly.

## Repository structure

```
.
├── client/           # Vite React+TS app: dashboard + Everyday Market store
│   ├── src/pages/    # Overview, Sessions, SessionDetail, Heatmaps, Setup
│   ├── src/storefront/ # StoreLayout, StoreHome, Products, ProductDetail, CartDrawer
│   ├── src/components/ # Layout (sidebar), ui, TrackerLoader, ProductImage
│   ├── src/lib/api.ts  # typed API client (VITE_API_URL)
│   └── .env.example
├── server/           # Express ESM backend
│   ├── src/index.js  # boot, src/app.js # routes/CORS/rate-limit/errors
│   ├── src/models/Event.js, src/db.js, src/validate.js, src/memoryStore.js
│   ├── src/routes/   # events.js, analytics.js, system.js
│   ├── src/seed.js   # demo dataset generator (npm run seed:demo)
│   └── .env.example
├── tracker/tracker.js  # standalone installable script (also served at /tracker.js)
├── package.json      # root helper scripts
└── README.md
```

## Prerequisites

- Node.js 18+ and npm.
- A MongoDB connection string (Atlas recommended; local `mongodb://127.0.0.1:27017/analytics` works too).
  Without one, the API runs on a transparent in-memory store (reported by `/api/health`) so the demo
  still works — but data does not persist across restarts.

## Installation

```bash
npm run install:all
cp server/.env.example server/.env     # then set MONGODB_URI (see below)
cp client/.env.example client/.env     # default VITE_API_URL=http://localhost:5000
```

## Configure MongoDB Atlas

1. Create a free cluster at https://cloud.mongodb.com → Database Access: add a user + password.
2. Network Access: allow your IP (or `0.0.0.0/0` for quick testing).
3. Connect → Drivers → copy the `mongodb+srv://…` string.
4. Put it in `server/.env`:

```bash
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/analytics?retryWrites=true&w=majority
CLIENT_ORIGIN=http://localhost:5173
```

Never commit `.env` (gitignored). Only `.env.example` files with placeholders are committed.

## Run

```bash
# terminal 1 — backend (http://localhost:5000)
npm run dev:server
# terminal 2 — frontend (http://localhost:5173)
npm run dev:client
```

> macOS note: if port 5000 is taken by AirPlay Receiver, either disable it
> (System Settings → General → AirDrop & Handoff) or run the backend with `PORT=5001` and set
> `VITE_API_URL=http://localhost:5001` in `client/.env`.

## Seed demo data

```bash
npm run seed:demo
```

Inserts 24 simulated sessions (~112 events) across the store URLs with `data_source: "demo"`.
Safe to re-run: it deletes only existing demo events first — live events are never touched.
Requires `MONGODB_URI` (seeding the ephemeral in-memory store is not supported).

## Test live tracking

1. Open `http://localhost:5173/store` and browse: home → Products (search/filter/sort) → a product
   (qty, Add to Cart) → cart drawer → Checkout.
2. Each route change records a `page_view`; each click records a `click` with x/y.
3. Open Overview/Sessions — your visit appears as a new **live** session; open its journey and the
   heatmap for the page you clicked.
4. For heat on the real page: open any store page with `?heatmap=1`
   (e.g. `http://localhost:5173/store/products?heatmap=1`), or use the **🔥 Show heat** bookmarklet
   on the Tracking Setup page on any website you have permission to view.

## API reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/events` | Validate + store `{session_id, event_type: page_view\|click\|purchase, page_url, timestamp?, x?, y?, element_key?, element_rect?, revenue?, ...}` → `201 {ok, id}`; `400 {ok:false, error, details}` |
| GET | `/api/sessions?source=&search=&page=&limit=` | Session summaries (counts, sources, first/last seen), newest first, paginated |
| GET | `/api/sessions/:id/events?source=` | Chronological event timeline for one session |
| GET | `/api/clicks?url=&source=` | Stored click coordinates + dimensions for a page |
| GET | `/api/clicks?url=&source=&from=&to=` | Same, restricted to an ISO date range (invalid dates → 400) |
| GET | `/api/elements?url=&source=&limit=` | **Element-anchored heatmap data** — one ranked row per clicked element with sessions, purchases, revenue, AOV, conversion rate, rev/click, rev/session and its anchor rect |
| GET | `/api/heatmap?page_url=&source=` | Alias of `/api/clicks` (earlier contract) |
| GET | `/api/pages?source=` | Distinct page URLs with event/click counts |
| GET | `/api/overview?source=` | Totals + 14-day series + top pages |
| GET | `/api/health` | `{ok, db: "mongodb"\|"memory", uptime_seconds, timestamp}` |
| GET | `/tracker.js` | The standalone tracking script |
| GET | `/heatmap-overlay.js` | Read-only live heat overlay script (anchors heat to real controls; records nothing) |

`source` is `all` (default), `live` or `demo` on every analytics endpoint.

## Event schema

```jsonc
{
  "session_id": "sess_m3...",
  "event_type": "click",                 // page_view | click | purchase
  "page_url": "http://localhost:5173/store/products",
  "timestamp": "2026-10-15T07:30:00.000Z",
  "x": 420, "y": 260,                   // clicks only; null for page_view
  "viewport_width": 1440, "viewport_height": 900,
  "page_width": 1440, "page_height": 2200,
  "element_tag": "BUTTON", "element_text": "Add to Cart — Aero Wireless Headphones",
  "element_id": null, "element_classes": "btn primary",
  "element_href": null, "element_section": "products-grid",
  "element_key": "add-to-cart:aero-headphones",   // stable identity for element heat
  "element_rect": { "x": 944, "y": 651, "w": 36, "h": 36 },
  "data_source": "live",                // live | demo

  // purchase events only
  "order_id": "ord_abc123", "revenue": 348, "currency": "USD",
  "items": [{ "product_id": "aero-headphones", "qty": 2, "unit_price": 149 }]
}
```

Indexes: `{session_id, timestamp}`, `{event_type}`, `{page_url, event_type}`, `{data_source}`, `{timestamp}`, `{page_url, element_key, event_type}`.
Session summaries are derived from event records — no separate sessions collection.

## Element-anchored heatmaps

By default the heatmap and the live overlay work **per element**, not per pixel region:

- The tracker resolves a stable `element_key` for every click — `data-analytics-id` first,
  then `data-analytics-label`, then the DOM `id`, then a deterministic `auto:<hash>`.
  It also records the element's box (`element_rect`) at click time.
- `GET /api/elements` groups events by `element_key` and returns rank, clicks, sessions,
  purchases, revenue, AOV, conversion rate, revenue per click/session and an averaged anchor rect.
- The overlay **re-finds each element on the live page by key** and draws its blob on the
  element's current box, so heat stays correct across viewport sizes and layout changes.
  Elements that no longer exist fall back to their stored rect.
- Hovering a hotspot shows the reference metric card: rank, clean element name, Sessions,
  Clicks, Purchases, Revenue, Avg. Order Value, Conversion Rate, Rev. per click, Rev. per session.

Conversions are recorded through the tracker's public API, which the store's cart calls on checkout:

```js
window.CausalFunnelAnalytics.purchase({
  revenue: 348,
  currency: 'USD',
  order_id: 'ord_abc123',
  elementKey: 'add-to-cart:aero-headphones',
  items: [{ product_id: 'aero-headphones', name: 'Aero Wireless Headphones', qty: 2, unit_price: 149 }],
});
```

The original page-wide pixel canvas is still available — switch the dashboard to
**Pixels**, or set `data-mode="pixels"` / `window.HEATMAP_MODE = 'pixels'` on the overlay.

## Assumptions and trade-offs

- Session = `localStorage` ID + 30-min inactivity timeout (documented in Setup page); no login-based identity.
- **Heatmap coordinates**: the tracker records clicks in document pixels plus viewport/page dimensions.
  The dashboard scales each click from its recorded page size to the displayed surface (live iframe
  preview or coordinate canvas). Clicks without viewport metadata are treated as desktop in the device
  filter and labeled as such. If the page layout changed after capture, blobs reflect the old layout.
- **Hotspot metrics** (rank, clicks, share of page clicks, unique sessions, most recent click, dominant
  element label) are computed client-side from the filtered click dataset — never hardcoded. Revenue /
  purchase metrics are intentionally omitted: no order events exist to attribute them from.
- In-memory fallback keeps the app demoable without MongoDB, always disclosed via `/api/health` and the UI.
- No auth/roles on the dashboard (out of scope); basic rate limiting on event ingest.
- Product images use remote Unsplash CDN URLs with emoji-tile fallbacks so offline rendering never breaks.

## Privacy

The tracker collects only: session ID, event type, page URL, timestamp, click coordinates and
viewport/page dimensions. No passwords, form contents, tokens, cookies, or page text. See the
Tracking Setup page in the app.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `EADDRINUSE :5000` | macOS AirPlay uses 5000 — disable it or use `PORT=5001` + matching `VITE_API_URL` |
| Dashboard shows “Cannot reach the API” | Backend not running, or `VITE_API_URL` mismatch — restart `npm run dev` after editing `client/.env` |
| Empty dashboard, `db: memory` | Normal without MongoDB — browse the store for live data or configure `MONGODB_URI` + `npm run seed:demo` |
| `seed:demo` refuses to run | `MONGODB_URI` missing — seeding needs a real database |
| Images not loading | Offline CDN — emoji fallbacks render instead; layout is unaffected |

## Deployment

- **Database**: MongoDB Atlas (whitelist the host, use the `mongodb+srv` URI).
- **Backend**: any Node host (Render/Railway/Fly): set `PORT`, `MONGODB_URI`, `CLIENT_ORIGIN=<frontend URL>`.
- **Frontend**: `npm run build` in `client/` → deploy `dist/` to Vercel/Netlify with `VITE_API_URL=<backend URL>`.
- Update the Tracking Setup snippet domain after deploying — it is generated from your config.
- Only claim deployment once the hosted health check and a live click-through succeed.
