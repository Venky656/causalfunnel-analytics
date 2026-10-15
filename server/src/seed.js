/**
 * Seed clearly-labeled DEMO events into MongoDB.
 *
 *   npm run seed:demo
 *
 * - Every event has data_source: 'demo' (never shown as live traffic).
 * - Idempotent: removes existing demo events before inserting.
 * - Only touches demo records — live events are never deleted.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Event } from './models/Event.js';

const STORE_ORIGIN = process.env.STORE_ORIGIN ?? 'http://localhost:5173';
const SESSION_COUNT = Number(process.env.SEED_SESSIONS ?? 24);

// Deterministic PRNG so the dataset is stable across runs.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VIEWPORTS = [
  { vw: 1440, vh: 900, pw: 1440, ph: 2400 },
  { vw: 1366, vh: 768, pw: 1366, ph: 2100 },
  { vw: 390, vh: 844, pw: 390, ph: 2600 },
];

// Plausible click zones per page (fractions of viewport/page, with jitter applied).
// Zones span the full page: top nav → hero → product grid → footer.
const ZONES = {
  nav: { fx: [0.15, 0.45], fy: [0.02, 0.05] },
  heroCta: { fx: [0.44, 0.56], fy: [0.32, 0.42] },
  productCard: { fx: [0.08, 0.92], fy: [0.3, 0.78] },
  addToCart: { fx: [0.55, 0.75], fy: [0.35, 0.55] },
  buyNow: { fx: [0.6, 0.85], fy: [0.45, 0.6] },
  filter: { fx: [0.1, 0.4], fy: [0.18, 0.25] },
  footer: { fx: [0.2, 0.8], fy: [0.88, 0.97] },
};

const PRODUCT_IDS = ['sunrise-sneakers', 'trail-backpack', 'aero-headphones', 'pulse-smartwatch', 'solstice-sunglasses', 'ember-desk-lamp'];

const PRODUCT_NAMES = {
  'sunrise-sneakers': 'Sunrise Runner Sneakers',
  'trail-backpack': 'Trail Canvas Backpack',
  'aero-headphones': 'Aero Wireless Headphones',
  'pulse-smartwatch': 'Pulse Smartwatch S2',
  'solstice-sunglasses': 'Solstice Sunglasses',
  'ember-desk-lamp': 'Ember Desk Lamp',
};

// Realistic element identity per (page, zone) so dashboards show which
// text / image / card / button each simulated click hit.
function seedElement(page, zone, productId) {
  const product = PRODUCT_NAMES[productId] ?? productId;
  const section = { home: 'hero', products: 'products-grid', product: 'product-detail' }[page] ?? page;
  switch (zone) {
    case 'nav':
      return { element_tag: 'A', element_text: 'Products', element_section: 'header' };
    case 'heroCta':
      return { element_tag: 'A', element_text: 'View Products', element_section: 'hero' };
    case 'productCard':
      return { element_tag: 'A', element_text: product, element_section: section };
    case 'addToCart':
      return { element_tag: 'BUTTON', element_text: 'Add to Cart', element_section: section };
    case 'buyNow':
      return { element_tag: 'BUTTON', element_text: 'Buy now', element_section: section };
    case 'filter':
      return { element_tag: 'BUTTON', element_text: 'Footwear', element_section: 'products-grid' };
    case 'footer':
      return { element_tag: 'A', element_text: 'View analytics dashboard', element_section: 'footer' };
    default:
      return { element_tag: 'DIV', element_text: null, element_section: section };
  }
}

export function buildDemoEvents(storeOrigin = STORE_ORIGIN) {
  const rand = mulberry32(42);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (a, b) => a + rand() * (b - a);
  const jitter = (v, amt) => Math.round(v + between(-amt, amt));

  const urls = {
    home: `${storeOrigin}/store`,
    products: `${storeOrigin}/store/products`,
    product: (id) => `${storeOrigin}/store/product/${id}`,
  };

  // Journeys use only routes that exist in the store (cart is a drawer, so
  // checkout intent is a Buy-Now click on the product page). Every journey
  // ends with footer-area clicks so heat covers the full page height.
  const journeys = [
    // Full funnel: home -> products -> product -> buy
    [
      ['page_view', 'home'],
      ['click', 'home', 'heroCta'],
      ['page_view', 'products'],
      ['click', 'products', 'productCard'],
      ['page_view', 'product'],
      ['click', 'product', 'addToCart'],
      ['click', 'product', 'buyNow'],
      ['click', 'product', 'footer'],
    ],
    // Browse and buy one item
    [
      ['page_view', 'home'],
      ['click', 'home', 'productCard'],
      ['page_view', 'product'],
      ['click', 'product', 'addToCart'],
      ['click', 'home', 'footer'],
    ],
    // Search/filter flow on products
    [
      ['page_view', 'products'],
      ['click', 'products', 'filter'],
      ['click', 'products', 'filter'],
      ['page_view', 'product'],
      ['click', 'product', 'addToCart'],
      ['click', 'products', 'footer'],
    ],
    // Homepage browse with footer reach
    [
      ['page_view', 'home'],
      ['click', 'home', 'nav'],
      ['click', 'home', 'productCard'],
      ['click', 'home', 'footer'],
    ],
    // Direct to products, one view
    [
      ['page_view', 'products'],
      ['click', 'products', 'productCard'],
      ['page_view', 'product'],
      ['click', 'product', 'footer'],
    ],
  ];

  const events = [];
  for (let s = 0; s < SESSION_COUNT; s++) {
    const session_id = `demo_sess_${String(s + 1).padStart(2, '0')}`;
    const journey = journeys[s % journeys.length];
    const vp = pick(VIEWPORTS);
    const productId = pick(PRODUCT_IDS);
    // Spread sessions across the last 7 days.
    const base = new Date();
    base.setDate(base.getDate() - Math.floor(rand() * 7));
    base.setHours(8 + Math.floor(rand() * 12), Math.floor(rand() * 60), 0, 0);
    let t = base.getTime();

    for (const [type, page, zone] of journey) {
      t += Math.round(between(15, 120)) * 1000;
      const page_url = page === 'product' ? urls.product(productId) : urls[page];
      const ev = {
        session_id,
        event_type: type,
        page_url,
        timestamp: new Date(t),
        data_source: 'demo',
        viewport_width: vp.vw,
        viewport_height: vp.vh,
        page_width: vp.pw,
        page_height: vp.ph,
      };
      if (type === 'click') {
        const z = ZONES[zone];
        ev.x = Math.max(0, jitter(vp.vw * between(z.fx[0], z.fx[1]), 12));
        ev.y = Math.max(0, jitter(vp.ph * between(z.fy[0], z.fy[1]), 20));
        Object.assign(ev, seedElement(page, zone, productId));
      }
      events.push(ev);
    }
  }
  return events;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[seed] MONGODB_URI is not set. Copy server/.env.example to server/.env and add your MongoDB Atlas connection string.');
    process.exit(1);
  }
  // Retry the initial handshake — Atlas/TLS handshakes can fail transiently.
  let connected = false;
  for (let attempt = 1; attempt <= 5 && !connected; attempt++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
      connected = true;
    } catch (err) {
      console.warn(`[seed] connect attempt ${attempt}/5 failed: ${err.message.split('\n')[0]}`);
      await mongoose.disconnect().catch(() => {});
      if (attempt < 5) await new Promise((r) => setTimeout(r, 5000));
    }
  }
  if (!connected) {
    console.error('[seed] could not reach MongoDB. If the API server is already connected, you can seed through it instead — see README troubleshooting.');
    process.exit(1);
  }
  const removed = await Event.deleteMany({ data_source: 'demo' });
  console.log(`[seed] removed ${removed.deletedCount} existing demo events (live events untouched)`);
  const docs = buildDemoEvents();
  await Event.insertMany(docs, { ordered: false });
  const sessions = new Set(docs.map((d) => d.session_id)).size;
  console.log(`[seed] inserted ${docs.length} demo events across ${sessions} sessions`);
  await mongoose.disconnect();
}

const isMain = process.argv[1]?.endsWith('seed.js');
if (isMain) {
  main().catch((err) => {
    console.error('[seed] failed:', err.message);
    process.exit(1);
  });
}
