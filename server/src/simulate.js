/**
 * Load-test simulator: acts as N distinct users browsing the demo store.
 *
 *   npm run sim:users          # 150 users (SIM_USERS to override)
 *   SIM_USERS=200 API_BASE=http://localhost:5001 npm run sim:users
 *
 * Every event is labeled data_source: 'demo' with sim_user_* session IDs —
 * the dashboard always badges these DEMO and keeps them out of live views.
 * Payloads mirror exactly what tracker.js sends (coordinates, viewport and
 * page dimensions, element identity), so this exercises the real pipeline.
 */
const API_BASE = process.env.API_BASE ?? 'http://localhost:5000';
const STORE = process.env.STORE_ORIGIN ?? 'http://localhost:5173';
const USERS = Number(process.env.SIM_USERS ?? 150);

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(Number(process.env.SIM_SEED ?? 20261015));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + rand() * (b - a);

const VIEWPORTS = [
  { w: 1440, h: 900, weight: 0.5 },
  { w: 1366, h: 768, weight: 0.2 },
  { w: 390, h: 844, weight: 0.2 },
  { w: 768, h: 1024, weight: 0.1 },
];
function pickViewport() {
  const r = rand();
  let acc = 0;
  for (const v of VIEWPORTS) {
    acc += v.weight;
    if (r <= acc) return v;
  }
  return VIEWPORTS[0];
}

const HEROES = [
  ['sunrise-sneakers', 'Sunrise Runner Sneakers'],
  ['trail-backpack', 'Trail Canvas Backpack'],
  ['aero-headphones', 'Aero Wireless Headphones'],
  ['pulse-smartwatch', 'Pulse Smartwatch S2'],
  ['solstice-sunglasses', 'Solstice Sunglasses'],
  ['lumen-camera', 'Lumen Instant Camera'],
  ['ember-desk-lamp', 'Ember Desk Lamp'],
  ['court-sneakers', 'Court Classic Sneakers'],
];
const LONGTAIL = [
  ['street-knit-runners', 'Street Knit Runners'], ['velocity-racer', 'Velocity Racer'],
  ['harbor-loafers', 'Harbor Loafers'], ['trailhead-hikers', 'Trailhead Hikers'],
  ['cloud-slide-sandals', 'Cloud Slide Sandals'], ['studio-monitor-headphones', 'Studio Monitor Headphones'],
  ['gilt-wireless-earbuds', 'Gilt Wireless Earbuds'], ['thunder-bass-speaker', 'Thunder Bass Speaker'],
  ['volt-gaming-laptop', 'Volt Gaming Laptop 15'], ['slate-ultrabook-14', 'Slate Ultrabook 14'],
  ['precision-wireless-mouse', 'Precision Wireless Mouse'], ['tactile-mechanical-keyboard', 'Tactile Mechanical Keyboard'],
  ['milano-leather-tote', 'Milano Leather Tote'], ['cognac-crossbody', 'Cognac Crossbody'],
  ['drift-duffel', 'Drift Weekender Duffel'], ['harbor-wayfarer-sunglasses', 'Harbor Wayfarer Sunglasses'],
  ['heritage-chronograph', 'Heritage Chronograph'], ['minimalist-steel-watch', 'Minimalist Steel Watch'],
  ['cloud-linen-sofa', 'Cloud Linen Sofa'], ['atelier-armchair', 'Atelier Armchair'],
  ['halo-floor-lamp', 'Halo Arc Floor Lamp'], ['kiln-stoneware-vase', 'Kiln Stoneware Vase'],
  ['hearth-cotton-duvet', 'Hearth Cotton Duvet Set'], ['prep-chef-knife-set', 'Prep Chef Knife Trio'],
  ['essential-white-tee', 'Essential White Tee'], ['slub-knit-tee', 'Slub Knit Tee'],
  ['field-utility-jacket', 'Field Utility Jacket'], ['moto-leather-jacket', 'Moto Leather Jacket'],
  ['oxford-stretch-shirt', 'Oxford Stretch Shirt'], ['pleated-midi-dress', 'Pleated Midi Dress'],
  ['rail-distressed-denim', 'Rail Distressed Denim'], ['botanic-face-serum', 'Botanic Face Serum'],
  ['mineral-spf-50', 'Mineral SPF 50'], ['herb-shampoo-bar', 'Herb Shampoo Bar'],
  ['rose-clay-mask', 'Rose Clay Mask'], ['steel-grooming-bottle', 'Steel Grooming Bottle'],
  ['ascent-yoga-mat', 'Ascent Yoga Mat 6mm'], ['trail-grip-bottle', 'Trail Grip Bottle 1L'],
  ['court-tennis-racket', 'Court Tennis Racket'], ['summit-duffel-40l', 'Summit Duffel 40L'],
  ['pulse-jump-rope', 'Pulse Speed Rope'], ['marina-slip-ons', 'Marina Canvas Slip-Ons'],
  ['orbit-buds-pro', 'Orbit Buds Pro'], ['saffiano-card-wallet', 'Saffiano Card Wallet'],
  ['glow-table-lamp', 'Glow Table Lamp'], ['terry-polo-shirt', 'Terry Polo Shirt'],
  ['aloe-repair-gel', 'Aloe Repair Gel'], ['flex-resistance-bands', 'Flex Resistance Band Set'],
];
// Weighted: heroes get 75% of product traffic (dense heat), long tail shares the rest.
function pickProduct() {
  return rand() < 0.75 ? pick(HEROES) : pick(LONGTAIL);
}
const CATS = ['Footwear', 'Electronics', 'Accessories', 'Home'];

