import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Search, ShoppingBasket, Store } from 'lucide-react';
import TrackerLoader from '../components/TrackerLoader';
import CartDrawer from './CartDrawer';
import { useCart } from '../store/cart';
import HeatFab from './HeatFab';

export default function StoreLayout() {
  const { count, openCart } = useCart();
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-amber-50/40">
      <TrackerLoader />
      <div className="bg-emerald-700 py-1.5 text-center text-xs font-semibold text-white">
        Everyday Market — demo storefront · interactions here are tracked as live events
      </div>
      <header className="sticky top-0 z-30 bg-white/95 shadow-sm ring-1 ring-slate-200 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/store" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <span className="rounded-xl bg-emerald-600 p-1.5 text-white"><Store size={20} /></span>
            Everyday<span className="text-emerald-700">Market</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium max-sm:hidden" aria-label="Store">
            <NavLink to="/store" end className={({ isActive }) => `rounded-lg px-3 py-2 ${isActive ? 'bg-emerald-100 text-emerald-800' : 'text-slate-600 hover:bg-slate-100'}`}>Home</NavLink>
            <NavLink to="/store/products" className={({ isActive }) => `rounded-lg px-3 py-2 ${isActive ? 'bg-emerald-100 text-emerald-800' : 'text-slate-600 hover:bg-slate-100'}`}>Products</NavLink>
            <Link to="/" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100">← Analytics</Link>
          </nav>
          <form
            className="relative ml-auto hidden min-w-0 flex-1 max-w-xs items-center md:flex"
            onSubmit={(e) => { e.preventDefault(); navigate(`/store/products?q=${encodeURIComponent(q)}`); }}
          >
            <Search size={15} className="pointer-events-none absolute left-3 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
              className="w-full rounded-full border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </form>
          <button
            onClick={openCart}
            aria-label={`Open cart, ${count} items`}
            className="relative ml-auto rounded-full bg-slate-900 p-2.5 text-white hover:bg-emerald-700 md:ml-0"
          >
            <ShoppingBasket size={18} />
            {count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                {count}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        Everyday Market — fictional demo store · <Link to="/" className="font-semibold text-indigo-600 hover:underline">View analytics dashboard</Link>
      </footer>
      <CartDrawer />
      <HeatFab />
    </div>
  );
}
