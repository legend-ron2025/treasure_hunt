'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import CollegeHeader from '@/components/CollegeHeader';
import SessionWarningBanner from '@/components/SessionWarningBanner';

export default function RegistrationSuccess() {
  const router = useRouter();
  const [hint, setHint] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string>('');
  const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('studentToken');
    if (!token) {
      router.replace('/register');
      return;
    }

    // Fetch student info and stage 1 hint
    Promise.all([
      fetch('/api/student/me', {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/student/stage/1', {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([me, stage]) => {
        if (me?.name) setStudentName(me.name);
        if (stage?.hintText) setHint(stage.hintText);
      })
      .catch(() => {});

    // ── Heartbeat every 2 minutes ────────────────────────────────────────────
    const heartbeatInterval = setInterval(() => {
      const t = localStorage.getItem('studentToken');
      if (t && !document.hidden) {
        navigator.sendBeacon(
          '/api/student/heartbeat',
          new Blob([JSON.stringify({})], { type: 'application/json' }),
        );
      }
    }, 2 * 60 * 1000);

    // ── Dropout beacon on tab close ──────────────────────────────────────────
    function handleBeforeUnload() {
      const t = localStorage.getItem('studentToken');
      if (t) {
        navigator.sendBeacon(
          '/api/student/dropout',
          new Blob(
            [JSON.stringify({ reason: 'dropout_tab_close' })],
            { type: 'application/json' },
          ),
        );
      }
    }

    // ── Dropout beacon when hidden > 5 s (navigation away) ──────────────────
    function handleVisibilityChange() {
      const t = localStorage.getItem('studentToken');
      if (!t) return;
      if (document.hidden) {
        visibilityTimerRef.current = setTimeout(() => {
          navigator.sendBeacon(
            '/api/student/dropout',
            new Blob(
              [JSON.stringify({ reason: 'dropout_navigation' })],
              { type: 'application/json' },
            ),
          );
        }, 5000);
      } else {
        if (visibilityTimerRef.current) {
          clearTimeout(visibilityTimerRef.current);
          visibilityTimerRef.current = null;
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <CollegeHeader />

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-6 text-center space-y-5">
          <div className="text-4xl" aria-hidden="true">🎉</div>

          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {studentName ? `Welcome, ${studentName}!` : 'Registration Successful!'}
            </h2>
            <p className="text-gray-600 mt-1 text-sm">
              You are now registered for the Treasure Hunt.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="font-semibold text-blue-800 text-lg">Now go find QR 1! 🔍</p>
            {hint && (
              <p className="mt-2 text-sm text-blue-700 italic">
                <span className="font-medium">Hint:</span> {hint}
              </p>
            )}
          </div>

          <p className="text-xs text-gray-400">
            Use any QR scanner app to scan the first QR code at its location.
          </p>
        </div>
      </main>
      <SessionWarningBanner />
    </div>
  );
}
