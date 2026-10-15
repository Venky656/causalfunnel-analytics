import { useEffect } from 'react';
import { API_BASE } from '../lib/api';

/**
 * Loads the standalone backend tracking script — but ONLY inside the demo
 * storefront routes. Dashboard pages never load it, so dashboard usage is
 * not recorded as store traffic and page_views can't be double-counted.
 *
 * Heat mode: opening a store page with ?heatmap=1 additionally loads the
 * read-only heat overlay, which paints stored clicks over the live page.
 */
export default function TrackerLoader() {
  useEffect(() => {
    const base = API_BASE.replace(/\/$/, '');
    const id = 'cf-tracker';
    if (!document.getElementById(id)) {
      const s = document.createElement('script');
      s.id = id;
      s.async = true;
      s.src = `${base}/tracker.js`;
      s.setAttribute('data-api-url', `${base}/api/events`);
      s.onerror = () => {
        // Tracking is best-effort: the store must keep working if the backend is down.
        // eslint-disable-next-line no-console
        console.warn('[tracker] could not load tracking script — events will not be recorded.');
      };
      document.head.appendChild(s);
    }

    let params: URLSearchParams | null = null;
    try {
      params = new URLSearchParams(window.location.search);
    } catch {
      params = null;
    }
    if (params && params.get('heatmap') === '1' && !document.getElementById('cf-heat')) {
      const o = document.createElement('script');
      o.id = 'cf-heat';
      o.async = true;
      o.src = `${base}/heatmap-overlay.js`;
      o.setAttribute('data-api-url', `${base}/api/events`);
      o.setAttribute('data-source', 'live');
      document.head.appendChild(o);
    }
  }, []);
  return null;
}
