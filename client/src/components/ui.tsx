import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Inbox } from 'lucide-react';
import type { Source } from '../lib/api';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" aria-label="loading" />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border-l-4 border-red-500 bg-white p-5 text-sm shadow-sm ring-1 ring-slate-200">
      <p className="flex items-center gap-2 font-semibold text-red-700">
        <AlertTriangle size={16} /> Couldn&apos;t load data
      </p>
      <p className="mt-1 text-slate-600">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
      <Inbox size={28} className="mx-auto text-slate-300" />
      <p className="mt-3 font-semibold text-slate-700">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className={`inline-flex rounded-xl p-2.5 ${accent}`}>
        <Icon size={20} />
      </div>
      <p className="mt-3 text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-500">{label}</p>
    </div>
  );
}

export function SourceBadge({ sources }: { sources: string[] }) {
  const isDemo = sources.includes('demo') && !sources.includes('live');
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
        isDemo ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
      }`}
      title={isDemo ? 'Simulated sample data — not real visitors' : 'Captured by the tracking script'}
    >
      {isDemo ? 'demo' : 'live'}
    </span>
  );
}

const SOURCE_OPTIONS: { value: Source; label: string }[] = [
  { value: 'all', label: 'All events' },
  { value: 'live', label: 'Live events' },
  { value: 'demo', label: 'Demo events' },
];

export function SourceFilter({ value, onChange }: { value: Source; onChange: (s: Source) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium text-slate-500">Data source</span>
      <select
        aria-label="Data source filter"
        value={value}
        onChange={(e) => onChange(e.target.value as Source)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:border-indigo-500 focus:outline-none"
      >
        {SOURCE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SourceBanner({ source }: { source: Source }) {
  if (source === 'live')
    return (
      <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
        Showing <strong>live traffic</strong> captured by the tracking script.
      </p>
    );
  if (source === 'demo')
    return (
      <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
        Showing <strong>demo sample data</strong> — simulated events for illustration, not real visitors.
      </p>
    );
  return (
    <p className="rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-800 ring-1 ring-indigo-200">
      Showing <strong>combined</strong> live + demo data. Use the source filter to separate them.
    </p>
  );
}
