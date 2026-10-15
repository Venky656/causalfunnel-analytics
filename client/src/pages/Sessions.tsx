import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { getSessions } from '../lib/api';
import type { SessionSummary, Source } from '../lib/api';
import { fmtDateTime, shortId } from '../lib/format';
import { EmptyState, ErrorBox, Loading, SourceBadge, SourceBanner, SourceFilter } from '../components/ui';

export default function Sessions() {
  const [source, setSource] = useState<Source>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getSessions(source, debounced, page);
      setRows(res.data);
      setTotal(res.pagination.total);
      setPages(res.pagination.pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [source, debounced, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Sessions</h1>
          <p className="text-sm text-slate-500">
            {total} session{total === 1 ? '' : 's'} · counts calculated from stored events
          </p>
        </div>
        <SourceFilter value={source} onChange={(s) => { setSource(s); setPage(1); }} />
      </div>

      <SourceBanner source={source} />

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by session ID…"
          aria-label="Search sessions"
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {loading && <Loading label="Loading sessions…" />}
      {error && !loading && <ErrorBox message={error} onRetry={load} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState
          title="No sessions found"
          hint="Visit the demo storefront to generate live traffic, or seed demo data: cd server && npm run seed:demo."
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-semibold">Session</th>
                  <th className="px-5 py-3 font-semibold">Events</th>
                  <th className="px-5 py-3 font-semibold">Views</th>
                  <th className="px-5 py-3 font-semibold">Clicks</th>
                  <th className="px-5 py-3 font-semibold">Source</th>
                  <th className="px-5 py-3 font-semibold">Last activity</th>
                  <th className="px-5 py-3 font-semibold"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((s) => (
                  <tr key={s.session_id} className="transition-colors hover:bg-indigo-50/50">
                    <td className="px-5 py-3.5 font-mono text-xs font-bold" title={s.session_id}>
                      {shortId(s.session_id)}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums">{s.total_events}</td>
                    <td className="px-5 py-3.5 tabular-nums">{s.page_views}</td>
                    <td className="px-5 py-3.5 tabular-nums">{s.clicks}</td>
                    <td className="px-5 py-3.5"><SourceBadge sources={s.data_sources} /></td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-500">{fmtDateTime(s.last_seen)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        to={`/sessions/${encodeURIComponent(s.session_id)}`}
                        className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600"
                      >
                        View details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm">
            <span className="text-xs text-slate-500">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous page"
                className="rounded-lg border border-slate-300 p-2 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
                className="rounded-lg border border-slate-300 p-2 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