// Click zones as viewport/page fractions + element identity, so heat lands
// on real controls across the full page height.
const ZONES = {
  navProducts: { fx: [0.2, 0.3], fy: [0.03, 0.06], el: () => ({ tag: 'A', text: 'Products', section: 'header' }) },
  heroCta: { fx: [0.42, 0.58], fy: [0.3, 0.42], el: () => ({ tag: 'A', text: 'Shop all products', section: 'hero' }) },
  heroQuick: { fx: [0.42, 0.58], fy: [0.44, 0.5], el: () => ({ tag: 'BUTTON', text: 'Quick-add', section: 'hero' }) },
  card: { fx: [0.08, 0.92], fy: [0.3, 0.72], el: (p) => ({ tag: 'A', text: p[1], section: 'featured-products' }) },
  gridCard: { fx: [0.08, 0.92], fy: [0.3, 0.7], el: (p) => ({ tag: 'A', text: p[1], section: 'products-grid' }) },
  gridAdd: { fx: [0.15, 0.9], fy: [0.45, 0.62], el: () => ({ tag: 'BUTTON', text: 'Add to Cart', section: 'products-grid' }) },
  filter: { fx: [0.1, 0.45], fy: [0.16, 0.24], el: () => ({ tag: 'BUTTON', text: pick(CATS), section: 'filters' }) },
  search: { fx: [0.3, 0.7], fy: [0.1, 0.15], el: () => ({ tag: 'INPUT', text: null, section: 'products-grid' }) },
  detailAdd: { fx: [0.55, 0.75], fy: [0.5, 0.62], el: () => ({ tag: 'BUTTON', text: 'Add to Cart', section: 'product-detail' }) },
  detailBuy: { fx: [0.6, 0.85], fy: [0.55, 0.66], el: () => ({ tag: 'BUTTON', text: 'Buy now', section: 'product-detail' }) },
  qty: { fx: [0.5, 0.6], fy: [0.45, 0.52], el: () => ({ tag: 'BUTTON', text: 'Increase quantity', section: 'product-detail' }) },
  cartQty: { fx: [0.68, 0.8], fy: [0.3, 0.45], el: () => ({ tag: 'BUTTON', text: 'Increase quantity', section: 'cart-drawer' }) },
  cartCheckout: { fx: [0.68, 0.88], fy: [0.55, 0.7], el: () => ({ tag: 'BUTTON', text: 'Checkout', section: 'cart-drawer' }) },
  newsletter: { fx: [0.35, 0.6], fy: [0.85, 0.92], el: () => ({ tag: 'BUTTON', text: 'Subscribe', section: 'newsletter' }) },
  footer: { fx: [0.2, 0.8], fy: [0.93, 0.98], el: () => ({ tag: 'A', text: 'View analytics dashboard', section: 'footer' }) },
};

