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
  const [confetti, setConfetti] = useState<{ x: number; y: number; color: string; delay: number; size: number }[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('studentToken');
    if (!token) { router.replace('/register'); return; }
    fetch('/api/student/congratulations', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d); setLoading(false); })
      .catch(() => setLoading(false));

    // Generate confetti particles
    const particles = Array.from({ length: 40 }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: ['#ff0080', '#ff8c00', '#00ff88', '#00cfff', '#bf00ff', '#ffff00'][i % 6],
      delay: Math.random() * 3,
      size: Math.random() * 8 + 4,
    }));
    setConfetti(particles);
  }, [router]);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <CollegeHeader />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">Loading your results…</p>
        </div>
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col overflow-hidden relative">
      <CollegeHeader />

      {/* Confetti */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {confetti.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-sm"
            style={{
              left: `${p.x}%`,
              top: `-${p.size * 2}px`,
              width: p.size,
              height: p.size * 2,
              backgroundColor: p.color,
              animation: `confettiFall ${3 + p.delay}s linear ${p.delay}s infinite`,
              opacity: 0.85,
            }}
          />
        ))}
      </div>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-5 relative z-10">

        {/* Trophy + pulsing glow */}
        <div className="text-center relative">
          <div
            className="inline-block"
            style={{ animation: 'trophyBounce 1s ease-in-out infinite alternate' }}
          >
            <span className="text-7xl drop-shadow-2xl">🏆</span>
          </div>
          <div
            className="absolute inset-0 rounded-full blur-3xl opacity-30 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, #ffd700 0%, transparent 70%)',
              animation: 'glowPulse 2s ease-in-out infinite',
            }}
          />
        </div>

        {/* Hero card */}
        <div
          className="relative rounded-3xl p-6 text-center space-y-4 overflow-hidden shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            border: '2px solid transparent',
            backgroundClip: 'padding-box',
          }}
        >
          {/* Animated border glow */}
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, #ff0080, #ff8c00, #ffff00, #00ff88, #00cfff, #bf00ff, #ff0080)',
              backgroundSize: '300% 300%',
              animation: 'rgbBorder 3s linear infinite',
              padding: '2px',
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
            }}
          />

          <h2 className="text-2xl font-bold text-white">
            Congratulations{data?.name ? ',' : '!'}{' '}
          </h2>

          {/* RGB animated name */}
          {data?.name && (
            <div className="relative inline-block">
              <span
                className="text-4xl font-extrabold tracking-wide"
                style={{
                  background: 'linear-gradient(90deg, #ff0080, #ff8c00, #ffff00, #00ff88, #00cfff, #bf00ff, #ff0080)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  animation: 'rgbText 2s linear infinite',
                }}
              >
                {data.name}
              </span>
              {/* RGB strip light under the name */}
              <div
                className="absolute -bottom-2 left-0 right-0 h-1.5 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #ff0080, #ff8c00, #ffff00, #00ff88, #00cfff, #bf00ff, #ff0080)',
                  backgroundSize: '200% auto',
                  animation: 'rgbStrip 1.5s linear infinite',
                  boxShadow: '0 0 12px 3px rgba(255,140,0,0.7)',
                }}
              />
            </div>
          )}

          <p className="text-gray-300 text-sm">You have completed all 5 stages! 🎉</p>

          {/* Winner confirmation */}
          <div
            className="rounded-2xl p-4"
            style={{
              background: 'rgba(255, 215, 0, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.4)',
            }}
          >
            <p className="font-bold text-yellow-300 text-sm">
              Please come over to Jagdish Thakur (President) for Winner Confirmation 🏅
            </p>
          </div>

          {/* Rank + Time */}
          {data && (
            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-2xl p-4"
                style={{ background: 'rgba(0, 120, 255, 0.15)', border: '1px solid rgba(0, 120, 255, 0.4)' }}
              >
                <p className="text-xs text-blue-300 font-semibold uppercase tracking-wide mb-1">Your Rank</p>
                <p
                  className="text-3xl font-extrabold"
                  style={{
                    background: 'linear-gradient(90deg, #00cfff, #bf00ff)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  #{data.rank}
                </p>
              </div>
              <div
                className="rounded-2xl p-4"
                style={{ background: 'rgba(0, 200, 100, 0.15)', border: '1px solid rgba(0, 200, 100, 0.4)' }}
              >
                <p className="text-xs text-emerald-300 font-semibold uppercase tracking-wide mb-1">Total Time</p>
                <p className="text-2xl font-extrabold text-emerald-300 font-mono">
                  {formatTime(data.totalElapsedSeconds)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Leaderboard */}
        {data && data.leaderboard.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-3 border-b border-gray-700 flex items-center gap-2">
              <span className="text-lg">🏅</span>
              <h3 className="font-bold text-white text-base">Top 10 Leaderboard</h3>
            </div>
            <div className="divide-y divide-gray-800">
              {data.leaderboard.map((entry) => {
                const isMe = entry.name === data.name;
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div
                    key={entry.rank}
                    className={`flex items-center gap-3 px-5 py-3 transition-colors ${isMe ? 'bg-yellow-900/20' : 'hover:bg-gray-800/40'}`}
                  >
                    <span className="text-sm font-bold w-8 text-center flex-shrink-0">
                      {entry.rank <= 3 ? medals[entry.rank - 1] : `#${entry.rank}`}
                    </span>
                    <span className={`flex-1 text-sm font-medium truncate ${isMe ? 'text-yellow-200' : 'text-gray-200'}`}>
                      {entry.name}
                      {isMe && <span className="ml-2 text-xs text-yellow-400">(you)</span>}
                    </span>
                    <span className="text-sm font-mono text-gray-400 flex-shrink-0">
                      {formatTime(entry.total_seconds)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <SessionWarningBanner />

      <style>{`
        @keyframes rgbText {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        @keyframes rgbStrip {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        @keyframes rgbBorder {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes trophyBounce {
          from { transform: translateY(0) scale(1); }
          to   { transform: translateY(-10px) scale(1.08); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
