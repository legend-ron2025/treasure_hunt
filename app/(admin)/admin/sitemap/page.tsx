'use client';
import { ROUTES, type RouteCategory, type RouteDefinition } from '@/lib/routes';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const CATEGORY_LABELS: Record<RouteCategory, string> = {
  student: 'Student-Facing Pages',
  admin: 'Admin Panel Pages',
  'api-student': 'Student API Endpoints',
  'api-admin': 'Admin API Endpoints',
  cron: 'Internal / Cron',
};

const ACCESS_COLORS: Record<string, string> = {
  public: 'bg-green-100 text-green-700',
  session: 'bg-blue-100 text-blue-700',
  admin: 'bg-purple-100 text-purple-700',
  internal: 'bg-gray-100 text-gray-600',
};

export default function SitemapPage() {
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null;
    if (!token) router.replace('/admin/login');
  }, [router]);

  const categories = ['student', 'admin', 'api-student', 'api-admin', 'cron'] as RouteCategory[];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-800 text-white px-4 py-3 flex gap-4 text-sm">
        <a href="/admin/dashboard" className="hover:text-blue-300">Dashboard</a>
        <a href="/admin/sitemap" className="text-blue-300">Sitemap</a>
      </nav>
      <main className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Site Map</h1>
          <span className="text-sm text-gray-500">Total routes: {ROUTES.length}</span>
        </div>
        {categories.map((cat) => {
          const catRoutes = ROUTES.filter((r) => r.category === cat);
          if (catRoutes.length === 0) return null;
          return (
            <section key={cat} className="mb-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                {CATEGORY_LABELS[cat]}
                <span className="text-xs font-normal text-gray-400">— {catRoutes.length} routes</span>
              </h2>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Path', 'Name', 'Access', 'Description'].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {catRoutes.map((r) => (
                      <tr key={r.path} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono text-xs text-blue-700">{r.path}</td>
                        <td className="px-4 py-2 font-medium text-gray-800">{r.name}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACCESS_COLORS[r.access] ?? ''}`}>{r.access}</span>
                        </td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{r.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
