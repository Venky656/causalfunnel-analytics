import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, MousePointerClick, Users, Zap } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getOverview } from '../lib/api';
import type { OverviewData, Source } from '../lib/api';
import { fmtDate } from '../lib/format';
import { EmptyState, ErrorBox, Loading, MetricCard, SourceBanner, SourceFilter } from '../components/ui';

export default function Overview() {
  const [source, setSource] = useState<Source>('all');
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getOverview(source));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Overview</h1>
          <p className="text-sm text-slate-500">Everything below is calculated from stored events in MongoDB.</p>
        </div>
        <SourceFilter value={source} onChange={setSource} />
      </div>

      <SourceBanner source={source} />
      {loading && <Loading label="Loading overview…" />}
      {error && !loading && <ErrorBox message={error} onRetry={load} />}

      {!loading && !error && data && (
        <>
          {data.total_events === 0 ? (
            <EmptyState
              title="No events yet"
              hint="Open the Everyday Market storefront (/store) and click around, or run the demo seed: cd server && npm run seed:demo — then refresh."
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <MetricCard icon={Users} label="Total sessions" value={data.total_sessions} accent="bg-indigo-100 text-indigo-700" />
                <MetricCard icon={Zap} label="Total events" value={data.total_events} accent="bg-violet-100 text-violet-700" />
                <MetricCard icon={Eye} label="Page views" value={data.page_views} accent="bg-emerald-100 text-emerald-700" />
                <MetricCard icon={MousePointerClick} label="Clicks" value={data.clicks} accent="bg-amber-100 text-amber-700" />
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 xl:col-span-2">
                  <h2 className="font-bold">Activity — last 14 days</h2>
                  <div className="mt-3 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.by_day.map((d) => ({ ...d, day: fmtDate(d.date) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="page_views" name="Page views" stackId="1" stroke="#10b981" fill="#a7f3d0" />
                        <Area type="monotone" dataKey="clicks" name="Clicks" stackId="1" stroke="#f59e0b" fill="#fde68a" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <h2 className="font-bold">Event mix</h2>
                  <div className="mx-auto mt-1 h-56 max-w-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie dataKey="value" nameKey="name" data={[
                          { name: 'Page views', value: data.page_views },
                          { name: 'Clicks', value: data.clicks },
                        ]} innerRadius={55} outerRadius={85} paddingAngle={3}>
                          <Cell fill="#10b981" />
                          <Cell fill="#f59e0b" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex justify-center gap-4 text-xs font-medium text-slate-600">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Page views</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Clicks</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="font-bold">Top pages</h2>
                <ul className="mt-3 divide-y divide-slate-100">
                  {data.top_pages.map((p) => (
                    <li key={p.page_url} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="truncate font-mono text-xs text-slate-600">{p.page_url}</span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold tabular-nums">
                        {p.events} events
                      </span>
                    </li>
                  ))}
                </ul>
                <Link to="/heatmaps" className="mt-3 inline-block text-sm font-semibold text-indigo-600 hover:underline">
                  Open click heatmaps →
                </Link>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="font-bold">Most clicked elements</h2>
                <p className="mt-0.5 text-xs text-slate-500">Exactly which text, image, card or button visitors clicked.</p>
                {data.top_elements.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">No clicks with element data yet.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {data.top_elements.map((el, i) => (
                      <li key={`${el.tag}-${el.text}-${i}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <span className="min-w-0">
                          <span className="mr-2 rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                            {el.tag || 'UNKNOWN'}
                          </span>
                          <span className="truncate text-xs text-slate-600">
                            {el.text ? `“${el.text}”` : '(no text)'}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold tabular-nums text-amber-800">
                          {el.clicks} clicks
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