function clickEvent(session, url, vp, page, zoneKey, product, t) {
  const z = ZONES[zoneKey];
  const pw = vp.w;
  const ph = Math.round(vp.h * between(2.2, 3.0));
  const el = z.el(product);
  return {
    session_id: session,
    event_type: 'click',
    page_url: url,
    timestamp: new Date(t).toISOString(),
    x: Math.max(0, Math.round(pw * between(z.fx[0], z.fx[1]))),
    y: Math.max(0, Math.round(ph * between(z.fy[0], z.fy[1]))),
    viewport_width: vp.w,
    viewport_height: vp.h,
    page_width: pw,
    page_height: ph,
    element_tag: el.tag,
    element_text: el.text,
    element_section: el.section,
    data_source: 'demo',
  };
}

function viewEvent(session, url, vp, t) {
  return {
    session_id: session,
    event_type: 'page_view',
    page_url: url,
    timestamp: new Date(t).toISOString(),
    viewport_width: vp.w,
    viewport_height: vp.h,
    data_source: 'demo',
  };
}

// Behavior profiles: [weight, builder]
const PROFILES = [
  [0.25, bounce],
  [0.35, browser],
  [0.25, funnel],
  [0.15, searcher],
];
function pickProfile() {
  const r = rand();
  let acc = 0;
  for (const [w, fn] of PROFILES) {
    acc += w;
    if (r <= acc) return fn;
  }
  return browser;
}

function bounce(ev, s, vp, t) {
  const home = `${STORE}/store`;
  ev.push(viewEvent(s, home, vp, t)); t += between(20, 90) * 1000;
  if (rand() < 0.5) { ev.push(clickEvent(s, home, vp, null, pick(['navProducts', 'heroCta']), null, t)); t += between(15, 60) * 1000; }
  return t;
}
function browser(ev, s, vp, t) {
  const home = `${STORE}/store`;
  const prods = `${STORE}/store/products`;
  const p = pickProduct();
  ev.push(viewEvent(s, home, vp, t)); t += between(20, 120) * 1000;
  ev.push(clickEvent(s, home, vp, null, pick(['heroCta', 'card', 'heroQuick']), p, t)); t += between(15, 90) * 1000;
  ev.push(viewEvent(s, prods, vp, t)); t += between(20, 100) * 1000;
  const n = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    ev.push(clickEvent(s, prods, vp, null, pick(['filter', 'gridCard', 'gridAdd', 'search']), pickProduct(), t));
    t += between(15, 90) * 1000;
  }
  if (rand() < 0.6) {
    const pp = `${STORE}/store/product/${p[0]}`;
    ev.push(viewEvent(s, pp, vp, t)); t += between(20, 120) * 1000;
    ev.push(clickEvent(s, pp, vp, null, pick(['detailAdd', 'qty']), p, t)); t += between(15, 60) * 1000;
  }
  if (rand() < 0.4) { ev.push(clickEvent(s, prods, vp, null, 'footer', null, t)); t += 30000; }
  return t;
}
function funnel(ev, s, vp, t) {
  const prods = `${STORE}/store/products`;
  const p = pickProduct();
  const pp = `${STORE}/store/product/${p[0]}`;
  ev.push(viewEvent(s, prods, vp, t)); t += between(20, 80) * 1000;
  ev.push(clickEvent(s, prods, vp, null, 'gridCard', p, t)); t += between(15, 60) * 1000;
  ev.push(viewEvent(s, pp, vp, t)); t += between(20, 100) * 1000;
  ev.push(clickEvent(s, pp, vp, null, 'detailAdd', p, t)); t += between(15, 60) * 1000;
  ev.push(clickEvent(s, pp, vp, null, pick(['detailBuy', 'detailAdd']), p, t)); t += between(15, 60) * 1000;
  // cart drawer interactions happen on the same page document
  ev.push(clickEvent(s, pp, vp, null, 'cartQty', p, t)); t += between(10, 40) * 1000;
  if (rand() < 0.7) { ev.push(clickEvent(s, pp, vp, null, 'cartCheckout', p, t)); t += 30000; }
  return t;
}
function searcher(ev, s, vp, t) {
  const q = pick(['shoes', 'lamp', 'watch', 'bag', 'mug']);
  const prods = `${STORE}/store/products?q=${q}`;
  ev.push(viewEvent(s, prods, vp, t)); t += between(20, 80) * 1000;
  ev.push(clickEvent(s, prods, vp, null, 'search', null, t)); t += between(15, 60) * 1000;
  const n = 1 + Math.floor(rand() * 2);
  for (let i = 0; i < n; i++) {
    ev.push(clickEvent(s, prods, vp, null, pick(['gridCard', 'gridAdd', 'filter']), pickProduct(), t));
    t += between(15, 90) * 1000;
  }
  if (rand() < 0.5) {
    const p = pickProduct();
    ev.push(viewEvent(s, `${STORE}/store/product/${p[0]}`, vp, t));
  }
  return t;
}

