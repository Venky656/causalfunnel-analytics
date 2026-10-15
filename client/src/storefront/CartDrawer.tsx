import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBasket, Trash2, X } from 'lucide-react';
import { useCart } from '../store/cart';
import { getProduct } from '../store/products';
import ProductImage from '../components/ProductImage';

export default function CartDrawer() {
  const { lines, isOpen, closeCart, setQty, remove, clear, openCart } = useCart();
  const total = lines.reduce((n, l) => n + (getProduct(l.id)?.price ?? 0) * l.qty, 0);
  const [ordered, setOrdered] = useState(false);

  // ?cart=1 deep-links the open drawer — used for cart heat review
  // (e.g. /store/products?heatmap=1&cart=1) with the overlay on top.
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('cart') === '1') openCart();
    } catch {
      /* ignore */
    }
  }, [openCart]);

  if (!isOpen) return null;

  const checkout = () => {
    // Record the conversion against the primary (first) line's element so
    // element heatmaps can report revenue, AOV and conversion rate — not just
    // clicks. Gracefully no-ops if the tracker isn't loaded.
    const items = lines
      .map((l) => ({ l, p: getProduct(l.id) }))
      .filter((x) => Boolean(x.p))
      .map(({ l, p }) => ({
        product_id: p!.id,
        name: p!.name,
        qty: l.qty,
        unit_price: p!.price,
      }));
    try {
      const api = (window as unknown as {
        CausalFunnelAnalytics?: {
          purchase: (o: Record<string, unknown>) => boolean;
        };
      }).CausalFunnelAnalytics;
      api?.purchase({
        revenue: Number(total.toFixed(2)),
        currency: 'USD',
        order_id: `ord_${Date.now().toString(36)}`,
        elementKey: items[0] ? `product-card:${items[0].product_id}` : undefined,
        items,
      });
    } catch {
      /* tracking must never break checkout */
    }
    clear();
    setOrdered(true);
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Shopping cart">
      <div className="absolute inset-0 bg-slate-900/50" onClick={() => { closeCart(); setOrdered(false); }} />
      <aside data-track-section="cart-drawer" data-analytics-id="cart-drawer" className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="flex items-center gap-2 font-extrabold"><ShoppingBasket size={18} /> Your cart</h2>
          <button onClick={() => { closeCart(); setOrdered(false); }} aria-label="Close cart" data-analytics-id="cart-close" className="rounded-lg p-1.5 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {ordered ? (
            <div className="rounded-2xl bg-emerald-50 p-6 text-center ring-1 ring-emerald-200">
              <p className="text-lg font-extrabold text-emerald-800">✅ Order placed!</p>
              <p className="mt-1 text-sm text-emerald-700">That checkout click was tracked — find it in Sessions &amp; Heatmaps.</p>
              <Link to="/" className="mt-3 inline-block text-sm font-bold text-indigo-600 hover:underline">Open dashboard →</Link>
            </div>
          ) : lines.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Your cart is empty. Go grab something fresh ↓</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {lines.map((l) => {
                const p = getProduct(l.id);
                if (!p) return null;
                return (
                  <li key={l.id} className="flex gap-3 rounded-2xl p-2 ring-1 ring-slate-200"
                    data-analytics-id={`cart-line:${l.id}`} data-analytics-label={p.name}>
                    <ProductImage src={p.image} emoji={p.emoji} alt={p.name} className="h-16 w-16 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{p.name}</p>
                      <p className="text-sm font-extrabold text-emerald-700">${p.price * l.qty}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <button onClick={() => setQty(l.id, l.qty - 1)} aria-label="Decrease quantity" data-analytics-id={`cart-qty-dec:${l.id}`} className="rounded-lg border border-slate-300 p-1 hover:bg-slate-50"><Minus size={13} /></button>
                        <span className="text-sm font-bold tabular-nums">{l.qty}</span>
                        <button onClick={() => setQty(l.id, l.qty + 1)} aria-label="Increase quantity" data-analytics-id={`cart-qty-inc:${l.id}`} className="rounded-lg border border-slate-300 p-1 hover:bg-slate-50"><Plus size={13} /></button>
                        <button onClick={() => remove(l.id)} aria-label={`Remove ${p.name}`} data-analytics-id={`cart-remove:${l.id}`} data-analytics-label={`Remove ${p.name}`} className="ml-auto rounded-lg p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {!ordered && lines.length > 0 && (
          <div className="border-t border-slate-200 p-5">
            <p className="flex justify-between font-extrabold"><span>Total</span><span className="tabular-nums">${total}</span></p>
            <button onClick={checkout} data-analytics-id="cart-checkout"
            data-analytics-label="Checkout"
            className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700">
              Checkout — ${total}
            </button>
            <button onClick={clear} className="mt-2 w-full rounded-xl py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">
              Clear cart
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
