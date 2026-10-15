export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  emoji: string;
  image: string;
  rating: number;
  reviews: number;
}

function img(id: string): string {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=70`;
}

// Original 8 heroes (kept stable — seed/sim data references these IDs).
const HEROES: Product[] = [
  { id: 'sunrise-sneakers', name: 'Sunrise Runner Sneakers', price: 79, category: 'Footwear', description: 'Lightweight daily runners with breathable knit and responsive cushioning.', emoji: '👟', image: img('photo-1542291026-7eec264c27ff'), rating: 4.6, reviews: 2314 },
  { id: 'trail-backpack', name: 'Trail Canvas Backpack', price: 129, category: 'Accessories', description: 'Waxed-canvas 22L backpack with padded straps and laptop sleeve.', emoji: '🎒', image: img('photo-1553062407-98eeb64c6a62'), rating: 4.8, reviews: 956 },
  { id: 'aero-headphones', name: 'Aero Wireless Headphones', price: 149, category: 'Electronics', description: 'Noise-cancelling over-ears with 40-hour battery and deep bass.', emoji: '🎧', image: img('photo-1505740420928-5e560c06d30e'), rating: 4.7, reviews: 1873 },
  { id: 'pulse-smartwatch', name: 'Pulse Smartwatch S2', price: 199, category: 'Electronics', description: 'Heart-rate, GPS and sleep tracking with a week of battery.', emoji: '⌚', image: img('photo-1546868871-7041f2a55e12'), rating: 4.5, reviews: 642 },
  { id: 'solstice-sunglasses', name: 'Solstice Sunglasses', price: 39, category: 'Accessories', description: 'Polarised UV400 lenses in a timeless acetate frame.', emoji: '🕶️', image: img('photo-1572635196237-14b3f281503f'), rating: 4.4, reviews: 418 },
  { id: 'lumen-camera', name: 'Lumen Instant Camera', price: 499, category: 'Electronics', description: '24MP mirrorless with 4K video and a flip-out screen.', emoji: '📷', image: img('photo-1526170375885-4d8ecf77b99f'), rating: 4.9, reviews: 327 },
  { id: 'ember-desk-lamp', name: 'Ember Desk Lamp', price: 59, category: 'Home', description: 'Warm-dim LED task lamp with a solid ash base.', emoji: '💡', image: img('photo-1586023492125-27b2c045efd7'), rating: 4.3, reviews: 205 },
  { id: 'court-sneakers', name: 'Court Classic Sneakers', price: 95, category: 'Footwear', description: 'Clean leather court profile that goes with everything.', emoji: '👟', image: img('photo-1560343090-f0409e92791a'), rating: 4.7, reviews: 1108 },
];

const MORE: Product[] = [
  // Footwear
  { id: 'street-knit-runners', name: 'Street Knit Runners', price: 89, category: 'Footwear', description: 'Sock-fit knit runners with grippy street soles.', emoji: '👟', image: img('photo-1600185365483-26d7a4cc7519'), rating: 4.5, reviews: 764 },
  { id: 'velocity-racer', name: 'Velocity Racer', price: 119, category: 'Footwear', description: 'Featherlight racer with carbon propulsion plate.', emoji: '👟', image: img('photo-1606107557195-0e29a4b5b4aa'), rating: 4.6, reviews: 512 },
  { id: 'harbor-loafers', name: 'Harbor Loafers', price: 99, category: 'Footwear', description: 'Buttery leather loafers, harbour-to-office ready.', emoji: '🥿', image: img('photo-1543163521-1bf539c55dd2'), rating: 4.4, reviews: 289 },
  { id: 'trailhead-hikers', name: 'Trailhead Hikers', price: 139, category: 'Footwear', description: 'Waterproof hiking boots with ankle support.', emoji: '🥾', image: img('photo-1605348532760-6753d2c43329'), rating: 4.7, reviews: 433 },
  { id: 'cloud-slide-sandals', name: 'Cloud Slide Sandals', price: 35, category: 'Footwear', description: 'Pillow-soft recovery slides for rest days.', emoji: '🩴', image: img('photo-1595950653106-6c9ebd614d3a'), rating: 4.2, reviews: 891 },
  // Electronics
  { id: 'studio-monitor-headphones', name: 'Studio Monitor Headphones', price: 189, category: 'Electronics', description: 'Flat-response studio cans for mixing and mastering.', emoji: '🎧', image: img('photo-1583394838336-acd977736f90'), rating: 4.8, reviews: 654 },
  { id: 'gilt-wireless-earbuds', name: 'Gilt Wireless Earbuds', price: 99, category: 'Electronics', description: 'Featherweight buds with wireless charging case.', emoji: '🎧', image: img('photo-1546435770-a3e426bf472b'), rating: 4.5, reviews: 1320 },
  { id: 'thunder-bass-speaker', name: 'Thunder Bass Speaker', price: 129, category: 'Electronics', description: 'Room-filling portable speaker, splash-proof.', emoji: '🔊', image: img('photo-1484704849700-f032a568e944'), rating: 4.4, reviews: 477 },
  { id: 'volt-gaming-laptop', name: 'Volt Gaming Laptop 15', price: 1299, category: 'Electronics', description: 'High-refresh gaming rig with RTX graphics.', emoji: '💻', image: img('photo-1593642632823-8f785ba67e45'), rating: 4.7, reviews: 298 },
  { id: 'slate-ultrabook-14', name: 'Slate Ultrabook 14', price: 999, category: 'Electronics', description: 'Slim aluminium ultrabook, 18-hour battery.', emoji: '💻', image: img('photo-1496181133206-80ce9b88a853'), rating: 4.8, reviews: 511 },
  { id: 'precision-wireless-mouse', name: 'Precision Wireless Mouse', price: 49, category: 'Electronics', description: 'Silent-click ergonomic mouse with fast scroll.', emoji: '🖱️', image: img('photo-1527864550417-7fd91fc51a46'), rating: 4.6, reviews: 2034 },
  { id: 'tactile-mechanical-keyboard', name: 'Tactile Mechanical Keyboard', price: 119, category: 'Electronics', description: 'Hot-swap mechanical keys with thocky tactile switches.', emoji: '⌨️', image: img('photo-1587829741301-dc798b83add3'), rating: 4.7, reviews: 876 },
  // Accessories
  { id: 'milano-leather-tote', name: 'Milano Leather Tote', price: 159, category: 'Accessories', description: 'Full-grain leather tote that ages beautifully.', emoji: '👜', image: img('photo-1548036328-c9fa89d128fa'), rating: 4.8, reviews: 342 },
  { id: 'cognac-crossbody', name: 'Cognac Crossbody', price: 119, category: 'Accessories', description: 'Compact crossbody in rich cognac leather.', emoji: '👜', image: img('photo-1584917865442-de89df76afd3'), rating: 4.6, reviews: 287 },
  { id: 'drift-duffel', name: 'Drift Weekender Duffel', price: 139, category: 'Accessories', description: '48-hour duffel with shoe garage and brass zips.', emoji: '🧳', image: img('photo-1591561954557-26941169b49e'), rating: 4.5, reviews: 198 },
  { id: 'ray-ban-wayfarer-style', name: 'Harbor Wayfarer Sunglasses', price: 59, category: 'Accessories', description: 'Classic wayfarer shape with gradient lenses.', emoji: '🕶️', image: img('photo-1511499767150-a48a237f0083'), rating: 4.3, reviews: 655 },
  { id: 'heritage-chronograph', name: 'Heritage Chronograph', price: 249, category: 'Accessories', description: 'Sapphire-crystal chronograph with Italian strap.', emoji: '⌚', image: img('photo-1524805444758-089113d48a6d'), rating: 4.9, reviews: 176 },
  { id: 'minimalist-steel-watch', name: 'Minimalist Steel Watch', price: 179, category: 'Accessories', description: 'Brushed-steel minimal dial, 5ATM resistant.', emoji: '⌚', image: img('photo-1503602642458-232111445657'), rating: 4.6, reviews: 423 },
  // Home
  { id: 'cloud-linen-sofa', name: 'Cloud Linen Sofa', price: 899, category: 'Home', description: 'Deep-seat three-seater in stonewashed linen.', emoji: '🛋️', image: img('photo-1555041469-a586c61ea9bc'), rating: 4.8, reviews: 134 },
  { id: 'atelier-armchair', name: 'Atelier Armchair', price: 449, category: 'Home', description: 'Sculptural lounge chair in bouclé wool.', emoji: '🪑', image: img('photo-1616486338812-3dadae4b4ace'), rating: 4.7, reviews: 98 },
  { id: 'halo-floor-lamp', name: 'Halo Arc Floor Lamp', price: 189, category: 'Home', description: 'Dimmable arc lamp with marble base.', emoji: '💡', image: img('photo-1493663284031-b7e3aefcae8e'), rating: 4.5, reviews: 211 },
  { id: 'kiln-stoneware-vase', name: 'Kiln Stoneware Vase', price: 45, category: 'Home', description: 'Hand-thrown stoneware vase, reactive glaze.', emoji: '🏺', image: img('photo-1578749556568-bc2c40e68b61'), rating: 4.6, reviews: 167 },
  { id: 'hearth-cotton-duvet', name: 'Hearth Cotton Duvet Set', price: 129, category: 'Home', description: 'Crisp percale duvet set, gets softer every wash.', emoji: '🛏️', image: img('photo-1567016432779-094069958ea5'), rating: 4.7, reviews: 542 },
  { id: 'prep-chef-knife-set', name: 'Prep Chef Knife Trio', price: 149, category: 'Home', description: 'German-steel knives with pakkawood handles.', emoji: '🔪', image: img('photo-1585515320310-259814833e62'), rating: 4.8, reviews: 389 },
  // Fashion
  { id: 'essential-white-tee', name: 'Essential White Tee', price: 25, category: 'Fashion', description: 'Heavyweight organic cotton tee, pre-shrunk.', emoji: '👕', image: img('photo-1521572163474-6864f9cf17ab'), rating: 4.5, reviews: 3120 },
  { id: 'slub-knit-tee', name: 'Slub Knit Tee', price: 29, category: 'Fashion', description: 'Textured slub tee with a lived-in feel.', emoji: '👕', image: img('photo-1576566588028-4147f3842f27'), rating: 4.4, reviews: 1876 },
  { id: 'field-utility-jacket', name: 'Field Utility Jacket', price: 149, category: 'Fashion', description: 'Water-resistant field jacket with corduroy collar.', emoji: '🧥', image: img('photo-1591047139829-d91aecb6caea'), rating: 4.7, reviews: 445 },
  { id: 'moto-leather-jacket', name: 'Moto Leather Jacket', price: 299, category: 'Fashion', description: 'Broken-in moto jacket in aniline leather.', emoji: '🧥', image: img('photo-1551028719-00167b16eac5'), rating: 4.8, reviews: 233 },
  { id: 'oxford-stretch-shirt', name: 'Oxford Stretch Shirt', price: 59, category: 'Fashion', description: 'Wrinkle-resistant oxford with 2-way stretch.', emoji: '👔', image: img('photo-1602810318383-e386cc2a3ccf'), rating: 4.5, reviews: 978 },
  { id: 'pleated-midi-dress', name: 'Pleated Midi Dress', price: 89, category: 'Fashion', description: 'Floaty pleated midi in recycled crepe.', emoji: '👗', image: img('photo-1594633312681-425c7b97ccd1'), rating: 4.6, reviews: 367 },
  { id: 'rail-distressed-denim', name: 'Rail Distressed Denim', price: 79, category: 'Fashion', description: 'Straight-leg selvedge denim, perfectly faded.', emoji: '👖', image: img('photo-1445205170230-053b83016050'), rating: 4.4, reviews: 1123 },
  // Beauty
  { id: 'botanic-face-serum', name: 'Botanic Face Serum', price: 39, category: 'Beauty', description: 'Vitamin-C serum with hyaluronic acid.', emoji: '🧴', image: img('photo-1620916566398-39f1143ab7be'), rating: 4.6, reviews: 2210 },
  { id: 'mineral-spf-50', name: 'Mineral SPF 50', price: 29, category: 'Beauty', description: 'Invisible mineral sunscreen, no white cast.', emoji: '🧴', image: img('photo-1556228720-195a672e8a03'), rating: 4.7, reviews: 1874 },
  { id: 'herb-shampoo-bar', name: 'Herb Shampoo Bar', price: 15, category: 'Beauty', description: 'Zero-waste shampoo bar for all hair types.', emoji: '🧼', image: img('photo-1526947425960-945c6e72858f'), rating: 4.3, reviews: 932 },
  { id: 'rose-clay-mask', name: 'Rose Clay Mask', price: 25, category: 'Beauty', description: 'Pink-clay mask that decongests in 10 minutes.', emoji: '🧖', image: img('photo-1571781926291-c477ebfd024b'), rating: 4.5, reviews: 764 },
  { id: 'steel-grooming-bottle', name: 'Steel Grooming Bottle', price: 35, category: 'Beauty', description: 'Refillable steel bottle for shampoo or soap.', emoji: '🧴', image: img('photo-1602143407151-7111542de6e8'), rating: 4.4, reviews: 321 },
  // Sports
  { id: 'ascent-yoga-mat', name: 'Ascent Yoga Mat 6mm', price: 55, category: 'Sports', description: 'Extra-grip pro mat with alignment lines.', emoji: '🧘', image: img('photo-1592432678016-e910b452f9a2'), rating: 4.7, reviews: 689 },
  { id: 'trail-grip-bottle', name: 'Trail Grip Bottle 1L', price: 29, category: 'Sports', description: 'Insulated steel bottle, 24h cold retention.', emoji: '🍶', image: img('photo-1602143407151-7111542de6e8'), rating: 4.5, reviews: 1453 },
  { id: 'court-tennis-racket', name: 'Court Tennis Racket', price: 129, category: 'Sports', description: 'Balanced 300g frame for all-court players.', emoji: '🎾', image: img('photo-1617083277359-00c93d1476e7'), rating: 4.6, reviews: 187 },
  { id: 'summit-duffel-40l', name: 'Summit Duffel 40L', price: 99, category: 'Sports', description: 'Weatherproof gym duffel with vented pocket.', emoji: '🎒', image: img('photo-1491637639811-60e2756cc1c7'), rating: 4.5, reviews: 356 },
  { id: 'pulse-jump-rope', name: 'Pulse Speed Rope', price: 19, category: 'Sports', description: 'Ball-bearing speed rope for HIIT days.', emoji: '➿', image: img('photo-1517836357463-d25dfeac3438'), rating: 4.3, reviews: 567 },
  { id: 'marina-slip-ons', name: 'Marina Canvas Slip-Ons', price: 45, category: 'Footwear', description: 'Easy canvas slip-ons with cushioned insoles.', emoji: '👟', image: img('photo-1608231387042-66d1773070a5'), rating: 4.3, reviews: 402 },
  { id: 'orbit-buds-pro', name: 'Orbit Buds Pro', price: 129, category: 'Electronics', description: 'Adaptive ANC buds with spatial audio.', emoji: '🎧', image: img('photo-1590658268037-6bf12165a8df'), rating: 4.6, reviews: 918 },
  { id: 'saffiano-card-wallet', name: 'Saffiano Card Wallet', price: 49, category: 'Accessories', description: 'Six-card saffiano wallet with coin pocket.', emoji: '👛', image: img('photo-1627123424574-724758594e93'), rating: 4.5, reviews: 264 },
  { id: 'glow-table-lamp', name: 'Glow Table Lamp', price: 69, category: 'Home', description: 'Opal-glass table lamp with touch dimmer.', emoji: '💡', image: img('photo-1507473885765-e6ed057f782c'), rating: 4.4, reviews: 178 },
  { id: 'terry-polo-shirt', name: 'Terry Polo Shirt', price: 45, category: 'Fashion', description: 'Retro terry polo with tipped collar.', emoji: '👕', image: img('photo-1611312449408-fcece27cdbb7'), rating: 4.3, reviews: 511 },
  { id: 'aloe-repair-gel', name: 'Aloe Repair Gel', price: 19, category: 'Beauty', description: 'Cooling aloe gel for sun-stressed skin.', emoji: '🌿', image: img('photo-1556228578-8c89e6adf883'), rating: 4.5, reviews: 623 },
  { id: 'flex-resistance-bands', name: 'Flex Resistance Band Set', price: 29, category: 'Sports', description: 'Five stackable bands, 10–50 lbs combined.', emoji: '💪', image: img('photo-1598289431512-b97b0917affc'), rating: 4.4, reviews: 489 },
];

export const PRODUCTS: Product[] = [...HEROES, ...MORE];

export const CATEGORIES = ['All', ...Array.from(new Set(PRODUCTS.map((p) => p.category)))];

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function formatPrice(n: number): string {
  return `$${n}`;
}

export function stars(rating: number): string {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}
