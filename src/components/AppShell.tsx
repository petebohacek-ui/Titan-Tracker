import type { PropsWithChildren } from 'react';
import { BarChart3, Dumbbell, Home, LibraryBig, Settings, LayoutDashboard, History, Target, Copy, TrendingUp, UserCircle2 } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { useAppStore } from '../hooks/useAppStore';

const navLinks = [
  { to: '/', label: 'Home', icon: Home, exact: true },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: false },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, exact: false },
  { to: '/library', label: 'Library', icon: LibraryBig, exact: false },
  { to: '/account', label: 'Account', icon: UserCircle2, exact: false },
  { to: '/settings', label: 'Settings', icon: Settings, exact: false }
];

const quickLinks = [
  { to: '/history', label: 'History', icon: History },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/templates', label: 'Templates', icon: Copy },
  { to: '/over-time', label: 'Over Time', icon: TrendingUp }
];

export const AppShell = ({ children }: PropsWithChildren) => {
  const location = useLocation();
  const { canInstall, triggerInstall } = useInstallPrompt();
  const isOnline = useAppStore((state) => state.isOnline);
  const syncing = useAppStore((state) => state.syncing);
  const attemptSync = useAppStore((state) => state.attemptSync);
  const activeWorkout = useAppStore((state) => state.activeWorkout);

  const isActiveWorkoutPage = location.pathname.startsWith('/workout/');
  const homeFabClassName = `home-fab ${isActiveWorkoutPage ? 'home-fab-active-mobile' : 'home-fab-hide-mobile'}`;

  return (
    <div className="app-shell">
      <NavLink to="/" aria-label="Go to Home" className={homeFabClassName}>
        <Home size={18} />
        <span>Home</span>
      </NavLink>

      {!isActiveWorkoutPage && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="muted text-xs uppercase tracking-wider">Titan Track</p>
            <h1 className="text-xl font-bold">Advanced Workout Intelligence</h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={isOnline ? 'text-emerald-400' : 'text-amber-400'}>{isOnline ? 'Online' : 'Offline'}</span>
            <button className="btn-subtle" type="button" onClick={() => void attemptSync()} disabled={!isOnline || syncing}>
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
            {canInstall && (
              <button className="btn-primary" type="button" onClick={() => void triggerInstall()}>
                Install App
              </button>
            )}
          </div>
        </header>
      )}

      {!isActiveWorkoutPage && (
        <div className="mb-3 flex flex-wrap gap-2">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className="btn-subtle flex items-center gap-1.5 text-xs">
                <Icon size={14} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}

      <main className="space-y-4">{children}</main>

      {!isActiveWorkoutPage && (
        <nav className="bottom-nav">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
            return (
              <NavLink key={item.to} to={item.to} className={`nav-item ${isActive ? 'active' : ''}`}>
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
          {activeWorkout && (
            <NavLink to="/workout/active" className={({ isActive }) => `nav-item nav-item-live ${isActive ? 'active' : ''}`}>
              <Dumbbell size={18} />
              <span>Active</span>
            </NavLink>
          )}
        </nav>
      )}
    </div>
  );
};
