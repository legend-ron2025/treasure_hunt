'use client';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    links: [
      { href: '/admin/dashboard',   label: 'Dashboard',      icon: '📊', badge: null },
      { href: '/admin/progress',    label: 'Live Progress',  icon: '📈', badge: 'LIVE' },
      { href: '/admin/leaderboard', label: 'Leaderboard',    icon: '🏆', badge: null },
    ],
  },
  {
    label: 'Participants',
    links: [
      { href: '/admin/participants', label: 'All Participants', icon: '👥', badge: null },
      { href: '/admin/reregister',   label: 'Re-Register',      icon: '🔄', badge: 'TEST' },
      { href: '/admin/ban',          label: 'Ban List',          icon: '🚫', badge: null },
    ],
  },
  {
    label: 'Event Setup',
    links: [
      { href: '/admin/schedule', label: 'Schedule',       icon: '⏰', badge: null },
      { href: '/admin/content',  label: 'Puzzle Content', icon: '✏️', badge: null },
      { href: '/admin/qr',       label: 'QR Codes',       icon: '📱', badge: null },
    ],
  },
  {
    label: 'Logs & Audit',
    links: [
      { href: '/admin/audit-log', label: 'Audit Log', icon: '📋', badge: null },
    ],
  },
  {
    label: 'System',
    links: [
      { href: '/admin/sitemap', label: 'Site Map', icon: '🗺️', badge: null },
    ],
  },
];

// ── Shared NavContent ─────────────────────────────────────────────────────────
function NavContent({
  pathname,
  onNavClick,
}: {
  pathname: string;
  onNavClick?: () => void;
}) {
  function handleLogout(e: React.MouseEvent) {
    e.preventDefault();
    if (typeof window !== 'undefined') sessionStorage.removeItem('adminToken');
    window.location.href = '/admin/login';
  }

  return (
    <>
      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest px-2 mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.links.map(({ href, label, icon, badge }) => {
                const active = pathname === href;
                return (
                  <a
                    key={href}
                    href={href}
                    onClick={onNavClick}
                    className={`flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                      active
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-base w-5 text-center leading-none flex-shrink-0">{icon}</span>
                    <span className="flex-1 truncate">{label}</span>
                    {badge && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                        badge === 'LIVE' ? 'bg-green-500/20 text-green-400' :
                        badge === 'TEST' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {badge}
                      </span>
                    )}
                    {active && <span className="w-1.5 h-1.5 bg-blue-300 rounded-full flex-shrink-0" />}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom — admin user + logout */}
      <div className="px-3 py-4 border-t border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 px-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-xs text-gray-300 font-bold flex-shrink-0">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">Admin</p>
            <p className="text-gray-500 text-xs truncate">VKM Event</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-red-400 text-sm transition-colors p-1.5 rounded-lg hover:bg-gray-800"
            title="Logout"
          >
            ⏏
          </button>
        </div>
      </div>
    </>
  );
}

// ── Desktop sidebar (fixed, always visible on md+) ────────────────────────────
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 min-h-screen bg-gray-900 border-r border-gray-800 flex-col fixed left-0 top-0 z-20">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0">
            VK
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-none truncate">VKM Treasure Hunt</p>
            <p className="text-gray-400 text-xs mt-0.5">Admin Panel</p>
          </div>
        </div>
      </div>
      <NavContent pathname={pathname} />
    </aside>
  );
}

// ── Mobile drawer (slide-in from left, shown on < md) ─────────────────────────
export function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  // Close drawer on route change
  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prevent body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-gray-900 border-r border-gray-800 flex flex-col z-40 md:hidden transform transition-transform duration-250 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg">
              VK
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">VKM Treasure Hunt</p>
              <p className="text-gray-400 text-xs mt-0.5">Admin Panel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors text-lg leading-none"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <NavContent pathname={pathname} onNavClick={onClose} />
      </aside>
    </>
  );
}

// ── AdminLayout (wraps pages) ─────────────────────────────────────────────────
interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  headerRight?: React.ReactNode;
}

export function AdminLayout({ children, title, headerRight }: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Desktop sidebar */}
      <AdminSidebar />

      {/* Mobile drawer */}
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main content — on desktop offset by sidebar width */}
      <div className="flex-1 flex flex-col min-h-screen w-full md:pl-64">
        {/* Top bar */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-10 w-full">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              className="md:hidden text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <rect y="3" width="20" height="2" rx="1" />
                <rect y="9" width="20" height="2" rx="1" />
                <rect y="15" width="20" height="2" rx="1" />
              </svg>
            </button>
            <h1 className="text-white font-bold text-base md:text-lg truncate">{title}</h1>
          </div>
          {headerRight && (
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 ml-3">
              {headerRight}
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
