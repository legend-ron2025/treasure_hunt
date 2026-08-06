'use client';
import { useCallback, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { DashboardSnapshot } from '@/lib/types';
import { AdminLayout } from '@/components/AdminLayout';

export default function DashboardOverview() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [eventStatus, setEventStatus] = useState<'before' | 'active' | 'ended' | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function getToken() { return typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null; }

  const fetchLive = useCallback(async () => {
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }
    const res = await fetch(`/api/admin/live?_t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.status === 401) { router.replace('/admin/login'); return; }
    if (res.ok) { setSnapshot(await res.json()); setLastUpdated(new Date()); }
  }, [router]);

  const fetchEventStatus = useCallback(async () => {
    const res = await fetch('/api/time', { cache: 'no-store' });
    if (res.ok) { const d = await res.json(); setEventStatus(d.eventStatus); }
  }, []);

  useEffect(() => {
    fetchLive();
    fetchEventStatus();
    intervalRef.current = setInterval(fetchLive, 2000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchLive, fetchEventStatus]);

  const s = snapshot?.summary;

  const statCards = s ? [
    { label: 'Total Registered', value: s.total_registered, icon: '👥', gradient: 'from-blue-500 to-blue-700', badge: 'All time' },
    { label: 'Active Now',       value: s.active,            icon: '🟢', gradient: 'from-emerald-500 to-green-700', badge: 'Live' },
    { label: 'Completed',        value: s.completed,         icon: '🏆', gradient: 'from-amber-500 to-yellow-700',  badge: 'Winners' },
    { label: 'Cancelled',        value: s.cancelled,         icon: '✖',  gradient: 'from-rose-500 to-red-700',     badge: 'Dropped' },
  ] : [];

  const eventBadge = eventStatus === 'active'
    ? { label: 'LIVE',     color: 'bg-green-500 text-white animate-pulse' }
    : eventStatus === 'before'
    ? { label: 'UPCOMING', color: 'bg-blue-500 text-white' }
    : eventStatus === 'ended'
    ? { label: 'ENDED',    color: 'bg-gray-500 text-white' }
    : null;

  return (
    <AdminLayout
      title="Dashboard Overview"
      headerRight={
        <div className="flex items-center gap-3">
          {eventBadge && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${eventBadge.color}`}>
              {eventBadge.label}
            </span>
          )}
          <p className="text-gray-500 text-xs hidden md:block">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading…'} · 2s
          </p>
          <button
            onClick={fetchLive}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      }
    >
      <div className="space-y-6 max-w-6xl">
        {/* Stat cards */}
        {s && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map(({ label, value, icon, gradient, badge }) => (
              <div key={label} className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 shadow-xl relative overflow-hidden`}>
                <div className="absolute top-3 right-3 text-white/20 text-5xl font-black select-none">{icon}</div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">{badge}</p>
                <p className="text-4xl md:text-5xl font-extrabold text-white tabular-nums leading-none mb-2">{value}</p>
                <p className="text-white/80 text-sm font-medium">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Stage pipeline */}
        {s && (
          <div className="bg-gray-900 rounded-2xl p-5 md:p-6 border border-gray-800 shadow-xl">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <h3 className="text-white font-semibold flex items-center gap-2 text-base">
                <span>🗺️</span> Stage Pipeline
              </h3>
              <p className="text-gray-500 text-xs">Active participants by current stage</p>
            </div>
            <div className="flex items-end gap-2 md:gap-3 h-28 md:h-32">
              {([1, 2, 3, 4, 5] as const).map((stage) => {
                const count = s.by_stage[stage];
                const maxCount = Math.max(...([1, 2, 3, 4, 5] as const).map((n) => s.by_stage[n]), 1);
                const pct = Math.max((count / maxCount) * 100, count > 0 ? 8 : 0);
                const colors = [
                  'bg-gradient-to-t from-blue-700 to-blue-400',
                  'bg-gradient-to-t from-indigo-700 to-indigo-400',
                  'bg-gradient-to-t from-violet-700 to-violet-400',
                  'bg-gradient-to-t from-fuchsia-700 to-fuchsia-400',
                  'bg-gradient-to-t from-rose-700 to-rose-400',
                ];
                const labels = ['Medium', 'Med-Hard', 'Hard', 'Very Hard', 'Final Boss'];
                return (
                  <div key={stage} className="flex-1 flex flex-col items-center gap-1.5 md:gap-2">
                    <p className="text-white font-bold tabular-nums text-base md:text-lg">{count}</p>
                    <div className="w-full bg-gray-800 rounded-xl overflow-hidden h-16 md:h-20 flex items-end">
                      <div className={`w-full ${colors[stage - 1]} rounded-xl transition-all duration-700 ease-out`} style={{ height: `${pct}%` }} />
                    </div>
                    <div className="text-center">
                      <p className="text-gray-300 text-xs font-semibold">S{stage}</p>
                      <p className="text-gray-600 text-xs hidden md:block">{labels[stage - 1]}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Live participants + Quick actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {snapshot && snapshot.participants.length > 0 && (
            <div className="lg:col-span-2 bg-gray-900 rounded-2xl p-5 border border-gray-800 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2 text-base">
                  <span>⚡</span> Live Participants
                </h3>
                <a href="/admin/participants" className="text-blue-400 hover:text-blue-300 text-xs transition-colors">
                  View all →
                </a>
              </div>
              <div className="space-y-2">
                {snapshot.participants.slice(0, 6).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.status === 'active' ? 'bg-green-400 animate-pulse' : p.status === 'completed' ? 'bg-yellow-400' : 'bg-gray-600'}`} />
                    <p className="text-white text-sm font-medium flex-1 truncate">{p.name}</p>
                    <div className="flex gap-0.5 flex-shrink-0">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div key={n} className={`w-3 h-3 md:w-3.5 md:h-3.5 rounded-sm ${n < p.current_stage ? 'bg-green-500' : n === p.current_stage && p.status === 'active' ? 'bg-blue-400 animate-pulse' : 'bg-gray-700'}`} />
                      ))}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${p.status === 'active' ? 'bg-green-900/60 text-green-300' : p.status === 'completed' ? 'bg-yellow-900/60 text-yellow-300' : 'bg-gray-700 text-gray-400'}`}>
                      {p.status === 'active' ? `S${p.current_stage}` : p.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 shadow-xl">
            <h3 className="text-white font-semibold mb-4 text-base">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { href: '/admin/schedule',    icon: '⏰', label: 'Schedule',      desc: 'Set event dates' },
                { href: '/admin/content',     icon: '✏️', label: 'Edit Puzzles',  desc: 'Update stages' },
                { href: '/admin/qr',          icon: '📱', label: 'QR Codes',      desc: 'Generate & download' },
                { href: '/admin/participants',icon: '👥', label: 'Participants',   desc: 'Manage players' },
                { href: '/admin/ban',         icon: '🚫', label: 'Ban List',       desc: 'Block users' },
                { href: '/admin/progress',    icon: '📈', label: 'Live Progress',  desc: 'Real-time tracking' },
              ].map(({ href, icon, label, desc }) => (
                <a key={href} href={href} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors group">
                  <span className="text-lg w-6 text-center flex-shrink-0">{icon}</span>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium group-hover:text-blue-300 transition-colors truncate">{label}</p>
                    <p className="text-gray-500 text-xs truncate">{desc}</p>
                  </div>
                  <span className="ml-auto text-gray-600 group-hover:text-gray-400 text-xs flex-shrink-0">→</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {!snapshot && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 text-sm">Loading dashboard…</p>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
