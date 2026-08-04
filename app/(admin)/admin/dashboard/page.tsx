'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { DashboardSnapshot } from '@/lib/types';

function AdminNav() {
  const links = [
    ['/admin/dashboard', 'Dashboard'], ['/admin/progress', 'Live Progress'],
    ['/admin/leaderboard', 'Leaderboard'], ['/admin/content', 'Content'],
    ['/admin/qr', 'QR Codes'], ['/admin/ban', 'Ban List'],
    ['/admin/schedule', 'Schedule'], ['/admin/participants', 'Participants'],
    ['/admin/audit-log', 'Audit Log'], ['/admin/sitemap', 'Sitemap'],
  ];
  return (
    <nav className="bg-gray-800 text-white px-4 py-3 flex flex-wrap gap-3 text-sm">
      {links.map(([href, label]) => (
        <a key={href} href={href} className="hover:text-blue-300 transition-colors">{label}</a>
      ))}
    </nav>
  );
}

export default function DashboardOverview() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function getToken() { return typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null; }

  async function fetchLive() {
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }
    const res = await fetch('/api/admin/live', { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { router.replace('/admin/login'); return; }
    if (res.ok) setSnapshot(await res.json());
  }

  useEffect(() => {
    fetchLive();
    intervalRef.current = setInterval(fetchLive, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const s = snapshot?.summary;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <main className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard Overview</h1>
        {s && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Registered', value: s.total_registered, color: 'blue' },
                { label: 'Active', value: s.active, color: 'green' },
                { label: 'Completed', value: s.completed, color: 'yellow' },
                { label: 'Cancelled', value: s.cancelled, color: 'red' },
              ].map(({ label, value, color }) => (
                <div key={label} className={`bg-white rounded-xl shadow-sm p-4 border-l-4 border-${color}-400`}>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-3xl font-bold text-gray-800">{value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-semibold text-gray-700 mb-3">By Stage (Active)</h3>
              <div className="grid grid-cols-5 gap-2">
                {([1, 2, 3, 4, 5] as const).map((stage) => (
                  <div key={stage} className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-blue-500">Stage {stage}</p>
                    <p className="text-2xl font-bold text-blue-700">{s.by_stage[stage]}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        {!snapshot && <p className="text-gray-500">Loading…</p>}
      </main>
    </div>
  );
}
