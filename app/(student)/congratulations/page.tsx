'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CollegeHeader from '@/components/CollegeHeader';
import SessionWarningBanner from '@/components/SessionWarningBanner';
import type { CongratsResponse } from '@/lib/types';

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CongratsPage() {
  const router = useRouter();
  const [data, setData] = useState<CongratsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('studentToken');
    if (!token) { router.replace('/register'); return; }
    fetch('/api/student/congratulations', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex flex-col"><CollegeHeader />
      <main className="flex-1 flex items-center justify-center"><p className="text-gray-500">Loading…</p></main>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <CollegeHeader />
      <main className="flex-1 px-4 py-8 max-w-lg mx-auto w-full space-y-6">
        <div className="bg-white rounded-xl shadow-md p-6 text-center space-y-3">
          <div className="text-5xl">🏆</div>
          <h2 className="text-2xl font-bold text-gray-800">Congratulations{data?.name ? `, ${data.name}` : ''}!</h2>
          <p className="text-gray-600 text-sm">You have completed all 5 stages!</p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="font-semibold text-yellow-800">Please come over to Jagdish Thakur (President) for the Winner Confirmation.</p>
          </div>
          {data && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-500">Your Rank</p>
                <p className="text-2xl font-bold text-blue-700">#{data.rank}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-500">Total Time</p>
                <p className="text-xl font-bold text-green-700 font-mono">{formatTime(data.totalElapsedSeconds)}</p>
              </div>
            </div>
          )}
        </div>

        {data && data.leaderboard.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Top 10 Leaderboard</h3>
            <div className="space-y-2">
              {data.leaderboard.map((entry) => (
                <div key={entry.rank} className={`flex items-center justify-between py-2 px-3 rounded-lg ${entry.name === data.name ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-500 w-6">#{entry.rank}</span>
                    <span className="text-sm font-medium text-gray-800">{entry.name}</span>
                  </div>
                  <span className="text-sm font-mono text-gray-600">{formatTime(entry.total_seconds)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <SessionWarningBanner />
    </div>
  );
}
