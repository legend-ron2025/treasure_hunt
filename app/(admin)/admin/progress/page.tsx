'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DashboardSnapshot, ParticipantRow } from '@/lib/types';
import { AdminLayout } from '@/components/AdminLayout';

function formatElapsed(startIso: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000));
  const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60), s = diff % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function ProgressBar({ participant }: { participant: ParticipantRow }) {
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    if (participant.status !== 'active') return;
    const tick = () => setElapsed(formatElapsed(participant.entered_current_stage_at));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [participant.entered_current_stage_at, participant.status]);

  const stageColors = ['bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-fuchsia-500', 'bg-rose-500'];
  const statusBadge =
    participant.status === 'completed'
      ? 'bg-yellow-900/60 text-yellow-300'
      : participant.status === 'cancelled'
      ? 'bg-gray-800 text-gray-500'
      : 'bg-green-900/60 text-green-300';

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-3 hover:border-gray-600 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              participant.status === 'active'
                ? 'bg-green-400 animate-pulse'
                : participant.status === 'completed'
                ? 'bg-yellow-400'
                : 'bg-gray-600'
            }`}
          />
          <p className="text-white font-semibold truncate">{participant.name}</p>
          <p className="text-gray-500 text-xs flex-shrink-0">{participant.phone}</p>
        </div>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex-shrink-0 ${statusBadge}`}>
          {participant.status === 'active' ? `Stage ${participant.current_stage}` : participant.status}
        </span>
      </div>

      {/* 5-segment progress bar */}
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((stage) => {
          const done = stage < participant.current_stage;
          const current = stage === participant.current_stage && participant.status === 'active';
          return (
            <div
              key={stage}
              title={`Stage ${stage}`}
              className={`flex-1 h-2.5 rounded-full transition-all duration-500 ${
                done
                  ? stageColors[stage - 1]
                  : current
                  ? `${stageColors[stage - 1]} opacity-60 animate-pulse`
                  : 'bg-gray-700'
              }`}
            />
          );
        })}
      </div>

      {/* Timestamps */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-gray-500">Started</p>
          <p className="text-gray-300 font-mono">{new Date(participant.registered_at).toLocaleTimeString()}</p>
        </div>
        {participant.status === 'active' && (
          <div>
            <p className="text-gray-500">On stage {participant.current_stage} for</p>
            <p className="text-green-400 font-mono font-bold">{elapsed}</p>
          </div>
        )}
        {participant.status === 'completed' && participant.stage5_at && (
          <div>
            <p className="text-gray-500">Finished</p>
            <p className="text-yellow-300 font-mono">{new Date(participant.stage5_at).toLocaleTimeString()}</p>
          </div>
        )}
        {participant.status === 'cancelled' && participant.cancelled_at && (
          <div>
            <p className="text-gray-500">Cancelled</p>
            <p className="text-gray-400 font-mono">{new Date(participant.cancelled_at).toLocaleTimeString()}</p>
          </div>
        )}
      </div>

      {/* Stage completion times */}
      <div className="flex gap-1 flex-wrap">
        {[
          [1, participant.stage1_at],
          [2, participant.stage2_at],
          [3, participant.stage3_at],
          [4, participant.stage4_at],
          [5, participant.stage5_at],
        ].map(([n, at]) => (
          <span
            key={String(n)}
            className={`text-xs px-2 py-0.5 rounded-lg font-mono ${
              at ? 'bg-blue-900/50 text-blue-300' : 'bg-gray-800 text-gray-600'
            }`}
            title={at ? `Stage ${n} completed at ${new Date(at as string).toLocaleTimeString()}` : `Stage ${n} not reached`}
          >
            S{n} {at ? '✓' : '—'}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function LiveProgress() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [filter, setFilter] = useState('All');
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
    const iv = setInterval(fetchData, 2000);
    return () => clearInterval(iv);
  }, []);

  const filtered =
    snapshot?.participants.filter((p) =>
      filter === 'All' || p.status === filter.toLowerCase(),
    ) ?? [];

  const filterCounts = snapshot
    ? {
        All: snapshot.participants.length,
        Active: snapshot.participants.filter((p) => p.status === 'active').length,
        Completed: snapshot.participants.filter((p) => p.status === 'completed').length,
        Cancelled: snapshot.participants.filter((p) => p.status === 'cancelled').length,
      }
    : null;

  return (
    <AdminLayout
      title="Live Progress"
      headerRight={
        <p className="text-gray-500 text-xs">
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading…'} · auto-refresh 2s
        </p>
      }
    >
      <div className="max-w-4xl space-y-5">
        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['All', 'Active', 'Completed', 'Cancelled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {f}
              {filterCounts && (
                <span className="ml-1.5 text-xs opacity-70">({filterCounts[f as keyof typeof filterCounts]})</span>
              )}
            </button>
          ))}
        </div>

        {/* Participant cards */}
        <div className="space-y-3">
          {filtered.map((p) => (
            <ProgressBar key={p.id} participant={p} />
          ))}
          {filtered.length === 0 && snapshot && (
            <div className="text-center py-12 text-gray-600">
              <p className="text-4xl mb-3">👥</p>
              <p>No participants in this category.</p>
            </div>
          )}
          {!snapshot && (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
