'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { DashboardSnapshot, ParticipantRow } from '@/lib/types';

function formatElapsed(startIso: string, nowIso: string): string {
  const diff = Math.max(0, Math.floor((new Date(nowIso).getTime() - new Date(startIso).getTime()) / 1000));
  const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60), s = diff % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function ProgressBar({ participant, serverTime }: { participant: ParticipantRow; serverTime: string }) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    setElapsed(formatElapsed(participant.entered_current_stage_at, serverTime));
    const iv = setInterval(() => setElapsed(formatElapsed(participant.entered_current_stage_at, new Date().toISOString())), 1000);
    return () => clearInterval(iv);
  }, [participant.entered_current_stage_at, serverTime]);

  const completedStages = Math.max(0, participant.current_stage - 1);
  const statusColor = participant.status === 'completed' ? 'text-yellow-700 bg-yellow-50' : participant.status === 'cancelled' ? 'text-gray-500 bg-gray-50' : 'text-green-700 bg-green-50';

  return (
    <div className="bg-white rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-gray-800">{participant.name}</span>
          <span className="ml-2 text-xs text-gray-400">{participant.phone}</span>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>{participant.status}</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((stage) => {
          const done = stage < participant.current_stage;
          const current = stage === participant.current_stage && participant.status === 'active';
          return (
            <div key={stage} className={`flex-1 h-3 rounded-full transition-all ${done ? 'bg-blue-500' : current ? 'bg-blue-300 animate-pulse' : 'bg-gray-200'}`} title={`Stage ${stage}`} />
          );
        })}
      </div>
      {participant.status === 'active' && (
        <p className="text-xs text-gray-500">On Stage {participant.current_stage} for: <span className="font-mono">{elapsed}</span></p>
      )}
    </div>
  );
}

export default function LiveProgress() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [filter, setFilter] = useState('All');

  function getToken() { return typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null; }

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }
    const fetchData = () => fetch('/api/admin/live', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null).then((d) => d && setSnapshot(d));
    fetchData();
    const iv = setInterval(fetchData, 5000);
    return () => clearInterval(iv);
  }, []);

  const filtered = snapshot?.participants.filter((p) => filter === 'All' || p.status === filter.toLowerCase()) ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-800 text-white px-4 py-3 flex gap-4 text-sm">
        <a href="/admin/dashboard" className="hover:text-blue-300">Dashboard</a>
        <a href="/admin/progress" className="text-blue-300">Progress</a>
        <a href="/admin/participants" className="hover:text-blue-300">Participants</a>
      </nav>
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Live Progress</h1>
        <div className="flex gap-2 mb-4">
          {['All', 'Active', 'Completed', 'Cancelled'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full text-sm font-medium ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}>{f}</button>
          ))}
        </div>
        <div className="space-y-3">
          {filtered.map((p) => <ProgressBar key={p.id} participant={p} serverTime={snapshot?.server_time ?? new Date().toISOString()} />)}
          {filtered.length === 0 && <p className="text-gray-500 text-sm">No participants found.</p>}
        </div>
      </main>
    </div>
  );
}
