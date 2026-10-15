# Heatmap Accuracy — Gap Analysis vs. Reference (Latico-style)

Status: **implemented and verified in a real browser.** Sections 3–5 are kept as
the record of what was wrong and how it was fixed. Every claim below was checked
against the running code, not assumed.

---

## 1. What the reference actually does

From the supplied reference screenshot (Latico "Best Sellers" page):

| Reference behaviour | Detail |
|---|---|
| Heat is **anchored to a DOM element** | Each blob sits on one product card (the handbag), not on a region of the page. |
| Blob shape follows the **element's box** | Roughly the footprint of the product image/card. |
| Ranked badge | Green `#4` pill — rank of that element among hotspots. |
| Hover card is **per-element** | `BIANCA TOTE/CROSSBODY` — a clean product name, not scraped DOM noise. |
| Card metrics are **business metrics** | Sessions, Purchases, Revenue, Avg. Order Value, Conversion Rate, Visibility, Rev. per click, Rev. per session. |
| Tooltips explain **why an element is hot** | Revenue, AOV and Rev/click justify clicks that did *not* convert. |
| Reads as "which items are most clickable" | Instant, because each blob is one recognisable product. |

**The essential difference:** the reference answers *"which specific element gets
clicks, and what did those clicks earn?"* Our current implementation answers
*"where on the page did pixels get clicked?"*

---

## 2. What we do today (verified)

| Layer | File | Actual behaviour |
|---|---|---|
| Capture | `tracker/tracker.js:275-276` | Stores raw document pixels: `p.x = e.pageX`, `p.y = e.pageY`. |
| Identity | `tracker/tracker.js:148-221` | `describeTarget()` walks up 4 hops and captures `element_tag`, `element_id`, `element_classes`, `element_text`, `element_href`, `element_section`. `data-analytics-label` overrides text (`tracker.js:198-205`). |
| Schema | `server/src/models/Event.js:19-23` | Element fields stored — **but no rect, no stable element key, no selector.** |
| API | `server/src/routes/analytics.js:118-129` | `GET /api/clicks` projects `x, y, element_tag, element_text, element_section` + dims. Returns **flat points, no aggregation.** |
| Overlay | `tracker/heatmap-overlay.js:145-187` | Builds one float density grid from `x/y`, draws a single full-page canvas of Gaussian blobs. `R = 46`, `sigma = R/2.2`. |
| Dashboard | `client/src/pages/Heatmaps.tsx:75-117` | `clusterDots()` buckets points into a **fixed 90px grid** (`CLUSTER_CELL = 90`), keeps top 8, labels each with the most frequent `element_text` in that cell. |
| Live | `Heatmaps.tsx:196-200` | Polls `/api/clicks` every **5s** when Live is on. Overlay fetches **once** on load (`heatmap-overlay.js:228`). |
| Event types | `server/src/models/Event.js:7` | `enum: ['page_view', 'click']` — **no purchase/order event exists.** |

---

## 3. Root causes of the "big blurry map covering everything"

1. **Blobs are free-floating, not element-anchored.** Density is computed in page
   space from raw pixels only. No DOM lookup, so a blob never "knows" it belongs to
   one product card. → the clatty, page-wide smear.
2. **Clusters are grid-based, not element-based.** `CLUSTER_CELL = 90` merges
   neighbouring cards and can split one wide card across two clusters. Labels come
   from the most common scraped text, not from a known element identity.
3. **No stable element key.** `element_text` is scraped `innerText` (clipped to 120
   chars) — fragile and often not a clean product name. Nothing to join clicks of
   the *same* element across sessions/voyages reliably.
4. **No layout normalisation.** Points are stored in the viewport they were captured
   in. `Heatmaps.tsx:209-239` scales by `boxW/refW` only — a click captured at
   1440px and rendered in a narrower box drifts off its element. Responsive
   breakpoints and lazy-loaded images shift layout further.
5. **Demo/simulated data cannot be pixel-accurate.** `server/src/simulate.js`
   invents `x/y` for simulated users; those blobs are only as meaningful as the
   random placement. Element keys, not coordinates, are what make demo data useful.
6. **Zero business metrics.** Purchases, Revenue, AOV, Conversion Rate, Rev/click,
   Rev/session and Visibility are **uncomputable** — there is no purchase event and
   no impression data.

---

## 4. Required work to reach reference quality

### A. Element identity (the foundation — do this first)
- Emit a **stable element key** per clickable element. Preferred: explicit
  `data-analytics-id` (e.g. `product:aero-headphones`, `btn:add-to-cart`) so the
  key is owned by the app, not scraped. Fallback chain: `data-analytics-label` →
  `element_id` → normalised tag+classes+text hash.
