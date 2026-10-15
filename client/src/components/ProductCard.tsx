import { Link } from 'react-router-dom';
import { ShoppingBasket, Star } from 'lucide-react';
import type { Product } from '../store/products';
import { useCart } from '../store/cart';
import ProductImage from './ProductImage';

export function Stars({ rating, className = '' }: { rating: number; className?: string }) {
  const full = Math.round(rating);
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={13}
          className={i <= full ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}
        />
      ))}
    </span>
  );
}

export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  return (
    <article
      className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
      data-analytics-id={`product-card:${product.id}`}
      data-analytics-label={product.name}
    >
      <Link to={`/store/product/${product.id}`} aria-label={`View ${product.name}`}
        data-analytics-id={`product-image:${product.id}`} data-analytics-label={`${product.name} image`}>
        <ProductImage
          src={product.image}
          emoji={product.emoji}
          alt={product.name}
          className="aspect-square w-full transition group-hover:scale-[1.02]"
        />
      </Link>
      <div className="p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{product.category}</p>
        <Link to={`/store/product/${product.id}`} className="line-clamp-1 font-bold hover:text-emerald-700"
          data-analytics-id={`product-title:${product.id}`} data-analytics-label={product.name}>
          {product.name}
        </Link>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <Stars rating={product.rating} />
          <span className="tabular-nums">{product.rating} ({product.reviews.toLocaleString()})</span>
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-lg font-extrabold text-emerald-700">${product.price}</span>
          <button
            onClick={() => add(product.id)}
            data-analytics-id={`add-to-cart:${product.id}`}
            data-analytics-label={`Add to Cart — ${product.name}`}
            aria-label={`Add ${product.name} to cart`}
            className="rounded-xl bg-slate-900 p-2.5 text-white hover:bg-emerald-600"
          >
            <ShoppingBasket size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
