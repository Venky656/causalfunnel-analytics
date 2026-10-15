import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, MousePointerClick } from 'lucide-react';
import { getSessionEvents } from '../lib/api';
import type { EventItem, Source } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { EmptyState, ErrorBox, Loading, SourceBadge } from '../components/ui';

export default function SessionDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const sessionId = decodeURIComponent(id);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const source: Source = 'all';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setEvents(await getSessionEvents(sessionId, source));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load session events');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <Link to="/sessions" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-indigo-600">
        <ArrowLeft size={16} /> Back to sessions
      </Link>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">User journey</h1>
        <p className="mt-1 break-all font-mono text-xs text-slate-500">{sessionId}</p>
        {!loading && !error && events.length > 0 && (
          <p className="mt-1 text-sm text-slate-500">
            {events.length} event{events.length === 1 ? '' : 's'} in chronological order.{' '}
            <SourceBadge sources={[...new Set(events.map((e) => e.data_source))]} />
          </p>
        )}
      </div>

      {loading && <Loading label="Loading journey…" />}
      {error && !loading && <ErrorBox message={error} onRetry={load} />}
      {!loading && !error && events.length === 0 && (
        <EmptyState title="No events for this session" hint="The session may have been filtered out or no longer exists." />
      )}

      {!loading && !error && events.length > 0 && (
        <ol className="relative flex flex-col gap-3 border-l-2 border-slate-200 pl-0">
          {events.map((e, i) => {
            const isClick = e.event_type === 'click';
            return (
              <li key={e._id ?? `${e.timestamp}-${i}`} className="relative ml-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <span
                  className={`absolute -left-[33px] top-4 rounded-full p-1.5 text-white ${
                    isClick ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                >
                  {isClick ? <MousePointerClick size={14} /> : <Eye size={14} />}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold tabular-nums text-slate-400">#{i + 1}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                      isClick ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {e.event_type}
                  </span>
                  <span className="text-xs text-slate-400">{fmtDateTime(e.timestamp)}</span>
                </div>
                <p className="mt-1.5 break-all font-mono text-xs text-slate-600">{e.page_url}</p>
                {isClick && (
                  <p className="mt-1 inline-block rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">
                    x={e.x}, y={e.y}
                    {e.viewport_width ? ` · viewport ${e.viewport_width}×${e.viewport_height}` : ''}
                  </p>
                )}
                {isClick && (e.element_tag || e.element_text || e.element_section) && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {e.element_tag && (
                      <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono font-bold text-white">
                        {e.element_tag}
                      </span>
                    )}
                    {e.element_text && (
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-800 ring-1 ring-indigo-200">
                        “{e.element_text}”
                      </span>
                    )}
                    {e.element_section && (
                      <span className="rounded bg-slate-50 px-1.5 py-0.5 text-slate-500 ring-1 ring-slate-200">
                        § {e.element_section}
                      </span>
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
