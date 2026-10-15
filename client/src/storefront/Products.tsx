import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpDown } from 'lucide-react';
import { CATEGORIES, PRODUCTS } from '../store/products';
import ProductCard from '../components/ProductCard';

type Sort = 'featured' | 'price-asc' | 'price-desc' | 'name';

export default function Products() {
  const [params, setParams] = useSearchParams();
  const [sort, setSort] = useState<Sort>('featured');

  const q = params.get('q') ?? '';
  const cat = params.get('cat') ?? 'All';

  const list = useMemo(() => {
    let out = PRODUCTS.filter(
      (p) =>
        (cat === 'All' || p.category === cat) &&
        (q === '' || `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q.toLowerCase()))
    );
    if (sort === 'price-asc') out = [...out].sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') out = [...out].sort((a, b) => b.price - a.price);
    if (sort === 'name') out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [q, cat, sort]);

  const set = (key: 'q' | 'cat', value: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== 'All') next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">All products</h1>
        <p className="text-sm text-slate-500">Search, filter and sort — every control click is tracked.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => set('q', e.target.value)}
          placeholder="Search products…"
          aria-label="Search products"
          data-analytics-id="search-input"
          className="min-w-[200px] flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none"
        />
        <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm"
          data-analytics-id="sort-control" data-analytics-label="Sort products">
          <ArrowUpDown size={14} className="text-slate-400" />
          <span className="sr-only">Sort products</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="bg-transparent focus:outline-none" aria-label="Sort products">
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low → high</option>
            <option value="price-desc">Price: high → low</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
      </div>

      <div data-track-section="filters" className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => set('cat', c)}
            data-analytics-id={`filter:${c.toLowerCase().replace(/\s+/g, '-')}`}
            data-analytics-label={`Filter: ${c}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              cat === c ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:ring-slate-400'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl bg-white p-10 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          No products match “{q}”. Try another search.
        </p>
      ) : (
        <div data-track-section="products-grid" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
