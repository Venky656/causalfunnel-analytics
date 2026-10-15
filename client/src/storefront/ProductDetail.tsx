import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Minus, Plus, RotateCcw, ShieldCheck, ShoppingBasket, Truck } from 'lucide-react';
import { PRODUCTS, getProduct } from '../store/products';
import { useCart } from '../store/cart';
import ProductImage from '../components/ProductImage';
import ProductCard, { Stars } from '../components/ProductCard';

export default function ProductDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const product = getProduct(id);
  const { add, openCart } = useCart();
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0);

  if (!product) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-slate-200">
        <p className="font-bold">Product not found.</p>
        <Link to="/store/products" className="mt-2 inline-block text-sm font-bold text-emerald-700 hover:underline">
          ← Back to products
        </Link>
      </div>
    );
  }

  const related = PRODUCTS.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);
  const gallery = [
    { src: product.image, label: product.name },
    ...related.slice(0, 2).map((p) => ({ src: p.image, label: p.name })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
        <Link to="/store" className="hover:text-emerald-700">Home</Link>
        <span>/</span>
        <Link to="/store/products" className="hover:text-emerald-700">Products</Link>
        <span>/</span>
        <Link to={`/store/products?cat=${encodeURIComponent(product.category)}`} className="hover:text-emerald-700">
          {product.category}
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-700">{product.name}</span>
      </nav>

      <div className="grid gap-6 rounded-3xl bg-white p-6 ring-1 ring-slate-200 md:grid-cols-2 md:p-8"
        data-analytics-id={`product-detail:${product.id}`}>
        <div>
          <ProductImage
            src={gallery[photo]?.src ?? product.image}
            emoji={product.emoji}
            alt={gallery[photo]?.label ?? product.name}
            className="aspect-square w-full rounded-2xl"
            dataAnalyticsId={`product-hero:${product.id}`}
          />
          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2">
              {gallery.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setPhoto(i)}
                  aria-label={`View photo ${i + 1}: ${g.label}`}
                  data-analytics-id={`gallery-thumb:${product.id}:${i}`}
                  data-analytics-label={`Photo ${i + 1}`}
                  className={`overflow-hidden rounded-xl ring-2 ${photo === i ? 'ring-emerald-600' : 'ring-transparent hover:ring-slate-300'}`}
                >
                  <ProductImage src={g.src} emoji={product.emoji} alt="" className="h-16 w-16" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">{product.category}</p>
          <h1 className="mt-1 text-3xl font-extrabold">{product.name}</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <Stars rating={product.rating} />
            <span className="font-bold text-slate-700">{product.rating}</span>·
            <span className="tabular-nums">{product.reviews.toLocaleString()} verified reviews</span>
          </p>
          <p className="mt-4 text-3xl font-extrabold text-emerald-700">${product.price}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <Check size={14} /> In stock — ships within 24 hours
          </p>
          <p className="mt-4 leading-relaxed text-slate-600">{product.description}</p>
          <ul className="mt-4 flex flex-col gap-2 text-sm text-slate-600">
            <li className="flex items-center gap-2"><Truck size={15} className="text-emerald-600" /> Free delivery on orders over $50</li>
            <li className="flex items-center gap-2"><RotateCcw size={15} className="text-emerald-600" /> Free 30-day returns</li>
            <li className="flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-600" /> 2-year warranty included</li>
          </ul>

          <div className="mt-5 flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-500">Qty</span>
            <button onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label="Decrease quantity"
              data-analytics-id={`qty-dec:${product.id}`} data-analytics-label="Decrease quantity"
              className="rounded-xl border border-slate-300 p-2 hover:bg-slate-50">
              <Minus size={15} />
            </button>
            <span className="min-w-8 text-center font-extrabold tabular-nums">{qty}</span>
            <button onClick={() => setQty((n) => n + 1)} aria-label="Increase quantity"
              data-analytics-id={`qty-inc:${product.id}`} data-analytics-label="Increase quantity"
              className="rounded-xl border border-slate-300 p-2 hover:bg-slate-50">
              <Plus size={15} />
            </button>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => { add(product.id, qty); }}
              data-analytics-id={`add-to-cart:${product.id}`}
              data-analytics-label={`Add to Cart — ${product.name}`}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-700"
            >
              <ShoppingBasket size={16} /> Add to cart
            </button>
            <button
              onClick={() => { add(product.id, qty); openCart(); }}
              data-analytics-id={`buy-now:${product.id}`}
              data-analytics-label={`Buy now — ${product.name}`}
              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Buy now
            </button>
          </div>
          <Link to="/store/products" className="mt-5 flex w-fit items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-emerald-700">
            <ArrowLeft size={16} /> Back to products
          </Link>
        </div>
      </div>

      {related.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-extrabold">You may also like</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
