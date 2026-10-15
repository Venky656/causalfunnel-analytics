import { NavLink, Link } from 'react-router-dom';
import {
  Activity,
  Flame,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  Users,
} from 'lucide-react';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/sessions', label: 'Sessions', icon: Users, end: false },
  { to: '/heatmaps', label: 'Click Heatmaps', icon: Flame, end: false },
  { to: '/setup', label: 'Tracking Setup', icon: Settings, end: false },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col bg-slate-900 text-slate-200 max-md:hidden">
        <div className="flex items-center gap-2.5 px-5 pb-6 pt-6">
          <span className="rounded-xl bg-indigo-600 p-2 text-white">
            <Activity size={20} />
          </span>
          <div>
            <p className="text-sm font-extrabold tracking-tight text-white">CausalFunnel</p>
            <p className="text-[11px] uppercase tracking-widest text-slate-400">Analytics</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3" aria-label="Dashboard">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto p-4">
          <Link
            to="/store"
            className="flex items-center gap-3 rounded-xl bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700"
          >
            <ShoppingBag size={18} />
            Everyday Market ↗
          </Link>
          <p className="mt-3 px-1 text-[11px] leading-relaxed text-slate-500">
            Demo storefront that generates live tracking events.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <nav className="flex gap-1 overflow-x-auto bg-slate-900 px-3 py-2 md:hidden" aria-label="Dashboard mobile">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${
                  isActive ? 'bg-indigo-600 text-white' : 'text-slate-300'
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
          <Link
            to="/store"
            className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium text-slate-300"
          >
            <ShoppingBag size={15} />
            Store
          </Link>
        </nav>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
