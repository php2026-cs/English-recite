import { NavLink, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  { to: '/', label: '首页', icon: '⌂' },
  { to: '/words', label: '词库', icon: '☰' },
  { to: '/review', label: '背诵', icon: '▸' },
  { to: '/stats', label: '统计', icon: '◔' },
  { to: '/lexicon/cet6', label: '六级', icon: '六' },
  { to: '/settings', label: '设置', icon: '⚙' }
];

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `flex flex-col items-center justify-center gap-1 rounded-xl px-4 py-1.5 text-xs transition-colors sm:flex-row sm:gap-2 sm:px-3 sm:py-2 sm:text-sm ${
    isActive ? 'text-brand-700' : 'text-slate-500 hover:text-slate-900'
  }`;
}

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 border-r border-slate-200 bg-white px-3 py-5 lg:block">
        <div className="mb-8 px-3 text-lg font-semibold tracking-tight">轻词</div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
              <span aria-hidden="true" className="text-lg">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6 lg:ml-56 lg:pb-12 lg:pt-10">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
            <span aria-hidden="true" className="text-lg">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