- Add to `Event.js`: `element_key` (indexed), and optionally
  `element_rect {x,y,w,h}` + `element_index_on_page` for precise re-anchoring.
- Tag the storefront's real clickable units with stable ids:
  `ProductCard` (card, image link, name link, add-to-cart), `ProductDetail`
  (gallery thumbs, qty ±, Add to cart, Buy now, related cards), category pills,
  sort/filter controls, `CartDrawer` (checkout, qty ±, remove), nav links.

### B. Element-anchored rendering
- Draw heat **per element**, not as one page-wide density field: for each element
  key, accumulate clicks and render a blob clipped/masked to that element's
  `getBoundingClientRect()`.
- In the overlay, **re-find the live element by key** at draw time and place the
  blob on its *current* rect. Clicking a product today should light up that product
  now, regardless of earlier viewport sizes.
- Fall back to raw-pixel density only for legacy events with no `element_key`.
- Cluster/rank by `element_key` (never the 90px grid) so each hotspot = one element,
  and label it with its clean name (`BIANCA TOTE/CROSSBODY`).

### C. Per-element hover card (reference UI)
- Floating card anchored to the hovered/blurred hotspot, with **rank pill**, clean
  element name, and rows: Sessions, Clicks, CTR, Visibility, plus revenue rows once
  D exists. Edge-aware positioning (flip left/right, clamp top/bottom).

### D. Business metrics (needs a real data model)
- Add `purchase` (or `order`) to the `event_type` enum, with `order_id`,
  `revenue`, `currency`, `items[]` (product id, qty, unit price).
- Fire it from `CartDrawer` checkout (currently `checkout()` just clears the cart —
  `CartDrawer.tsx:25-28`).
- Add **impressions** (element entered viewport) to compute Visibility %.
- New endpoint, e.g. `GET /api/elements?url=&source=` → per `element_key`:
  clicks, unique sessions, impressions, visibility %, purchases, revenue, AOV,
  conversion rate, rev/click, rev/session, rank. Aggregate in MongoDB, and mirror in
  `memoryStore` so the no-DB fallback still works.

### E. Live accuracy
- Reduce the 5s poll (`Heatmaps.tsx:198`) or move to SSE/WebSocket push so a click
  shows up near-instantly; re-anchor to the live element rather than old pixels.
- Make the overlay refresh on route change and on demand, and show per-element
  click counts live.

### F. Correctness / consistency guards
- Store the layout context with each click (`viewport_width/height`,
  `page_width/height` already exist) and normalise on render so clicks from
  different viewports land on the same element.
- De-duplicate rapid synthetic clicks; clamp outliers.
- Display a **demo/live split** in the tooltip so demo blobs are never mistaken for
  real users.

---

## 5. What was actually built

| Step | Result |
|---|---|
| 1. Element keys | `element_key` + `element_rect` on the schema; tracker resolves `data-analytics-id` → label → id → `auto:` hash; 40+ storefront controls tagged. |
| 2. Element-anchored rendering | Overlay fetches `/api/elements`, re-finds each element by key on the live page, draws a blob + green `#n` badge on its current box. Pixel mode retained via `HEATMAP_MODE='pixels'`. |
| 3. Hover card | Reference card: rank pill, clean name, Sessions, Clicks, Purchases, Revenue, AOV, Conversion Rate, Rev/click, Rev/session. Edge-clamped. |
| 4. Revenue model | `purchase` event type + `order_id`/`revenue`/`currency`/`items[]`; `window.CausalFunnelAnalytics.purchase()`; fired by `CartDrawer` checkout; `GET /api/elements` aggregates all metrics and rank. |
| 5. Live | Element rows refresh on the 5s LIVE poll alongside clicks. |

**Also fixed (pre-existing, unrelated to heatmaps):** write CORS did not send
`Access-Control-Allow-Credentials`, so every `sendBeacon` from the tracker failed
its preflight and **no live browser event was ever recorded**. Only server-side
simulated data existed. `server/src/app.js` now sets `credentials: true`.

Verified end-to-end in headless Chrome: real clicks on real product buttons →
`element_key` + rect stored → overlay re-anchors to those exact controls →
hover card shows live revenue metrics.

## 6. Decisions taken
1. **Full reference card** — `purchase` events added so revenue/AOV/conversion are real.
2. **Explicit `data-analytics-id`** on every clickable unit (with fallbacks).
3. **Both modes kept** — Elements (default, precise) and Pixels (original).