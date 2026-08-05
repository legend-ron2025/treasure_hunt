'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import CollegeHeader from '@/components/CollegeHeader';

export default function RegistrationSuccess() {
  const router = useRouter();
  const [hint, setHint] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string>('');
  const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Redirect to canonical domain if necessary (handles old/deleted QR links)
    try {
      const canonical = process.env.NEXT_PUBLIC_BASE_URL;
      if (canonical && typeof window !== 'undefined') {
        const canonicalHost = new URL(canonical).host.replace(/:\d+$/, '');
        if (window.location.host.replace(/:\d+$/, '') !== canonicalHost) {
          window.location.replace(canonical.replace(/\/$/, '') + window.location.pathname + window.location.search);
          return;
        }
      }
    } catch (e) {
      // ignore
    }
    const token = localStorage.getItem('studentToken');
    if (!token) { router.replace('/register'); return; }

    Promise.all([
      fetch('/api/student/me', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null)),
      fetch('/api/student/stage/1', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null)),
    ]).then(([me, stage]) => {
      if (me?.name) setStudentName(me.name);
      if (stage?.hintText) setHint(stage.hintText);
    }).catch(() => {});

    // Auto-open in-browser scanner shortly after showing success page
    const autoTimer = setTimeout(() => {
      const t = localStorage.getItem('studentToken');
      if (t) router.push('/stage/1');
    }, 900);

    // Heartbeat every 2 minutes
    const heartbeatInterval = setInterval(() => {
      const t = localStorage.getItem('studentToken');
      if (t && !document.hidden) {
        navigator.sendBeacon('/api/student/heartbeat',
          new Blob([JSON.stringify({ token: t })], { type: 'application/json' }));
      }
    }, 2 * 60 * 1000);

    function sendDropout(reason: 'dropout_tab_close' | 'dropout_navigation') {
      const t = localStorage.getItem('studentToken');
      if (!t) return;
      if (typeof navigator?.sendBeacon !== 'function') return;
      try {
        navigator.sendBeacon('/api/student/dropout', new Blob([JSON.stringify({ token: t, reason })], { type: 'application/json' }));
      } catch {
        // Ignore unsupported or failing beacon calls.
      }
    }

    function handleBeforeUnload() {
      sendDropout('dropout_tab_close');
    }

    function handleVisibilityChange() {
      const t = localStorage.getItem('studentToken');
      if (!t) return;
      if (document.hidden) {
        visibilityTimerRef.current = setTimeout(() => {
          sendDropout('dropout_navigation');
        }, 5000);
      } else {
        if (visibilityTimerRef.current) { clearTimeout(visibilityTimerRef.current); visibilityTimerRef.current = null; }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(autoTimer);
      if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <CollegeHeader />

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-6 text-center space-y-5">
          <div className="text-4xl animate-bounce" aria-hidden="true">🎉</div>

          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {studentName ? `Welcome, ${studentName}!` : 'Registration Successful!'}
            </h2>
            <p className="text-gray-600 mt-1 text-sm">
              You are now registered for the Treasure Hunt.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <p className="font-semibold text-blue-800 text-lg">Now go find QR 1! 🔍</p>
            {hint && (
              <p className="mt-2 text-sm text-blue-700 italic">
                <span className="font-medium">Hint:</span> {hint}
              </p>
            )}
            <div className="pt-1">
              <button
                onClick={() => router.push('/stage/1')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                📜 View Stage 1 Puzzle
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Use any QR scanner app to scan the first QR code at its location.
          </p>
        </div>
      </main>

      {/* Animated Warning Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        {/* Pulsing glow border */}
        <div className="relative bg-red-600 border-t-4 border-red-400 px-4 py-4 shadow-2xl animate-pulse-warning">
          {/* Crazy animated icons strip */}
          <div className="flex justify-center gap-3 mb-2 overflow-hidden">
            {['⚠️','🚫','💀','⚠️','🔴','💥','⚠️','🚫','💀','⚠️'].map((icon, i) => (
              <span
                key={i}
                className="text-xl"
                style={{
                  animation: `bounce 0.6s infinite`,
                  animationDelay: `${i * 0.06}s`,
                  display: 'inline-block',
                }}
              >
                {icon}
              </span>
            ))}
          </div>

          <div className="text-center">
            <p className="text-white font-extrabold text-base uppercase tracking-wide leading-tight">
              ⚠️ IMPORTANT WARNING — Do NOT close this tab or leave this page!
            </p>
            <p className="text-red-100 text-xs mt-1 leading-relaxed">
              If you quit, navigate away, or close the browser during the event,
              your registration will be <span className="font-bold text-white underline">permanently cancelled</span> and
              you will <span className="font-bold text-yellow-300">not be allowed to re-register</span> or participate in this event again.
            </p>
          </div>

          {/* Shimmer overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
              animation: 'shimmer 2s infinite',
              backgroundSize: '200% 100%',
            }}
          />
        </div>
      </div>

      {/* Spacer so content doesn't hide behind fixed banner */}
      <div className="h-32" />

      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-warning {
          0%, 100% { box-shadow: 0 -4px 20px rgba(220, 38, 38, 0.5); }
          50% { box-shadow: 0 -4px 40px rgba(220, 38, 38, 0.9); }
        }
      `}</style>
    </div>
  );
}
