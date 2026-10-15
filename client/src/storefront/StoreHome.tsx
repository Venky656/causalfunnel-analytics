import { Link } from 'react-router-dom';
import { ArrowRight, Leaf, Truck } from 'lucide-react';
import { CATEGORIES, PRODUCTS } from '../store/products';
import { useCart } from '../store/cart';
import ProductCard from '../components/ProductCard';

export default function StoreHome() {
  const { add, openCart } = useCart();
  const featured = PRODUCTS.slice(0, 8);

  return (
    <div className="flex flex-col gap-8">
      <section data-track-section="hero" className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 p-8 text-white md:p-12">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">Farm-fresh · delivered daily</p>
        <h1 className="mt-2 max-w-xl text-3xl font-extrabold leading-tight md:text-5xl">
          Everyday goods, honestly priced.
        </h1>
        <p className="mt-3 max-w-lg text-sm text-emerald-50 md:text-base">
          Browse the aisles, tap around, add things to your basket — every view and click helps demo the analytics.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/store/products" data-analytics-id="hero-shop-all" data-analytics-label="Shop all products" className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
            Shop all products <ArrowRight size={15} className="inline" />
          </Link>
          <button
            onClick={() => { add(featured[0].id); openCart(); }}
            data-analytics-id={`quick-add:${featured[0].id}`}
            data-analytics-label={`Quick-add ${featured[0].name}`}
            className="rounded-xl bg-emerald-900/60 px-6 py-3 text-sm font-bold text-white ring-1 ring-white/40 hover:bg-emerald-900"
          >
            Quick-add {featured[0].name}
          </button>
        </div>
        <div className="mt-6 flex flex-wrap gap-5 text-xs font-medium text-emerald-100">
          <span className="flex items-center gap-1.5"><Truck size={14} /> Free delivery over $50</span>
          <span className="flex items-center gap-1.5"><Leaf size={14} /> Sustainably sourced</span>
        </div>
      </section>

      <section data-track-section="categories">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Shop by category</h2>
          <Link to="/store/products" className="text-sm font-bold text-emerald-700 hover:underline">View all →</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {CATEGORIES.filter((c) => c !== 'All').map((c) => (
            <Link
              key={c}
              to={`/store/products?cat=${encodeURIComponent(c)}`}
              data-analytics-id={`category-tile:${c.toLowerCase().replace(/\s+/g, '-')}`}
              data-analytics-label={`Category: ${c}`}
              className="rounded-2xl bg-white p-5 text-center font-bold shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-emerald-300"
            >
              {c}
            </Link>
          ))}
        </div>
      </section>

      <section data-track-section="featured-products">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Featured products</h2>
          <Link to="/store/products" className="text-sm font-bold text-emerald-700 hover:underline">View all →</Link>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
