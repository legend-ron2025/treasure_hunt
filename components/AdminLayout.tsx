'use client';
import { usePathname } from 'next/navigation';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    links: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
      { href: '/admin/progress', label: 'Live Progress', icon: '📈' },
      { href: '/admin/leaderboard', label: 'Leaderboard', icon: '🏆' },
    ],
  },
  {
    label: 'Management',
    links: [
      { href: '/admin/participants', label: 'Participants', icon: '👥' },
      { href: '/admin/reregister',   label: 'Re-Register',  icon: '🔄' },
      { href: '/admin/ban',          label: 'Ban List',     icon: '🚫' },
      { href: '/admin/audit-log',    label: 'Audit Log',    icon: '📋' },
    ],
  },
  {
    label: 'Event Setup',
    links: [
      { href: '/admin/schedule', label: 'Schedule', icon: '⏰' },
      { href: '/admin/content', label: 'Content', icon: '✏️' },
      { href: '/admin/qr', label: 'QR Codes', icon: '📱' },
    ],
  },
  {
    label: 'System',
    links: [
      { href: '/admin/sitemap', label: 'Site Map', icon: '🗺️' },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  function handleLogout(e: React.MouseEvent) {
    e.preventDefault();
    if (typeof window !== 'undefined') sessionStorage.removeItem('adminToken');
    window.location.href = '/admin/login';
  }

  return (
    <aside className="w-64 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col fixed left-0 top-0 z-20">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg">
            TH
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">Treasure Hunt</p>
            <p className="text-gray-400 text-xs mt-0.5">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest px-3 mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.links.map(({ href, label, icon }) => {
                const active = pathname === href;
                return (
                  <a
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                      active
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-base w-5 text-center leading-none">{icon}</span>
                    {label}
                    {active && <span className="ml-auto w-1.5 h-1.5 bg-blue-300 rounded-full" />}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-4 py-4 border-t border-gray-800">
        <div className="flex items-center gap-2 px-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-xs text-gray-300 font-bold flex-shrink-0">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">Admin</p>
            <p className="text-gray-500 text-xs truncate">NMIET</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-red-400 text-xs transition-colors p-1 rounded"
            title="Logout"
          >
            ⏏
          </button>
        </div>
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
  return (
    <div className="min-h-screen bg-gray-950 flex">
      <AdminSidebar />
      <div className="ml-64 flex-1 flex flex-col min-h-screen">
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