async function postOne(event, attempt = 1) {
  // Gentle pacing: stay under the API's abuse rate limit (~600 req/min).
  await new Promise((r) => setTimeout(r, 130));
  let res;
  try {
    res = await fetch(`${API_BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch (err) {
    if (attempt < 4) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      return postOne(event, attempt + 1);
    }
    throw new Error(`network failure after retries: ${err.message}`);
  }
  if (res.status === 429 && attempt < 4) {
    console.log('\n[sim] rate-limited, waiting 65s before resuming…');
    await new Promise((r) => setTimeout(r, 65000));
    return postOne(event, attempt + 1);
  }
  if (res.status >= 500 && attempt < 4) {
    // Transient backend/DB blip — back off and retry, don't duplicate.
    await new Promise((r) => setTimeout(r, 2000 * attempt));
    return postOne(event, attempt + 1);
  }
  const body = await res.json().catch(() => ({}));
  if (!body.ok) throw new Error(`rejected (${res.status}): ${JSON.stringify(body).slice(0, 160)}`);
  if (String(body.id || '').startsWith('mem_')) {
    // Server is on its memory fallback, not MongoDB — wait for it to
    // reconnect and retry the SAME event (never duplicate it).
    if (attempt < 8) {
      console.log('\n[sim] server on memory store, waiting 20s for MongoDB reconnect…');
      await new Promise((r) => setTimeout(r, 20000));
      return postOne(event, attempt + 1);
    }
    throw new Error('server stayed on in-memory store; aborting to avoid split data');
  }
}

async function postBatch(batch) {
  for (const e of batch) await postOne(e); // sequential: no duplicates on retry
}

async function main() {
  console.log(`[sim] acting as ${USERS} users against ${API_BASE} ...`);
  const health = await fetch(`${API_BASE}/api/health`).then((r) => r.json());
  console.log(`[sim] backend db: ${health.db}`);
  const all = [];
  for (let i = 0; i < USERS; i++) {
    const s = `sim_user_${String(i + 1).padStart(3, '0')}`;
    const vp = pickViewport();
    let t = Date.now() - Math.floor(rand() * 3 * 24 * 3600 * 1000);
    const ev = [];
    pickProfile()(ev, s, vp, t);
    all.push(...ev);
  }
  for (let i = 0; i < all.length; i += 12) {
    await postBatch(all.slice(i, i + 12));
    process.stdout.write(`\r[sim] posted ${Math.min(i + 12, all.length)}/${all.length}`);
  }
  const sessions = new Set(all.map((e) => e.session_id)).size;
  console.log(`\n[sim] done: ${all.length} demo events across ${sessions} sessions (data_source=demo)`);
}

main().catch((err) => {
  console.error('\n[sim] failed:', err.message);
  process.exit(1);
});
