'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DashboardSnapshot } from '@/lib/types';

function fmt(seconds: number | null): string {
  if (seconds === null) return '—';
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);

  function getToken() { return typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null; }

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }
    const fetch_ = () => fetch('/api/admin/live', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null).then((d) => d && setSnapshot(d));
    fetch_();
    const iv = setInterval(fetch_, 5000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-800 text-white px-4 py-3 flex gap-4 text-sm">
        <a href="/admin/dashboard" className="hover:text-blue-300">Dashboard</a>
        <a href="/admin/leaderboard" className="text-blue-300">Leaderboard</a>
      </nav>
      <main className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-800">Leaderboard</h1>
          <a href="/api/admin/leaderboard/export.csv" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Export CSV</a>
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['#', 'Name', 'Phone', 'S1', 'S2', 'S3', 'S4', 'S5', 'Total'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snapshot?.leaderboard.map((e) => (
                <tr key={e.rank} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 font-bold text-gray-500">#{e.rank}</td>
                  <td className="px-3 py-2 font-medium text-gray-800">{e.name}</td>
                  <td className="px-3 py-2 text-gray-500">{e.phone}</td>
                  <td className="px-3 py-2 font-mono">{fmt(e.stage1_seconds)}</td>
                  <td className="px-3 py-2 font-mono">{fmt(e.stage2_seconds)}</td>
                  <td className="px-3 py-2 font-mono">{fmt(e.stage3_seconds)}</td>
                  <td className="px-3 py-2 font-mono">{fmt(e.stage4_seconds)}</td>
                  <td className="px-3 py-2 font-mono">{fmt(e.stage5_seconds)}</td>
                  <td className="px-3 py-2 font-mono font-semibold text-blue-700">{fmt(e.total_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!snapshot?.leaderboard.length) && <p className="text-gray-500 text-sm p-4">No finishers yet.</p>}
        </div>
      </main>
    </div>
  );
}
