'use client';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    links: [
      { href: '/admin/dashboard',  label: 'Dashboard',     icon: '📊', badge: null },
      { href: '/admin/progress',   label: 'Live Progress', icon: '📈', badge: 'LIVE' },
      { href: '/admin/leaderboard',label: 'Leaderboard',   icon: '🏆', badge: null },
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
      { href: '/admin/schedule', label: 'Schedule',          icon: '⏰', badge: null },
      { href: '/admin/content',  label: 'Puzzle Content',    icon: '✏️', badge: null },
      { href: '/admin/qr',       label: 'QR Codes',          icon: '📱', badge: null },
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

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  function handleLogout(e: React.MouseEvent) {
    e.preventDefault();
    if (typeof window !== 'undefined') sessionStorage.removeItem('adminToken');
    window.location.href = '/admin/login';
  }

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-64'} min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col fixed left-0 top-0 z-20 transition-all duration-200`}
    >
      {/* Logo + collapse button */}
      <div className="px-4 py-5 border-b border-gray-800 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0">
              VK
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-none truncate">VKM Treasure Hunt</p>
              <p className="text-gray-400 text-xs mt-0.5">Admin Panel</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg mx-auto">
            VK
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`text-gray-500 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0 ${collapsed ? 'mx-auto mt-0' : 'ml-2'}`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest px-2 mb-1.5">
                {section.label}
              </p>
            )}
            {collapsed && <div className="border-t border-gray-800 my-2" />}
            <div className="space-y-0.5">
              {section.links.map(({ href, label, icon, badge }) => {
                const active = pathname === href;
                return (
                  <a
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    className={`flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                      active
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-base w-5 text-center leading-none flex-shrink-0">{icon}</span>
                    {!collapsed && (
                      <>
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
                      </>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom bar */}
      <div className="px-3 py-4 border-t border-gray-800">
        {!collapsed ? (
          <div className="flex items-center gap-2 px-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-xs text-gray-300 font-bold flex-shrink-0">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">Admin</p>
              <p className="text-gray-500 text-xs truncate">VKM Event</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-400 text-xs transition-colors p-1 rounded"
              title="Logout"
            >
              ⏏
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full flex justify-center text-gray-500 hover:text-red-400 text-sm transition-colors p-1"
            title="Logout"
          >
            ⏏
          </button>
        )}
      </div>
    </aside>
  );
}

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  headerRight?: React.ReactNode;
}

export function AdminLayout({ children, title, headerRight }: AdminLayoutProps) {
  // Read collapsed state from sidebar — use a simple approach with CSS variable
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar renders its own collapse state independently */}
      <AdminSidebar />
      {/* Main content — dynamic offset using CSS classes */}
      <div className="ml-64 flex-1 flex flex-col min-h-screen transition-all duration-200" id="admin-main-content">
        {/* Top bar */}
        <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-white font-bold text-lg">{title}</h1>
          {headerRight && <div className="flex items-center gap-3">{headerRight}</div>}
        </header>
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
