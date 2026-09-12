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
  return `ark-nav-link ${
    isActive ? 'is-active' : ''
  }`;
}

export function AppLayout() {
  return (
    <div className="ark-shell min-h-screen text-slate-900" data-ark-theme="endfield" data-ark-depth="moderate">
      <aside className="ark-sidebar">
        <LinkBrand />
        <p className="ark-rail-label">学习导航 / NAVIGATION</p>
        <nav className="space-y-2" aria-label="主导航">
          {navItems.map((item, index) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
              <span aria-hidden="true" className="text-lg">
                {item.icon}
              </span>
              <span>{item.label}</span>
              <span className="nav-index" aria-hidden="true">0{index + 1}</span>
            </NavLink>
          ))}
        </nav>
        <div className="ark-rail-footer"><span className="ark-signal" /> 六级词汇学习<br /><span className="mt-2 block text-xs tracking-widest">LIGHTWORDS / CET6</span></div>
      </aside>

      <div className="ark-topbar"><div className="lg:hidden"><LinkBrand /></div><span className="hidden text-xs tracking-widest lg:block">轻词 / VOCABULARY WORKSPACE</span><span className="ark-edition">CET6</span></div>
      <main className="ark-main">
        <Outlet />
      </main>

      <nav className="ark-mobile-nav" aria-label="手机导航">
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

function LinkBrand() {
  return <NavLink to="/" className="ark-brand" aria-label="轻词首页"><span className="ark-brand-symbol" aria-hidden="true">L<span>／</span></span><span>轻词<small>LIGHTWORDS</small></span></NavLink>;
}
