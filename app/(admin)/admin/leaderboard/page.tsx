'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DashboardSnapshot } from '@/lib/types';
import { AdminLayout } from '@/components/AdminLayout';

function fmt(seconds: number | null): string {
  if (seconds === null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  function getToken() { return typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null; }

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }
    const fetchData = () =>
      fetch(`/api/admin/live?_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) { setSnapshot(d); setLastUpdated(new Date()); } });
    fetchData();
    const iv = setInterval(fetchData, 5000);
    return () => clearInterval(iv);
  }, []);

  const lb = snapshot?.leaderboard ?? [];
  const rankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <AdminLayout
      title="Leaderboard"
      headerRight={
        <div className="flex items-center gap-3">
          <p className="text-gray-500 text-xs hidden md:block">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading…'} · auto-refresh 5s
          </p>
          <a
            href="/api/admin/leaderboard/export.csv"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            📥 Export CSV
          </a>
        </div>
      }
    >
      <div className="max-w-6xl">
        {lb.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-5xl mb-4">🏆</p>
            <p className="text-lg font-medium text-gray-400">No finishers yet</p>
            <p className="text-sm mt-1">The leaderboard will populate as students complete all 5 stages.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800/60">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Phone</th>
                    {['S1', 'S2', 'S3', 'S4', 'S5'].map((h) => (
                      <th key={h} className="px-3 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                        {h}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-semibold text-blue-400 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lb.map((e, idx) => (
                    <tr
                      key={e.rank}
                      className={`border-b border-gray-800 hover:bg-gray-800/40 transition-colors ${
                        e.rank <= 3 ? 'bg-yellow-900/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-bold text-lg text-gray-200">{rankBadge(e.rank)}</td>
                      <td className="px-4 py-3 font-semibold text-white">{e.name}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs hidden md:table-cell">{e.phone}</td>
                      {[e.stage1_seconds, e.stage2_seconds, e.stage3_seconds, e.stage4_seconds, e.stage5_seconds].map((s, i) => (
                        <td key={i} className="px-3 py-3 text-center font-mono text-xs text-gray-400 hidden lg:table-cell">
                          {fmt(s)}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-mono font-bold text-blue-400 text-base">
                        {fmt(e.total_seconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
