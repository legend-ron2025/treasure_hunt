'use client';
/**
 * /event-ended — shown to non-winners when the event ends (first person completes all 5 stages).
 * Polls /api/student/event-status every 5s in case data is still propagating.
 */
import { useEffect, useState, useCallback } from 'react';
import CollegeHeader from '@/components/CollegeHeader';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

type ProgressEntry = {
  name: string;
  stagesCompleted: number;
  completed: boolean;
};

type EventStatusData = {
  status: string;
  winner: { name: string; totalSeconds: number } | null;
  durationSeconds: number | null;
  progress: ProgressEntry[];
};

export default function EventEndedPage() {
  const [data, setData] = useState<EventStatusData | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/student/event-status?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const stageBar = (completed: number) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`h-2 flex-1 rounded-full ${n <= completed ? 'bg-emerald-400' : 'bg-gray-700'}`}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <CollegeHeader />
      <main className="flex-1 flex flex-col items-center px-4 py-8 max-w-lg mx-auto w-full space-y-6">

        {/* Hero */}
        <div className="w-full bg-gradient-to-br from-blue-900 to-indigo-900 rounded-3xl p-6 text-center space-y-3 border border-blue-700 shadow-2xl">
          <div className="text-5xl">🏁</div>
          <h1 className="text-2xl font-extrabold text-white">Event Has Ended!</h1>
          <p className="text-blue-200 text-sm">
            Thank you for participating in the VKM Treasure Hunt. You gave it your best!
          </p>

          {data?.durationSeconds != null && (
            <div className="bg-blue-800/50 rounded-2xl px-4 py-2 inline-block mt-1">
              <p className="text-xs text-blue-300 font-medium">Event Duration</p>
              <p className="text-white font-bold text-lg">{formatDuration(data.durationSeconds)}</p>
            </div>
          )}
        </div>

        {/* Winner announcement */}
        {data?.winner ? (
          <div className="w-full bg-gradient-to-br from-yellow-900/60 to-amber-900/40 border border-yellow-600 rounded-2xl p-5 text-center space-y-2">
            <div className="text-4xl">🏆</div>
            <p className="text-yellow-300 text-xs font-semibold uppercase tracking-widest">Winner</p>
            <p className="text-2xl font-extrabold text-yellow-200">{data.winner.name}</p>
            <p className="text-yellow-400 text-sm">
              Completed all 5 stages in{' '}
              <span className="font-bold text-yellow-200">{formatDuration(data.winner.totalSeconds)}</span>
            </p>
          </div>
        ) : (
          <div className="w-full bg-gray-900 border border-gray-700 rounded-2xl p-5 text-center">
            <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Loading results…</p>
          </div>
        )}

        {/* Thank you message */}
        <div className="w-full bg-gray-900 border border-gray-700 rounded-2xl p-5 text-center space-y-2">
          <p className="text-lg font-bold text-white">🙏 Thank You!</p>
          <p className="text-gray-300 text-sm leading-relaxed">
            Thank you all for being part of the <span className="text-blue-300 font-semibold">VKM Treasure Hunt</span>.
            Every stage you solved showed amazing teamwork and dedication.
            We hope to see you again next time! 🌟
          </p>
        </div>

        {/* Participant progress leaderboard */}
        {data?.progress && data.progress.length > 0 && (
          <div className="w-full space-y-3">
            <h2 className="text-white font-semibold text-base px-1">📊 Participant Progress</h2>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 border-b border-gray-700 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <span>Name</span>
                <span className="text-right">Stages</span>
                <span className="w-20 text-right">Progress</span>
              </div>
              <div className="divide-y divide-gray-800 max-h-80 overflow-y-auto">
                {data.progress.map((p, i) => (
                  <div
                    key={i}
                    className={`grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-3 ${p.completed ? 'bg-yellow-900/20' : ''}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {p.completed && <span className="text-yellow-400 text-xs flex-shrink-0">🏆</span>}
                      <span className={`text-sm font-medium truncate ${p.completed ? 'text-yellow-200' : 'text-gray-300'}`}>
                        {p.name}
                      </span>
                    </div>
                    <span className={`text-sm font-bold text-right flex-shrink-0 ${p.completed ? 'text-emerald-400' : 'text-gray-400'}`}>
                      {p.stagesCompleted}/5
                    </span>
                    <div className="w-20 flex-shrink-0">
                      {stageBar(p.stagesCompleted)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
