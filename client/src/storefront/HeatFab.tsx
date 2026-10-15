import { useState } from 'react';
import { Flame } from 'lucide-react';
import { API_BASE } from '../lib/api';

declare global {
  interface Window {
    __cfHeat?: { toggle: () => boolean };
    __cfHeatLoaded?: boolean;
  }
}

/**
 * One floating button on the live storefront. Clicking it overlays the
 * store's own LIVE click analytics as heat, right on the open page.
 * Click again to hide. Read-only — it records nothing.
 */
export default function HeatFab() {
  const [on, setOn] = useState(false);

  const click = () => {
    const base = API_BASE.replace(/\/$/, '');
    if (!document.getElementById('cf-heat-live')) {
      const s = document.createElement('script');
      s.id = 'cf-heat-live';
      s.async = true;
      s.src = `${base}/heatmap-overlay.js`;
      s.setAttribute('data-api-url', `${base}/api/events`);
      s.setAttribute('data-source', 'live');
      s.onerror = () => {
        // eslint-disable-next-line no-console
        console.warn('[heat] could not load overlay — is the backend running?');
      };
      document.head.appendChild(s);
      setOn(true);
      return;
    }
    if (window.__cfHeat) setOn(window.__cfHeat.toggle());
    else setOn(true);
  };

  return (
    <button
      onClick={click}
      aria-pressed={on}
      title="Show live click heat on this page"
      className={`fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-white shadow-xl transition-colors ${
        on ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-900 hover:bg-emerald-700'
      }`}
    >
      <Flame size={17} />
      {on ? 'Hide heat' : 'Show heat'}
    </button>
  );
}
