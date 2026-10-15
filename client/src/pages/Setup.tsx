import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Copy, ShieldCheck, Timer, XCircle } from 'lucide-react';
import { API_BASE, BACKEND_ORIGIN, getHealth } from '../lib/api';
import type { HealthData } from '../lib/api';
import { ErrorBox, Loading } from '../components/ui';

export default function Setup() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getHealth().then(setHealth).catch((e) => setError(e instanceof Error ? e.message : 'Health check failed'));
  }, []);

  const snippet = `<script
  async
  src="${BACKEND_ORIGIN}/tracker.js"
  data-api-url="${BACKEND_ORIGIN}/api/events">
</script>`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Tracking Setup</h1>
        <p className="text-sm text-slate-500">Install the tracker on any site you own or have permission to instrument.</p>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        {health ? (
          health.db === 'mongodb' ? (
            <CheckCircle2 className="shrink-0 text-emerald-500" size={22} />
          ) : (
            <CheckCircle2 className="shrink-0 text-amber-500" size={22} />
          )
        ) : error ? (
          <XCircle className="shrink-0 text-red-500" size={22} />
        ) : (
          <Loading label="" />
        )}
        <div className="text-sm">
          <p className="font-bold">
            Backend: {API_BASE}
            {health && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] uppercase">
                db: {health.db}
              </span>
            )}
          </p>
          <p className="text-slate-500">
            {health
              ? health.db === 'mongodb'
                ? 'Connected — events are persisted in MongoDB.'
                : 'Running on the in-memory store — set MONGODB_URI to persist events.'
              : error || 'Checking backend health…'}
          </p>
        </div>
      </div>
      {error && !health && <ErrorBox message={error} />}

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">1. Add the script tag</h2>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600"
          >
            <Copy size={13} /> {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 font-mono text-xs leading-relaxed text-cyan-200">
          {snippet}
        </pre>
        <p className="mt-2 text-xs text-slate-500">
          Generated from your configured backend ({BACKEND_ORIGIN}). Installing on third-party sites requires the
          site owner&apos;s permission.
        </p>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-bold">2. How sessions work</h2>
        <ul className="mt-2 flex flex-col gap-2 text-sm text-slate-600">
          <li className="flex gap-2"><Timer size={16} className="mt-0.5 shrink-0 text-indigo-600" /> The script creates a session ID on first visit and stores it in <code className="rounded bg-slate-100 px-1 font-mono text-xs">localStorage</code> (<code className="rounded bg-slate-100 px-1 font-mono text-xs">cf_session_id</code>).</li>
          <li>The same ID is reused across page navigation — it is never regenerated per click.</li>
          <li>After <strong>30 minutes of inactivity</strong> a new session starts automatically.</li>
          <li>Single-page-app route changes emit exactly one <code className="rounded bg-slate-100 px-1 font-mono text-xs">page_view</code> per route (duplicate URLs are ignored).</li>
        </ul>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-bold">3. Test it live</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
          <li>Open the <Link to="/store" className="font-semibold text-indigo-600 hover:underline">Everyday Market demo store</Link>.</li>
          <li>Browse home → products → a product → cart (each route records a <code className="rounded bg-slate-100 px-1 font-mono text-xs">page_view</code>).</li>
          <li>Click products, filters and Add to Cart (each records a <code className="rounded bg-slate-100 px-1 font-mono text-xs">click</code> with x/y).</li>
          <li>Return here via <Link to="/sessions" className="font-semibold text-indigo-600 hover:underline">Sessions</Link> — your visit appears as a new live session.</li>
        </ol>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-bold">4. Live heat overlay — heat on the real page</h2>
        <p className="mt-2 text-sm text-slate-600">
          See stored clicks glowing on top of the actual open page (read-only — the overlay records nothing):
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          <li>
            <strong>Store heat mode:</strong>{' '}
            <a
              href={`${window.location.origin}/store/products?heatmap=1`}
              className="font-mono text-xs font-semibold text-indigo-600 hover:underline"
            >
              {window.location.origin}/store/products?heatmap=1
            </a>{' '}
            — works on any store page.
          </li>
          <li>
            <strong>Any page:</strong> drag this bookmarklet to your bookmarks bar, then click it on any
            website you have permission to view:{' '}
            <a
              href={`javascript:!function(){var s=document.createElement('script');s.src='${BACKEND_ORIGIN}/heatmap-overlay.js';s.setAttribute('data-api-url','${BACKEND_ORIGIN}/api/events');document.body.appendChild(s);}();`}
              className="inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-600"
              title="Drag me to your bookmarks bar"
            >
              🔥 Show heat
            </a>
          </li>
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Coordinates map 1:1 onto the open page, so heat aligns best at a similar window width as when
          clicks were captured. Pages with no stored clicks show an honest empty notice.
        </p>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="flex items-center gap-2 font-bold"><ShieldCheck size={17} className="text-emerald-600" /> Live vs demo data</h2>
        <p className="mt-2 text-sm text-slate-600">
          Events captured by this script are stored with <code className="rounded bg-slate-100 px-1 font-mono text-xs">data_source: &quot;live&quot;</code>.
          Events from <code className="rounded bg-slate-100 px-1 font-mono text-xs">cd server &amp;&amp; npm run seed:demo</code> carry
          <code className="rounded bg-slate-100 px-1 font-mono text-xs"> data_source: &quot;demo&quot;</code> and are always badged DEMO —
          never presented as genuine visitors. The tracker collects only session ID, event type, page URL, timestamp,
          coordinates, viewport sizes, and clicked-element identity (tag, id, classes, visible text or image alt,
          link target, nearest section) — never passwords, form contents, tokens, or page text.
        </p>
      </section>
    </div>
  );
}
